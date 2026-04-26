# Makefile Patterns

Concrete patterns extracted from production Makefiles. Each one solves a specific problem — pick what you need, do not paste them all.

---

## 1. Header — strict mode and safety settings

```makefile
SHELL         := /bin/bash
.SHELLFLAGS   := -euo pipefail -c
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:
MAKEFLAGS     += --warn-undefined-variables --no-print-directory
```

| Setting | Effect |
| --- | --- |
| `SHELL := /bin/bash` | Replaces the default `/bin/sh` (often dash/ash) with bash. |
| `.SHELLFLAGS := -euo pipefail -c` | `-e` exit on error, `-u` exit on undefined var, `pipefail` propagate pipe failures. |
| `.DEFAULT_GOAL := help` | `make` with no args runs `help`. |
| `.DELETE_ON_ERROR:` | Delete a target's file if its recipe failed (avoids stale half-built artifacts). |
| `--warn-undefined-variables` | Warns when `$(FOO)` is referenced but never set — catches typos. |
| `--no-print-directory` | Stops Make from echoing `Entering directory '/path'` noise. |

---

## 2. Enum validation — `$(filter ...)` + `$(error ...)`

```makefile
ALLOWED_ENVS   := dev staging prod
ALLOWED_LAYERS := bootstrap shared app

ENV   ?= dev
LAYER ?= app

ifeq (,$(filter $(ENV),$(ALLOWED_ENVS)))
$(error ENV must be one of: $(ALLOWED_ENVS))
endif

ifeq (,$(filter $(LAYER),$(ALLOWED_LAYERS)))
$(error LAYER must be one of: $(ALLOWED_LAYERS))
endif
```

`$(filter X,LIST)` returns `X` if present in `LIST`, else empty. The `ifeq (,$(filter ...))` halts at parse time before any recipe runs.

---

## 3. Per-recipe variables via `$(eval CMD=...)`

When `LOG_FILE` depends on a per-target tag:

```makefile
LOG_FILE = $(LOG_DIR)/$(CMD)_$(TIMESTAMP).log    # = (recursive) — re-evaluates per use

.PHONY: plan
plan:
	$(eval CMD=plan)
	$(call run_with_log,terraform plan -out=tf.plan)
```

`$(eval CMD=plan)` sets `CMD` for this target's recipe scope, and `LOG_FILE` lazily picks it up because it was assigned with `=` not `:=`.

---

## 4. Logging macro

```makefile
TIMESTAMP := $(shell date +"%Y-%m-%d_%H-%M-%S")
LOG_DIR   := logs/$(LAYER)/$(ENV)/$(shell date +%Y-%m-%d)
LOG_FILE   = $(LOG_DIR)/$(CMD)_$(TIMESTAMP).log

define run_with_log
	@mkdir -p $(LOG_DIR)
	@echo "===== $(CMD) START $(TIMESTAMP) =====" | tee -a $(LOG_FILE)
	@cd $(LAYER) && $(1) 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | tee -a ../$(LOG_FILE); EXIT_CODE=$$?; \
	echo "===== $(CMD) END (EXIT: $$EXIT_CODE) =====" | tee -a ../$(LOG_FILE); \
	exit $$EXIT_CODE
endef

# Usage:
#   $(call run_with_log,terraform apply tf.plan)
```

Notes:
- `sed 's/\x1b\[[0-9;]*m//g'` strips ANSI color codes from the log file but leaves them on the terminal.
- `EXIT_CODE=$$?` captures the pipeline's exit code (works because of `pipefail`).
- The `cd $(LAYER) && ... ../$(LOG_FILE)` pattern keeps the log path relative to the project root when `$(LAYER)` is a sub-directory.

For a simpler one-liner logger:

```makefile
define log
	@mkdir -p $(LOG_DIR)
	@echo "[$(TIMESTAMP)] [$(NAMESPACE)] $(1)" | tee -a $(LOG_DIR)/deploy.log
endef

# Usage:
#   $(call log,Deploying app to $(NAMESPACE))
```

---

## 5. Optional argument expansion (foreach / ifdef)

```makefile
TARGET     ?=
VARS       ?=
EXTRA_ARGS ?=

VAR_ARGS := $(foreach v,$(VARS),-var $(v))

TARGET_ARG :=
ifdef TARGET
TARGET_ARG := -target=$(TARGET)
endif

# Usage:
#   make plan VARS="key1=value1 key2=value2" TARGET=module.vpc
.PHONY: plan
plan:
	terraform plan $(TARGET_ARG) $(VAR_ARGS) $(EXTRA_ARGS)
```

If `VARS=""`, `VAR_ARGS` is empty (not `-var`). If `TARGET=""`, no `-target` is appended. Both are safe to leave unset.

---

## 6. Conditional value-file flags

```makefile
VALUES_APP ?=
VALUES_DB  ?=

# `_vf_app` is empty if VALUES_APP is unset, otherwise expands to "-f path".
_vf_app = $(if $(VALUES_APP), -f $(VALUES_APP))
_vf_db  = $(if $(VALUES_DB),  -f $(VALUES_DB))

deploy-app:
	helm upgrade --install app charts/app -f base.yaml $(_vf_app)

deploy-db:
	helm upgrade --install db charts/db $(_vf_db)
```

Use `$(if ...,then,else)` for inline conditionals — much more readable than wrapping every flag in `ifdef`.

---

## 7. Layered `-include` for env files

```makefile
-include .env.sample              # baseline defaults (committed)
-include .env                     # local overrides (gitignored)
ifneq ($(INSTANCE),)
  -include envs/$(INSTANCE).env   # per-instance overrides
endif
export                             # export every variable to child processes
```

`-include` (with the leading dash) silently ignores missing files. Each include can override the previous; later wins. `export` (no args) exports *everything* — useful when calling `helm`/`kubectl`/scripts that read env vars.

---

## 8. Shared multi-step body via `define`

When two targets share a long sequence (e.g. two variants of `deploy-instance` that differ only in which app target to call):

```makefile
# $(1) is the app target name (e.g. deploy-app, deploy-app-v2)
define _deploy_instance_body
	@_total_start=$$(date +%s); \
	echo "[1/6] Namespace..."   ; $(MAKE) namespace      INSTANCE=$(INSTANCE); \
	echo "[2/6] Image secret..."; $(MAKE) secret         INSTANCE=$(INSTANCE); \
	echo "[3/6] TLS secret..."  ; $(MAKE) secret-tls     INSTANCE=$(INSTANCE); \
	echo "[4/6] Databases..."   ; $(MAKE) deploy-dbs     INSTANCE=$(INSTANCE); \
	echo "[5/6] Application..." ; $(MAKE) $(1)           INSTANCE=$(INSTANCE); \
	echo "[6/6] Ingress..."     ; $(MAKE) deploy-ingress INSTANCE=$(INSTANCE); \
	_total=$$(($$(date +%s) - _total_start)); \
	printf "TOTAL  %dm %ds\n" $$((_total/60)) $$((_total%60))
endef

.PHONY: deploy-instance deploy-instance-v2
deploy-instance:    ; $(call _deploy_instance_body,deploy-app)
deploy-instance-v2: ; $(call _deploy_instance_body,deploy-app-v2)
```

The `target: ; recipe` one-liner syntax keeps the dispatcher targets compact. `$(MAKE)` (not `make`) so flags propagate.

---

## 9. Per-step timing

```makefile
deploy-app:
	@_t=$$(date +%s); \
	echo "  Installing app chart..."; \
	helm upgrade --install app charts/app --wait --timeout 5m; \
	_d=$$(($$(date +%s) - _t)); \
	printf "           app ready  (%ds)\n" $$_d
```

`$$(date +%s)` runs in the recipe's shell (escape with `$$` so Make doesn't expand it). All `_t`, `_d` are shell-locals so they don't leak.

---

## 10. Confirmation gate (with CI bypass)

```makefile
.PHONY: apply
apply: backup-state
	@[ "$(CI)" = "true" ] || { \
		echo "⚠️  This requires explicit approval"; \
		read -p "Type 'approve' to continue: " approval; \
		[ "$$approval" = "approve" ] || (echo "❌ Cancelled"; exit 1); \
	}
	terraform apply tf.plan

.PHONY: destroy
destroy: backup-state
	@echo "🗑️  WARNING: This will DESTROY ENV=$(ENV)"
	@read -p "Type 'destroy-$(ENV)' to confirm: " confirm; \
	[ "$$confirm" = "destroy-$(ENV)" ] || (echo "❌ Cancelled"; exit 1)
	terraform destroy
```

The `destroy-$(ENV)` confirmation string ties the prompt to the environment so a copy-pasted "destroy-dev" can't accidentally destroy prod.

---

## 11. State backup with timestamp

```makefile
.PHONY: backup-state
backup-state: check-env
	@mkdir -p $(LAYER)/state/$(ENV)
	@echo "📦 Backing up state..."
	@cd $(LAYER) && \
	if terraform state pull > /dev/null 2>&1; then \
		terraform state pull > ../$(LAYER)/state/$(ENV)/terraform.tfstate.backup.$(TIMESTAMP); \
		echo "✅ Backed up: state/$(ENV)/terraform.tfstate.backup.$(TIMESTAMP)"; \
	else \
		echo "⚠️  State not initialized"; \
	fi
```

Always backup *before* `apply` / `destroy`. Make `backup-state` a prerequisite of those targets.

---

## 12. Generated files via `printf >>`

When you need to emit a YAML / JSON / config file from variables:

```makefile
GEN_VALUES_FILE := .generated-values.yaml

.PHONY: gen-values
gen-values:
	@printf 'env:\n'                                    > $(GEN_VALUES_FILE)
	@printf '  HOST: "%s"\n'      "$(HOST)"            >> $(GEN_VALUES_FILE)
	@printf '  DOMAIN: "%s"\n"'   "$(DOMAIN)"          >> $(GEN_VALUES_FILE)
	@if [ "$(OTEL_ENABLED)" = "true" ]; then \
		printf '  OTEL_SERVICE_NAME: "%s"\n' "$(SVC)"   >> $(GEN_VALUES_FILE); \
	fi
	@echo "Generated $(GEN_VALUES_FILE)"
```

Use single-quoted `printf '...'` so `\n` is literal. First write uses `>` (truncate), subsequent use `>>` (append). For complex YAML prefer a templating tool (`yq`, `gomplate`, `envsubst`) over inline `printf`.

---

## 13. Dispatch loop over directories / files

```makefile
.PHONY: list-instances
list-instances:
	@ls envs/*.env 2>/dev/null | sed 's|envs/||;s|\.env||' \
	  | awk '{print "  " $$0}' \
	  || echo "  (none)"

.PHONY: deploy-all-instances
deploy-all-instances:
	@for env_file in envs/*.env; do \
		instance=$$(basename $$env_file .env); \
		$(MAKE) deploy-instance INSTANCE=$$instance; \
	done
```

Auto-discover work units instead of hardcoding them. Use `$(MAKE)` so `-j` and `-n` propagate.

---

## 14. `$(eval ...)` to dispatch by parameter

```makefile
.PHONY: deploy-tier
deploy-tier:
	$(eval CHART := $(if $(filter $(TIER),db),db,$(if $(filter $(TIER),app),app,$(error TIER must be db or app))))
	helm upgrade --install $(CHART) charts/$(CHART)
```

For more than 2-3 branches, use a sub-target dispatch instead of nested `$(if)`:

```makefile
deploy-tier:
	$(MAKE) deploy-$(TIER)
deploy-db:
	@echo "deploying db..."
deploy-app:
	@echo "deploying app..."
```

---

## 15. Auto-help via grep + awk

```makefile
.PHONY: help
help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
```

Then on each target:

```makefile
.PHONY: deploy
deploy: validate apply  ## Full deployment (validate + apply)
```

The `## description` after the target line is auto-extracted. See `references/help-target.md` for grouped variants and longer help formats.
