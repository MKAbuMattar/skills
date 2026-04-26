# Helm / kubectl / Terraform Recipes

Production patterns for wrapping these tools in `make` targets — covering the rough edges (stuck releases, state backups, S3-compatible backends, force-deleting wedged pods).

---

## Terraform

### Plan / apply with explicit plan file

```makefile
PLAN_FILE   := tf-$(ENV).tfplan
BACKEND_HCL := backend/$(ENV)/backend.hcl
ENV_VAR     := -var="env=$(ENV)"

.PHONY: init plan apply
init: check-tools check-env
	$(eval CMD=init)
	$(call run_with_log,terraform init -reconfigure -backend-config=$(BACKEND_HCL))

plan: check-tools check-env
	$(eval CMD=plan)
	$(call run_with_log,terraform plan -out=$(PLAN_FILE) $(ENV_VAR) $(VAR_ARGS) $(TARGET_ARG))

apply: check-tools check-env backup-state
	$(eval CMD=apply)
	@[ -f "$(LAYER)/$(PLAN_FILE)" ] \
	  || { echo "Plan not found. Run 'make plan ENV=$(ENV)' first"; exit 1; }
	@[ "$(CI)" = "true" ] || { \
		read -p "Type 'approve' to continue: " approval; \
		[ "$$approval" = "approve" ] || (echo "Cancelled"; exit 1); \
	}
	$(call run_with_log,terraform apply $(PLAN_FILE))
```

Always plan-then-apply with an explicit plan file. Never `apply -auto-approve` against the live config — the recorded plan file is what guarantees what will run.

---

### State backup before mutation

```makefile
.PHONY: backup-state
backup-state: check-env
	@mkdir -p $(LAYER)/state/$(ENV)
	@cd $(LAYER) && \
	if terraform state pull > /dev/null 2>&1; then \
		terraform state pull > ../$(LAYER)/state/$(ENV)/terraform.tfstate.backup.$(TIMESTAMP); \
		echo "Backed up: state/$(ENV)/terraform.tfstate.backup.$(TIMESTAMP)"; \
	else \
		echo "State not initialized"; \
	fi
```

`apply` and `destroy` should both depend on `backup-state` so a faulty change can be reverted via `state push`.

---

### Rollback to latest backup

```makefile
.PHONY: rollback
rollback: check-env
	@LATEST=$$(ls -t $(LAYER)/state/$(ENV)/terraform.tfstate.backup.* 2>/dev/null | head -1); \
	if [ -z "$$LATEST" ]; then echo "No backups"; exit 1; fi; \
	echo "Latest backup: $$LATEST"; \
	read -p "Type 'rollback' to confirm: " confirm; \
	[ "$$confirm" = "rollback" ] || (echo "Cancelled"; exit 1); \
	cd $(LAYER) && terraform state push ../$$LATEST
```

---

### S3-compatible backend credentials (MinIO / Ceph / R2 / OBS / Wasabi / etc.)

For any S3-compatible object store (not AWS proper), Terraform reads AWS-style env vars but you point it at a custom endpoint. Pull credentials from a `yq`-readable secrets file rather than hardcoding:

```makefile
# Reads credentials.username / .password from a YAML file. Adjust paths to taste.
S3_CREDS_EXPORT := export AWS_ACCESS_KEY_ID=$$(yq '.s3.access_key' secrets.yaml) && \
	export AWS_SECRET_ACCESS_KEY=$$(yq '.s3.secret_key' secrets.yaml) && \
	export AWS_ENDPOINT_URL_S3="$(S3_ENDPOINT)" && \
	export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required && \
	export AWS_REQUEST_CHECKSUM_CALCULATION=when_required

.PHONY: apply
apply:
	$(call run_with_log,$(S3_CREDS_EXPORT) && terraform apply $(PLAN_FILE))
```

Notes:

- `AWS_*_CHECKSUM_*=when_required` is the workaround for backends that don't return the checksum headers Terraform v1.11+ wants to validate. Drop these two vars when targeting real AWS S3.
- Prefix the line with `@` (or use `run_with_log`) so the export of secrets isn't echoed to stdout.
- The same pattern works for any S3-compatible store — replace `$(S3_ENDPOINT)` with the right URL and the credential keys with your secrets-file schema.

---

### `state-list` / `state-show` / `state-rm` / `import`

```makefile
.PHONY: state-list state-show state-rm import
state-list:
	cd $(LAYER) && terraform state list

state-show:
	@[ -n "$(RESOURCE)" ] || { echo "RESOURCE required"; exit 1; }
	cd $(LAYER) && terraform state show '$(RESOURCE)'

state-rm:
	@[ -n "$(RESOURCE)" ] || { echo "RESOURCE required"; exit 1; }
	cd $(LAYER) && terraform state rm '$(RESOURCE)'

import:
	@[ -n "$(RESOURCE)" ] && [ -n "$(ID)" ] \
	  || { echo "RESOURCE and ID required"; exit 1; }
	cd $(LAYER) && terraform import '$(RESOURCE)' '$(ID)'
```

Always validate required parameters at the top of the recipe — Terraform's own error messages for missing args are confusing.

---

## Helm

### Install / upgrade with safety flags

```makefile
.PHONY: deploy-app
deploy-app: check-tools check-env
	helm upgrade --install $(RELEASE) charts/$(CHART) \
	  --namespace $(NAMESPACE) \
	  -f $(GEN_VALUES_FILE) $(_vf_extra) \
	  --rollback-on-failure \
	  --wait \
	  --timeout 10m \
	  --cleanup-on-fail
```

| Flag | Effect |
| --- | --- |
| `--install` | Install if not present (so `upgrade` works idempotently). |
| `--rollback-on-failure` | Auto-rollback if the upgrade fails. |
| `--wait` | Block until pods become Ready. |
| `--timeout 10m` | Hard cap on `--wait`. Without it, `--wait` is unbounded. |
| `--cleanup-on-fail` | Delete partially-created resources on failure. |

---

### Detect & clean stuck releases before deploy

```makefile
deploy-app:
	@_status=$$(helm status $(RELEASE) -n $(NAMESPACE) -o json 2>/dev/null \
	  | yq '.info.status' 2>/dev/null || true); \
	if echo "$$_status" | grep -qE "^(pending-install|pending-upgrade|failed)$$"; then \
		echo "Cleaning up stuck release ($$_status)..."; \
		helm uninstall $(RELEASE) -n $(NAMESPACE) 2>/dev/null || true; \
	fi; \
	helm upgrade --install $(RELEASE) charts/$(CHART) -n $(NAMESPACE) --wait --timeout 10m
```

Common causes of `pending-upgrade`: a previous `helm upgrade --wait` was Ctrl-C'd, or a CSI mount hung. Force-uninstalling first is safe because we always pair it with a fresh `--install`.

---

### `helm-recover` for wedged releases (force-delete pods + rollback)

```makefile
.PHONY: helm-recover
helm-recover:
	@[ -n "$(RELEASE)" ] && [ -n "$(NS)" ] && [ -n "$(REV)" ] \
	  || { echo "RELEASE, NS, REV all required"; exit 1; }
	@echo "Scaling Deployments/StatefulSets to 0 to stop new pod spawn..."
	@kubectl get deploy,sts -n $(NS) -l app.kubernetes.io/instance=$(RELEASE) --no-headers \
	  | awk '{print $$1}' | xargs -r -I{} kubectl scale {} -n $(NS) --replicas=0 || true
	@echo "Force-deleting any stuck pods (label $(POD_LABEL))..."
	@kubectl get pod -n $(NS) -l $(POD_LABEL) --no-headers 2>/dev/null \
	  | awk '$$3 != "Running" && $$3 != "Completed" {print $$1}' \
	  | xargs -r -I{} kubectl delete pod {} -n $(NS) --force --grace-period=0 --ignore-not-found || true
	@echo "Rolling back $(RELEASE) to revision $(REV)..."
	@helm rollback $(RELEASE) $(REV) -n $(NS) --no-hooks --timeout 3m || true

POD_LABEL ?= app.kubernetes.io/name=$(RELEASE)
```

Why this is needed: when a helm upgrade wedges on a stuck pod (e.g. a CSI mount hangs), `helm rollback` *also* times out because it can't drain. Scaling to 0 and force-deleting the pod breaks the deadlock.

---

### `helm-purge` for unrecoverable releases

```makefile
.PHONY: helm-purge
helm-purge:
	@[ -n "$(RELEASE)" ] && [ -n "$(NS)" ] || { echo "RELEASE, NS required"; exit 1; }
	@kubectl get pod -n $(NS) -l app.kubernetes.io/instance=$(RELEASE) --no-headers 2>/dev/null \
	  | awk '$$3 != "Running" && $$3 != "Completed" {print $$1}' \
	  | xargs -r -I{} kubectl delete pod {} -n $(NS) --force --grace-period=0 --ignore-not-found || true
	@helm uninstall $(RELEASE) -n $(NS) --wait --timeout 5m --ignore-not-found 2>&1 | tail -3 || true
	@kubectl get pvc -n $(NS) -l app.kubernetes.io/instance=$(RELEASE) --no-headers 2>/dev/null \
	  | awk '{print $$1}' | xargs -r -I{} kubectl delete pvc {} -n $(NS) --wait=false --ignore-not-found || true
	@echo "Purge complete. Run 'make apply' to reinstall."
```

**Destructive**: deletes PVCs labelled with the release. Stateful workloads (databases) lose data unless you've snapshotted/backed up first.

---

### Helm chart packaging + push to OCI registry

```makefile
.PHONY: lint package push
lint:
	helm lint $(CHART_DIR) $(EXTRA_ARGS)

package: lint
	helm package $(CHART_DIR) --destination $(OUTPUT_DIR) $(EXTRA_ARGS)

push: package
	@[ -f "$(CREDENTIALS)" ] || { echo "$(CREDENTIALS) not found"; exit 1; }
	@USER=$$(yq '.registry.username' $(CREDENTIALS)); \
	PASS=$$(yq '.registry.password' $(CREDENTIALS)); \
	echo "$$PASS" | helm registry login -u "$$USER" --password-stdin $(REGISTRY); \
	helm push $(OUTPUT_DIR)/$(CHART_NAME)-$(VERSION).tgz oci://$(REGISTRY)/$(REGISTRY_PATH)
```

Use `--password-stdin` and pull credentials from a YAML file rather than passing on the CLI. The `@` prefix prevents echo of the assignment lines. The `oci://...` form is supported by every modern registry that speaks OCI artifacts (Docker Hub, GHCR, ECR, GCR, Harbor, self-hosted Distribution, etc.).

---

## kubectl

### Force-delete stuck pods

```makefile
.PHONY: force-delete-stuck-pods
force-delete-stuck-pods:
	@kubectl get pod -n $(NS) -l $(LABEL) --no-headers 2>/dev/null \
	  | awk '$$3 != "Running" && $$3 != "Completed" {print $$1}' \
	  | xargs -r -I{} kubectl delete pod {} -n $(NS) --force --grace-period=0 --ignore-not-found
```

`--force --grace-period=0` skips the graceful termination; only use on pods that are already wedged. `--ignore-not-found` keeps the recipe idempotent.

---

### Conditional namespace creation

```makefile
.PHONY: namespace
namespace:
	@kubectl get ns $(NAMESPACE) >/dev/null 2>&1 \
	  && echo "Namespace '$(NAMESPACE)' exists" \
	  || (kubectl create ns $(NAMESPACE) && echo "Namespace '$(NAMESPACE)' created")
```

`get >/dev/null && echo OK || create` is the idempotent pattern.

---

### Image-pull and TLS secrets via `dry-run | apply`

```makefile
.PHONY: secret
secret: namespace
	@[ -n "$(REGISTRY_USER)" ] && [ -n "$(REGISTRY_PASS)" ] \
	  || { echo "REGISTRY_USER and REGISTRY_PASS required"; exit 1; }
	@kubectl create secret docker-registry $(PULL_SECRET_NAME) \
	  --namespace $(NAMESPACE) \
	  --docker-server=$(REGISTRY) \
	  --docker-username=$(REGISTRY_USER) \
	  --docker-password=$(REGISTRY_PASS) \
	  --dry-run=client -o yaml | kubectl apply -f -

.PHONY: secret-tls
secret-tls: namespace
	@[ -f "$(TLS_CERT)" ] && [ -f "$(TLS_KEY)" ] \
	  || { echo "TLS_CERT/TLS_KEY missing"; exit 1; }
	@kubectl create secret tls $(TLS_SECRET_NAME) \
	  --namespace $(NAMESPACE) --cert=$(TLS_CERT) --key=$(TLS_KEY) \
	  --dry-run=client -o yaml | kubectl apply -f -
```

`create ... --dry-run=client -o yaml | kubectl apply -f -` is the canonical idempotent secret-create pattern: it works whether or not the secret already exists.

---

### Status / observability

```makefile
.PHONY: status
status:
	@echo "=== Helm Releases ($(NAMESPACE)) ==="
	@helm list --namespace $(NAMESPACE)
	@echo ""
	@echo "=== Pods ($(NAMESPACE)) ==="
	@kubectl get pods --namespace $(NAMESPACE) -o wide
	@echo ""
	@echo "=== Services ($(NAMESPACE)) ==="
	@kubectl get svc --namespace $(NAMESPACE)
	@echo ""
	@echo "=== Ingresses ($(NAMESPACE)) ==="
	@kubectl get ingress --namespace $(NAMESPACE)
```

A single `make status` that shows the whole topology beats jumping between `helm list`, `kubectl get pods`, etc.
