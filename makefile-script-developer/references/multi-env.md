# Multi-Environment Patterns

How to model dev / staging / prod, multi-instance, multi-region, and multi-layer setups in a single Makefile.

---

## 1. Validated `ENV` enum

```makefile
ALLOWED_ENVS := dev staging prod
ENV ?= dev
ifeq (,$(filter $(ENV),$(ALLOWED_ENVS)))
$(error ENV must be one of: $(ALLOWED_ENVS))
endif
```

`$(filter $(ENV),$(ALLOWED_ENVS))` returns `$(ENV)` if it's in the list, else empty. The `ifeq (,$(filter ...))` halts at parse time before any recipe runs.

**Why parse-time, not runtime?** Make resolves all targets and dependencies *before* running any recipe. A runtime check (`@[ "$(ENV)" = "dev" ] || exit 1`) runs after all dependency recipes have started — too late if `init` already mutated something.

---

## 2. Layer + Env (two-axis validation)

A common Terraform layout splits infrastructure into layers — each with its own state and lifecycle:

```makefile
ALLOWED_ENVS   := dev staging prod
ALLOWED_LAYERS := bootstrap shared app
LAYER ?= app
ENV   ?= dev

ifeq ($(LAYER),bootstrap)
  $(info bootstrap mode: ENV is fixed to dev)
  ENV := dev
else ifeq ($(LAYER),shared)
  $(info shared mode: account-wide; ENV is informational only)
else
  ifeq (,$(filter $(ENV),$(ALLOWED_ENVS)))
  $(error ENV must be one of: $(ALLOWED_ENVS))
  endif
endif

ifeq (,$(filter $(LAYER),$(ALLOWED_LAYERS)))
$(error LAYER must be one of: $(ALLOWED_LAYERS))
endif
```

Conventional layer meanings:

- `bootstrap` — one-time setup of the state backend / IAM / org-level resources. Single-env (usually `dev`).
- `shared` — account-wide or org-wide resources (DNS zones, root certs, audit logging). `ENV` is informational only.
- `app` — per-environment application infrastructure. Real `ENV` required (`dev`/`staging`/`prod`).

Pick names that match your layout. Other common splits: `network / platform / app`, `accounts / vpcs / clusters / apps`.

---

## 3. Per-environment plan files

Each environment writes its own plan/state to avoid cross-contamination:

```makefile
PLAN_FILE     := tf-$(ENV).tfplan
BACKEND_HCL   := backend/$(ENV)/backend.hcl
LOG_DIR       := logs/$(LAYER)/$(ENV)/$(shell date +%Y-%m-%d)
STATE_BACKUP  := state/$(ENV)/terraform.tfstate.backup.$(TIMESTAMP)

plan:
	terraform plan -out=$(PLAN_FILE) -backend-config=$(BACKEND_HCL)

apply:
	terraform apply $(PLAN_FILE)
```

**Layout on disk:**

```
backend/
  dev/backend.hcl
  staging/backend.hcl
  prod/backend.hcl
logs/
  app/dev/2026-04-26/...
  app/staging/2026-04-26/...
state/
  dev/terraform.tfstate.backup.2026-04-26_14-22-10
```

---

## 4. Layered `.env` includes

```makefile
-include .env.sample           # baseline, committed
-include .env                  # local overrides, gitignored
ifneq ($(INSTANCE),)
  -include envs/$(INSTANCE).env # per-instance overrides when INSTANCE is set
endif
export                          # export every variable to children
```

`-include` (with leading dash) silently ignores missing files. Each subsequent include can override previous values; later wins.

`export` (no args) exports *all* Make variables to child processes — useful when calling `helm`, `kubectl`, or scripts that read env vars.

---

## 5. Auto-generate per-instance env files

```makefile
DOMAIN_BASE ?= example.com

.PHONY: gen-instance-env
gen-instance-env:
	@[ -n "$(INSTANCE)" ] || { echo "ERROR: INSTANCE is not set"; exit 1; }
	@mkdir -p envs
	@printf 'NAMESPACE=%s\n'         "$(INSTANCE)"               > envs/$(INSTANCE).env
	@printf 'DOMAIN=%s.%s\n'        "$(INSTANCE)" "$(DOMAIN_BASE)" >> envs/$(INSTANCE).env
	@printf 'DOMAIN_API=%s-api.%s\n' "$(INSTANCE)" "$(DOMAIN_BASE)" >> envs/$(INSTANCE).env
	@echo "Generated envs/$(INSTANCE).env"
	@cat envs/$(INSTANCE).env

.PHONY: gen-all-instance-envs
gen-all-instance-envs:
	@[ -n "$(INSTANCES)" ] || { echo "ERROR: INSTANCES is not set"; exit 1; }
	@for instance in $(INSTANCES); do \
		$(MAKE) gen-instance-env INSTANCE=$$instance; \
	done

# Usage:
#   make gen-instance-env INSTANCE=tenant-a
#   make gen-all-instance-envs INSTANCES="tenant-a tenant-b tenant-c"
```

---

## 6. Auto-discover instances from `envs/*.env`

```makefile
.PHONY: list-instances
list-instances:
	@ls envs/*.env 2>/dev/null | sed 's|envs/||;s|\.env||' \
	  | awk '{print "  " $$0}' \
	  || echo "  (none — create envs/<name>.env)"

.PHONY: deploy-all-instances
deploy-all-instances:
	@for env_file in envs/*.env; do \
		instance=$$(basename $$env_file .env); \
		$(MAKE) deploy-instance INSTANCE=$$instance; \
	done

.PHONY: status-all
status-all:
	@for env_file in envs/*.env; do \
		instance=$$(basename $$env_file .env); \
		echo "--- $$instance ---"; \
		kubectl get pods -n $$instance --no-headers 2>/dev/null \
		  || echo "  (namespace not found)"; \
	done
```

Instances live as namespaces named after `envs/<name>.env`. Adding an instance is just creating an env file.

---

## 7. Per-environment confirmation strings

```makefile
.PHONY: destroy
destroy:
	@echo "WARNING: Destroying ENV=$(ENV)"
	@read -p "Type 'destroy-$(ENV)' to confirm: " confirm; \
	[ "$$confirm" = "destroy-$(ENV)" ] || (echo "Cancelled"; exit 1)
	terraform destroy
```

The `$(ENV)` in the confirmation string blocks "muscle-memory destroy" — typing `destroy-dev` won't pass when `ENV=prod`.

---

## 8. CI/automation bypass

```makefile
.PHONY: apply
apply: backup-state
	@[ "$(CI)" = "true" ] || { \
		read -p "Type 'approve' to continue: " approval; \
		[ "$$approval" = "approve" ] || (echo "Cancelled"; exit 1); \
	}
	terraform apply $(PLAN_FILE)
```

Then in CI: `CI=true make apply ENV=prod`. Don't add an unconditional skip — make CI explicit.

---

## 9. Combining workflows: `deploy = validate + init + plan + apply`

```makefile
.PHONY: deploy dry-run safe-apply
deploy: validate init plan apply
	@echo "Deployment completed for ENV=$(ENV)"

dry-run: validate init plan
	@echo "Dry-run complete (no changes applied)"
	@echo "Review: make show ENV=$(ENV)"

safe-apply: backup-state apply
	@echo "Safe apply complete with state backup"
```

Composite targets wire the dependency order. `make deploy ENV=dev` runs the full chain.

---

## 10. Cross-region setups

Add `REGION` as a third axis:

```makefile
ALLOWED_REGIONS := us-east-1 us-west-2 eu-west-1
REGION ?= us-east-1
ifeq (,$(filter $(REGION),$(ALLOWED_REGIONS)))
$(error REGION must be one of: $(ALLOWED_REGIONS))
endif

BACKEND_HCL := backend/$(REGION)/$(ENV)/backend.hcl
LOG_DIR     := logs/$(REGION)/$(ENV)
```

Same `$(filter ...)` pattern as `ENV`. Layout the on-disk tree to match (`backend/<region>/<env>/...`).

---

## 11. Defaulting `ENV` differently per `LAYER`

```makefile
ifeq ($(LAYER),bootstrap)
  ENV ?= dev          # bootstrap is single-env
else ifeq ($(LAYER),shared)
  ENV ?= dev          # shared is account-wide; ENV is informational
else
  # app layer requires real ENV — caller must pass dev/staging/prod
  ifeq (,$(filter $(ENV),$(ALLOWED_ENVS)))
  $(error ENV must be one of: $(ALLOWED_ENVS))
  endif
endif
```

Use `$(info ...)` to surface the inferred default to the user so they don't think their value was ignored:

```makefile
$(info LAYER=bootstrap: Using ENV=$(ENV))
```
