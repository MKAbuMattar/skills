# Help Target Patterns

Three styles of self-documenting `help` target. Pick one based on Makefile size.

---

## Style 1: Auto-extract (`## comment`) — small/medium Makefiles

Each documented target adds `## description` after the colon-list:

```makefile
.PHONY: build test deploy clean help

build:        ## Compile the application
	go build -o app .

test:         ## Run unit tests
	go test ./...

deploy: build ## Build and deploy to dev
	./scripts/deploy.sh

clean:        ## Remove build artifacts
	rm -rf dist/

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
```

Output:
```
  build           Compile the application
  test            Run unit tests
  deploy          Build and deploy to dev
  clean           Remove build artifacts
  help            Show this help
```

Notes:
- `grep -E '^[a-zA-Z_-]+:.*?## .*$$'` matches `targetname: deps ## description`.
- `$(MAKEFILE_LIST)` is the list of all loaded Makefiles (including `-include`s).
- The `\033[36m` / `\033[0m` is cyan + reset; for clean output, drop the codes.
- Adjust `%-15s` to the longest target name in your file.

---

## Style 2: Grouped sections — large Makefiles with many targets

When a flat list is too long, group manually:

```makefile
.PHONY: help
help:
	@echo ""
	@echo "============================================================"
	@echo "  Project — Available Commands"
	@echo "============================================================"
	@echo ""
	@echo "ENVIRONMENT:"
	@echo "  ENV must be one of: dev | staging | prod (default: dev)"
	@echo ""
	@echo "====== QUICK WORKFLOWS (Recommended) ======"
	@echo "  make deploy ENV=dev          - Full deployment to dev"
	@echo "  make dry-run ENV=dev         - Plan-only (no changes)"
	@echo "  make safe-apply ENV=dev      - Apply with state backup"
	@echo "  make rollback ENV=dev        - Rollback to latest backup"
	@echo ""
	@echo "====== INDIVIDUAL COMMANDS ======"
	@echo "  make init ENV=dev            - Initialize backend"
	@echo "  make plan ENV=dev            - Generate plan"
	@echo "  make apply ENV=dev           - Apply changes"
	@echo "  make destroy ENV=dev         - Destroy resources"
	@echo ""
	@echo "====== STATE MANAGEMENT ======"
	@echo "  make state-list ENV=dev      - List resources"
	@echo "  make state-show ENV=dev RESOURCE=module.x"
	@echo "  make backup-state ENV=dev    - Backup current state"
	@echo ""
	@echo "====== ADVANCED USAGE ======"
	@echo "  Target a specific resource:"
	@echo "    make apply ENV=dev TARGET=module.service"
	@echo ""
	@echo "  Pass variables:"
	@echo "    make apply ENV=dev VARS=\"key=value\""
	@echo ""
	@echo "  CI/CD mode (skip confirmation):"
	@echo "    CI=true make apply ENV=prod"
	@echo ""
	@echo "============================================================"
	@echo ""
```

Pros: total control over ordering, grouping, and examples.
Cons: must hand-update on every new target. Easy to drift out of sync.

---

## Style 3: Hybrid — auto-extract + grouping headers

Keep the auto-extract loop but add visual section headers via `##@` markers:

```makefile
##@ Build

build:    ## Compile the application
	go build -o app .

test:     ## Run unit tests
	go test ./...

##@ Deploy

deploy: build  ## Deploy to dev
	./scripts/deploy.sh

destroy:  ## Destroy infrastructure
	terraform destroy

##@ Helpers

clean:    ## Remove build artifacts
	rm -rf dist/

help:  ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make \033[36m<target>\033[0m\n"} \
	  /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } \
	  /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
```

Output:
```
Usage:
  make <target>

Build
  build           Compile the application
  test            Run unit tests

Deploy
  deploy          Deploy to dev
  destroy         Destroy infrastructure

Helpers
  clean           Remove build artifacts
  help            Show this help
```

Best of both: cheap to maintain, clear groupings.

---

## Help target conventions

1. **Make `help` the `.DEFAULT_GOAL`** so bare `make` shows it:
   ```makefile
   .DEFAULT_GOAL := help
   ```
2. **Show variable defaults** at the top of grouped help so users know what's tunable:
   ```
   VARIABLES:
     ENV     (default: dev)  | dev | staging | prod
     LAYER   (default: app)  | bootstrap | shared | app
   ```
3. **Include concrete examples** — at least 2-3 — for the most common workflows:
   ```
   EXAMPLES:
     make deploy ENV=dev LAYER=app
     make rollback ENV=prod LAYER=app
     CI=true make apply ENV=staging LAYER=app
   ```
4. **Document where logs live**:
   ```
   LOGS:
     logs/<layer>/<env>/<command>_<timestamp>.log
   ```
5. **Don't document every internal helper** — `_log`, `_check_pod_status`, etc. don't need a `##` description; they shouldn't be user-facing.
