# ==============================================================================
# Reference Implementation — Terraform Multi-Environment + Helm Recovery
#
# A full, production-grade Makefile combining:
#   - Three-axis validation (ENV, LAYER, REGION)
#   - Logging with timestamps
#   - State backup + rollback
#   - Confirmation gates with CI bypass
#   - Per-recipe variables via $(eval CMD=...)
#   - S3-compatible backend credential export (works with MinIO, Ceph, R2,
#     Wasabi, OBS, B2, etc. — drop the AWS_*_CHECKSUM_* env vars for real AWS S3)
#   - helm-recover / helm-purge for stuck releases
#   - Self-documenting help
#
# Larger than the templates on purpose. Copy bits, do not paste whole.
# ==============================================================================

SHELL         := /bin/bash
.SHELLFLAGS   := -euo pipefail -c
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:
MAKEFLAGS     += --warn-undefined-variables --no-print-directory

# ------------------------------------------------------------------------------
# Validation: ENV + LAYER + REGION
# ------------------------------------------------------------------------------

ALLOWED_ENVS    := dev staging prod
ALLOWED_LAYERS  := bootstrap shared app
ALLOWED_REGIONS := us-east-1 us-west-2 eu-west-1

ENV    ?= dev
LAYER  ?= app
REGION ?= us-east-1

ifeq (,$(filter $(LAYER),$(ALLOWED_LAYERS)))
$(error LAYER must be one of: $(ALLOWED_LAYERS))
endif

ifeq ($(LAYER),bootstrap)
$(info bootstrap: ENV is fixed to '$(ENV)' for state-bucket setup)
else ifeq ($(LAYER),shared)
$(info shared: account-wide; ENV='$(ENV)' is informational)
else
ifeq (,$(filter $(ENV),$(ALLOWED_ENVS)))
$(error ENV must be one of: $(ALLOWED_ENVS))
endif
endif

ifeq (,$(filter $(REGION),$(ALLOWED_REGIONS)))
$(error REGION must be one of: $(ALLOWED_REGIONS))
endif

# ------------------------------------------------------------------------------
# Tools and paths
# ------------------------------------------------------------------------------

TF          := terraform
PLAN_FILE   := tf-$(ENV).tfplan
BACKEND_HCL := backend/$(ENV)/backend.hcl
ENV_VAR     := -var="env=$(ENV)" -var="region=$(REGION)"

TIMESTAMP := $(shell date +"%Y-%m-%d_%H-%M-%S")
DATE      := $(shell date +"%Y-%m-%d")
LOG_DIR   := logs/$(LAYER)/$(ENV)/$(DATE)
LOG_FILE   = $(LOG_DIR)/$(CMD)_$(TIMESTAMP).log

# Optional inputs
TARGET     ?=
VARS       ?=
EXTRA_ARGS ?=
RESOURCE   ?=
ID         ?=

# Helm recovery
RELEASE   ?=
NS        ?=
REV       ?=
POD_LABEL ?= app.kubernetes.io/name=$(RELEASE)

VAR_ARGS   := $(foreach v,$(VARS),-var $(v))
TARGET_ARG :=
ifdef TARGET
TARGET_ARG := -target=$(TARGET)
endif

# S3-compatible backend credential export (MinIO / Ceph / R2 / OBS / Wasabi /
# B2 / etc.). Reads from secrets.yaml — do NOT echo these.
# Drop AWS_*_CHECKSUM_*=when_required for real AWS S3.
S3_ENDPOINT ?= https://s3.$(REGION).example.com
S3_CREDS_EXPORT := export AWS_ACCESS_KEY_ID=$$(yq '.s3.access_key' secrets.yaml) && \
	export AWS_SECRET_ACCESS_KEY=$$(yq '.s3.secret_key' secrets.yaml) && \
	export AWS_ENDPOINT_URL_S3="$(S3_ENDPOINT)" && \
	export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required && \
	export AWS_REQUEST_CHECKSUM_CALCULATION=when_required

# ------------------------------------------------------------------------------
# Logging macro
# ------------------------------------------------------------------------------

define run_with_log
	@mkdir -p $(LOG_DIR)
	@echo "===== $(CMD) START $(TIMESTAMP) =====" | tee -a $(LOG_FILE)
	@cd $(LAYER) && $(1) 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tee -a ../$(LOG_FILE); EXIT_CODE=$$?; \
	echo "===== $(CMD) END (EXIT: $$EXIT_CODE) =====" | tee -a ../$(LOG_FILE); \
	exit $$EXIT_CODE
endef

# ------------------------------------------------------------------------------
# Pre-flight
# ------------------------------------------------------------------------------

.PHONY: check-tools
check-tools: ## Verify terraform / yq / kubectl / helm
	@command -v $(TF)   >/dev/null 2>&1 || { echo "ERROR: terraform not installed"; exit 1; }
	@command -v yq      >/dev/null 2>&1 || { echo "ERROR: yq not installed";        exit 1; }
	@command -v kubectl >/dev/null 2>&1 || { echo "WARN:  kubectl not installed (helm-recover unusable)"; }
	@command -v helm    >/dev/null 2>&1 || { echo "WARN:  helm not installed (helm-recover unusable)"; }
	@echo "Tools OK"

.PHONY: check-env
check-env: ## Verify backend config and credentials
	@[ -d "$(LAYER)" ]                  || { echo "ERROR: $(LAYER)/ not found";          exit 1; }
	@[ -f "$(LAYER)/$(BACKEND_HCL)" ]   || { echo "ERROR: $(LAYER)/$(BACKEND_HCL) missing"; exit 1; }
	@[ -f "secrets.yaml" ]              || { echo "ERROR: secrets.yaml missing"; exit 1; }
	@echo "Env OK ($(LAYER)/$(ENV)/$(REGION))"

.PHONY: check-state
check-state: ## Probe whether state is initialized
	@cd $(LAYER) && $(S3_CREDS_EXPORT) && $(TF) state list >/dev/null 2>&1 \
	  && echo "State accessible" \
	  || echo "WARN: state not initialized"

# ------------------------------------------------------------------------------
# State backup
# ------------------------------------------------------------------------------

.PHONY: backup-state
backup-state: check-env ## Pull state and save a timestamped backup
	@mkdir -p $(LAYER)/state/$(ENV)
	@cd $(LAYER) && $(S3_CREDS_EXPORT) && \
	if $(TF) state pull > /dev/null 2>&1; then \
		$(TF) state pull > state/$(ENV)/terraform.tfstate.backup.$(TIMESTAMP); \
		echo "Backed up: $(LAYER)/state/$(ENV)/terraform.tfstate.backup.$(TIMESTAMP)"; \
	else \
		echo "WARN: state not initialized — nothing to backup"; \
	fi

# ------------------------------------------------------------------------------
# Core terraform commands
# ------------------------------------------------------------------------------

.PHONY: init
init: check-tools check-env ## terraform init -reconfigure
	$(eval CMD=init)
	@$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) init -reconfigure -backend-config=$(BACKEND_HCL) $(EXTRA_ARGS))

.PHONY: plan
plan: check-tools check-env ## terraform plan -out=tf-<env>.tfplan
	$(eval CMD=plan)
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) plan -out=$(PLAN_FILE) $(ENV_VAR) $(VAR_ARGS) $(TARGET_ARG) $(EXTRA_ARGS))

.PHONY: apply
apply: check-tools check-env backup-state ## Apply existing plan file (CI=true to skip prompt)
	$(eval CMD=apply)
	@[ -f "$(LAYER)/$(PLAN_FILE)" ] \
	  || { echo "ERROR: $(LAYER)/$(PLAN_FILE) not found"; echo "Run 'make plan ENV=$(ENV) LAYER=$(LAYER)' first"; exit 1; }
	@[ "$(CI)" = "true" ] || { \
		echo "Applying $(PLAN_FILE) — requires explicit approval"; \
		read -p "Type 'approve' to continue: " approval; \
		[ "$$approval" = "approve" ] || { echo "Cancelled"; exit 1; }; \
	}
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) apply $(PLAN_FILE))

.PHONY: destroy
destroy: check-tools check-env backup-state ## Destroy infrastructure (requires confirmation)
	$(eval CMD=destroy)
	@echo "WARNING: This will DESTROY infrastructure in ENV=$(ENV) LAYER=$(LAYER) REGION=$(REGION)"
	@read -p "Type 'destroy-$(ENV)' to confirm: " confirm; \
	[ "$$confirm" = "destroy-$(ENV)" ] || { echo "Cancelled"; exit 1; }
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) destroy $(ENV_VAR) $(VAR_ARGS) $(EXTRA_ARGS))

.PHONY: validate
validate: check-tools ## terraform validate
	$(eval CMD=validate)
	@cd $(LAYER) && $(TF) init -backend=false -upgrade 2>/dev/null || true
	$(call run_with_log,$(TF) validate)

.PHONY: fmt
fmt: check-tools ## terraform fmt -recursive
	$(eval CMD=fmt)
	$(call run_with_log,$(TF) fmt -recursive)

.PHONY: show
show: check-tools check-state ## Show current state
	$(eval CMD=show)
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) show $(EXTRA_ARGS))

.PHONY: output
output: check-tools check-state ## Show outputs
	$(eval CMD=output)
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) output)

# ------------------------------------------------------------------------------
# State operations
# ------------------------------------------------------------------------------

.PHONY: state-list
state-list: check-tools ## terraform state list
	$(eval CMD=state-list)
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) state list)

.PHONY: state-show
state-show: check-tools ## terraform state show RESOURCE=...
	$(eval CMD=state-show)
	@[ -n "$(RESOURCE)" ] || { echo "ERROR: RESOURCE required"; exit 1; }
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) state show '$(RESOURCE)')

.PHONY: state-rm
state-rm: check-tools ## terraform state rm RESOURCE=...
	$(eval CMD=state-rm)
	@[ -n "$(RESOURCE)" ] || { echo "ERROR: RESOURCE required"; exit 1; }
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) state rm '$(RESOURCE)')

.PHONY: import
import: check-tools ## terraform import RESOURCE=... ID=...
	$(eval CMD=import)
	@[ -n "$(RESOURCE)" ] && [ -n "$(ID)" ] \
	  || { echo "ERROR: RESOURCE and ID required"; exit 1; }
	$(call run_with_log,$(S3_CREDS_EXPORT) && $(TF) import $(ENV_VAR) $(VAR_ARGS) '$(RESOURCE)' '$(ID)')

# ------------------------------------------------------------------------------
# Composite workflows
# ------------------------------------------------------------------------------

.PHONY: deploy
deploy: validate init plan apply ## Full pipeline
	@echo "Deployment complete for ENV=$(ENV) REGION=$(REGION)"

.PHONY: dry-run
dry-run: validate init plan ## Plan-only (no changes)
	@echo "Dry-run complete. Review with: make show ENV=$(ENV) LAYER=$(LAYER)"

.PHONY: safe-apply
safe-apply: backup-state apply ## Apply with state backup
	@echo "Safe apply complete"

.PHONY: rollback
rollback: check-env ## Restore latest state backup
	@LATEST=$$(ls -t $(LAYER)/state/$(ENV)/terraform.tfstate.backup.* 2>/dev/null | head -1); \
	if [ -z "$$LATEST" ]; then echo "ERROR: no backups in $(LAYER)/state/$(ENV)/"; exit 1; fi; \
	echo "Latest backup: $$LATEST"; \
	read -p "Type 'rollback' to confirm: " confirm; \
	[ "$$confirm" = "rollback" ] || { echo "Cancelled"; exit 1; }; \
	cd $(LAYER) && $(S3_CREDS_EXPORT) && $(TF) state push ../$$LATEST; \
	echo "Rolled back to $$LATEST"

# ------------------------------------------------------------------------------
# Helm recovery — for stuck releases that block terraform apply
# ------------------------------------------------------------------------------

.PHONY: helm-recover
helm-recover: ## Force-clean stuck pods + rollback (RELEASE=, NS=, REV=, POD_LABEL=)
	@[ -n "$(RELEASE)" ] && [ -n "$(NS)" ] && [ -n "$(REV)" ] \
	  || { echo "ERROR: RELEASE, NS, REV required (find via 'helm history $$RELEASE -n $$NS')"; exit 1; }
	@echo "Scaling Deployments/StatefulSets to 0..."
	@kubectl get deploy,sts -n $(NS) -l app.kubernetes.io/instance=$(RELEASE) --no-headers 2>/dev/null \
	  | awk '{print $$1}' | xargs -r -I{} kubectl scale {} -n $(NS) --replicas=0 || true
	@echo "Force-deleting stuck pods (label $(POD_LABEL))..."
	@kubectl get pod -n $(NS) -l $(POD_LABEL) --no-headers 2>/dev/null \
	  | awk '$$3 != "Running" && $$3 != "Completed" {print $$1}' \
	  | xargs -r -I{} kubectl delete pod {} -n $(NS) --force --grace-period=0 --ignore-not-found || true
	@echo "Rolling back $(RELEASE) to revision $(REV)..."
	@helm rollback $(RELEASE) $(REV) -n $(NS) --no-hooks --timeout 3m || true
	@echo "Done. Run 'make apply ENV=$(ENV) LAYER=$(LAYER)' to reconcile."

.PHONY: helm-purge
helm-purge: ## Force uninstall + delete PVCs (RELEASE=, NS=)
	@[ -n "$(RELEASE)" ] && [ -n "$(NS)" ] || { echo "ERROR: RELEASE and NS required"; exit 1; }
	@echo "WARNING: deletes helm release AND its PVCs"
	@read -p "Type 'purge-$(RELEASE)' to confirm: " confirm; \
	[ "$$confirm" = "purge-$(RELEASE)" ] || { echo "Cancelled"; exit 1; }
	@kubectl get pod -n $(NS) -l app.kubernetes.io/instance=$(RELEASE) --no-headers 2>/dev/null \
	  | awk '$$3 != "Running" && $$3 != "Completed" {print $$1}' \
	  | xargs -r -I{} kubectl delete pod {} -n $(NS) --force --grace-period=0 --ignore-not-found || true
	@helm uninstall $(RELEASE) -n $(NS) --wait --timeout 5m --ignore-not-found 2>&1 | tail -3 || true
	@kubectl get pvc -n $(NS) -l app.kubernetes.io/instance=$(RELEASE) --no-headers 2>/dev/null \
	  | awk '{print $$1}' | xargs -r -I{} kubectl delete pvc {} -n $(NS) --wait=false --ignore-not-found || true
	@echo "Purge complete."

# ------------------------------------------------------------------------------
# Maintenance
# ------------------------------------------------------------------------------

.PHONY: logs
logs: ## Show latest logs
	@ls -lah logs/$(LAYER)/$(ENV)/ 2>/dev/null || echo "No logs"

.PHONY: clean-logs
clean-logs: ## Remove all logs
	@rm -rf logs/*
	@echo "Logs cleaned"

.PHONY: clean-plans
clean-plans: ## Remove all .tfplan files
	@find . -name "tf-*.tfplan" -delete
	@echo "Plan files cleaned"

.PHONY: clean
clean: clean-logs clean-plans ## Remove logs and plan files
	@echo "Cleaned"

.PHONY: version
version: ## Show terraform version
	@$(TF) --version

# ------------------------------------------------------------------------------
# Help
# ------------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@echo ""
	@echo "============================================================"
	@echo "  Terraform Multi-Environment Makefile"
	@echo "============================================================"
	@echo ""
	@echo "VARIABLES:"
	@echo "  ENV       (default: dev)         | dev | staging | prod"
	@echo "  LAYER     (default: app)         | bootstrap | shared | app"
	@echo "  REGION    (default: us-east-1)   | us-east-1 | us-west-2 | eu-west-1"
	@echo "  TARGET    (optional)             | -target=<addr>"
	@echo "  VARS      (optional)             | -var key=value (space-separated)"
	@echo "  CI=true                          | skip approval prompts"
	@echo ""
	@echo "TARGETS:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "EXAMPLES:"
	@echo "  make deploy ENV=dev LAYER=app"
	@echo "  make rollback ENV=prod LAYER=app"
	@echo "  CI=true make apply ENV=prod LAYER=app"
	@echo "  make helm-recover RELEASE=my-app NS=my-ns REV=8"
	@echo "  make helm-purge   RELEASE=my-app NS=my-ns"
	@echo ""
	@echo "LOGS:"
	@echo "  logs/<layer>/<env>/<command>_<timestamp>.log"
	@echo ""
