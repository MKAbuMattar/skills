---
name: makefile-script-developer
description: Write production-ready GNU Makefiles with strict shell mode (`SHELL := /bin/bash` + `.SHELLFLAGS := -euo pipefail -c`), validated multi-environment configuration via `$(filter ...)`, pre-flight check targets (`check-tools`, `check-env`), structured logging with timestamps, confirmation gates for destructive ops, layered `.env` includes, platform detection, and self-documenting help. Use this skill whenever the user asks to write a Makefile, harden an existing one, add a target, build a deploy/release pipeline, automate Terraform/Helm/Kubernetes/Docker/build workflows, or expose tasks as `make <target>` — including casual phrasings like "write a Makefile", "add a make target", "automate this in make", "give me a build pipeline", or "clean up the Makefile". Also use when reviewing an existing Makefile for safety, error handling, or organization issues.
license: MIT. See LICENSE for full terms.
compatibility: GNU Make 3.81+ on Linux, macOS, or Windows (WSL/MSYS2/Git Bash). Generated Makefiles target the same range and assume `bash` is available — always set `SHELL := /bin/bash` so recipes get `pipefail`, `[[ ]]`, and arrays.
metadata:
  author: mkabumattar
  version: "1.0.0"
---

# Makefile Script Developer

Production-ready GNU Makefiles. Strict shell + validated env + logging + safety gates.

## When to use

- The user asks to write, scaffold, or harden a `Makefile`.
- The user wants to add or refactor a `make` target / workflow / build pipeline.
- The user wants to automate Terraform / Helm / kubectl / Docker / build / release through `make`.
- The user wants a self-documenting `help` target or wants to clean one up.
- A task chain ends in "and put it in a Makefile so I can run `make deploy ...`".

## Required structure

Every Makefile you write starts from this skeleton. Do not omit `SHELL := /bin/bash`, the `.SHELLFLAGS` line, or `.DEFAULT_GOAL := help`. **Recipes are TAB-indented, not spaces.**

```makefile
SHELL         := /bin/bash
.SHELLFLAGS   := -euo pipefail -c
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:
MAKEFLAGS     += --warn-undefined-variables --no-print-directory

# ---- Configuration --------------------------------------------------
ALLOWED_ENVS := dev staging prod
ENV          ?= dev
ifeq (,$(filter $(ENV),$(ALLOWED_ENVS)))
$(error ENV must be one of: $(ALLOWED_ENVS))
endif

TIMESTAMP := $(shell date +"%Y-%m-%d_%H-%M-%S")
LOG_DIR   := logs/$(ENV)

# ---- Pre-flight -----------------------------------------------------
.PHONY: check-tools
check-tools:
	@command -v terraform >/dev/null 2>&1 || { echo "terraform not installed"; exit 1; }
	@echo "Tools verified"

# ---- Help -----------------------------------------------------------
.PHONY: help
help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
```

## Workflow

1. **Pick a starting template** from `assets/templates/` — copy and edit, do not rewrite from scratch:
   - `simple.mk.template` — small build / lint / test Makefile.
   - `infrastructure.mk.template` — Terraform / multi-env with logging, state backup, rollback.
   - `helm-deploy.mk.template` — Helm install / upgrade / rollback / uninstall with timing.
   - `chart-package.mk.template` — Helm chart lint / package / push to OCI registry.
   - `binary-build.mk.template` — Cross-platform binary build with platform detection.
2. **Apply the patterns** in `references/patterns.md` for any non-obvious case (env validation, logging macros, `foreach` arg expansion, `$(eval CMD=...)` for per-recipe variables, layered `.env` includes, `define` macros for shared multi-step bodies). Read it on demand — don't preload it.
3. **For multi-environment workflows** (dev/staging/prod, multi-instance, multi-region, multi-layer), load `references/multi-env.md` — it covers `$(filter ...)` validation, per-env plan files, layered `-include .env` patterns, and instance auto-discovery from `envs/*.env`.
4. **For Helm / kubectl / Terraform recipes**, load `references/helm-kubectl-terraform.md` — it covers `helm upgrade --install --wait --timeout`, `helm-recover`/`helm-purge` for stuck releases, `kubectl delete pod --force --grace-period=0`, terraform plan/apply with state backup, and S3-compatible backend credential export.
5. **For self-documenting help targets**, load `references/help-target.md` — covers grep-based auto-help (`## comment`), grouped sections, and `make help` defaults.
6. **For cross-platform Makefiles** (Linux/macOS/Windows), load `references/cross-platform.md` — covers `uname` platform detection, separator differences (`:` vs `;`), exe suffix, BSD vs GNU sed.
7. **Cross-check anti-patterns** in `references/anti-patterns.md` before finishing — TAB vs spaces, `$$` vs `$`, missing `.PHONY`, recursive (`=`) vs simple (`:=`) assignment, unquoted `$(VAR)` in shell, missing `set -o pipefail`.
8. **Validate the result.** Run `bash scripts/validate-makefile.sh <your-Makefile>` — it grep-scans the file for shell strict mode, `.PHONY` declarations, help target, env validation, TAB indentation, `$$` usage in recipes, and confirmation gates on destructive ops. Aim for ≥ 90%.

## Available resources

- `assets/templates/simple.mk.template` — minimal lint / build / test Makefile.
- `assets/templates/infrastructure.mk.template` — Terraform-style multi-env with logging, state backup, rollback, confirmation gates.
- `assets/templates/helm-deploy.mk.template` — Helm install/upgrade/rollback/uninstall with per-step timing and stuck-release recovery.
- `assets/templates/chart-package.mk.template` — Helm chart lint/package/push to OCI registry.
- `assets/templates/binary-build.mk.template` — Cross-platform binary build with platform detection.
- `assets/examples/terraform-multi-env.mk` — full reference implementation (3-env, logging, backup, rollback, helm-recover).
- `scripts/validate-makefile.sh` — score a Makefile against the checklist (run after writing).
- `references/patterns.md` — load when implementing logging macros, foreach var expansion, `define` bodies, `$(eval)` per-recipe vars, layered `-include`.
- `references/anti-patterns.md` — load when reviewing or rewriting an existing Makefile.
- `references/multi-env.md` — load when handling dev/staging/prod, multi-instance, multi-region, or multi-layer setups.
- `references/helm-kubectl-terraform.md` — load when wrapping Helm / kubectl / Terraform in `make` targets.
- `references/help-target.md` — load when writing a self-documenting `help` target.
- `references/cross-platform.md` — load when targeting macOS or Windows alongside Linux.

## Top gotchas (always inline — do not skip)

- **Recipes are indented with a TAB, not spaces.** GNU make rejects space-indented recipes with `*** missing separator. Stop.` Configure your editor to keep tabs in `Makefile` files.
- **Use `$$` to escape `$` in recipes.** `$VAR` in a recipe is interpreted by Make first; write `$$VAR` to mean "shell variable" and `$(VAR)` for "Make variable". Single `$` followed by an unrecognized character silently expands to empty.
- **`SHELL := /bin/bash`, never the default `/bin/sh`.** Without it, `pipefail`, `[[ ]]`, process substitution, and arrays are unavailable. macOS and Alpine `/bin/sh` are dash-like — recipes that work locally will fail on CI.
- **`.SHELLFLAGS := -euo pipefail -c`** is the minimum. `-e` exits on error, `-u` on undefined vars, `-o pipefail` makes `cmd1 | cmd2` fail when `cmd1` fails. Without these, a failed step in a pipeline is silently swallowed.
- **Always declare non-file targets `.PHONY`.** Otherwise a stray local file named `deploy` or `clean` makes Make skip the recipe with "target is up to date".
- **`:=` (simple) vs `=` (recursive).** Use `:=` for almost everything — it expands once at parse time. `=` re-evaluates on every reference, which is slow and surprising (e.g. `TIMESTAMP = $(shell date)` regenerates the timestamp on every reference). Use `=` deliberately when you need lazy evaluation (e.g. `LOG_FILE = $(LOG_DIR)/$(CMD).log` where `CMD` is set per-target via `$(eval CMD=apply)`).
- **Validate `ENV` early with `$(filter ...)`.** `ifeq (,$(filter $(ENV),$(ALLOWED_ENVS)))` + `$(error ...)` halts before any side effects. Don't rely on a runtime `[ ... ] || exit 1` inside a recipe — it runs *after* dependencies.
- **Confirmation gates use `read -p` + check.** `[ "$$confirm" = "destroy-$(ENV)" ] || (echo "Cancelled"; exit 1)` — the `$(ENV)` ties the confirmation string to the environment so a copy-pasted prompt can't destroy prod by mistake.
- **Secrets in recipes**: prefix lines with `@` to suppress the echoed command, and never `echo $$SECRET`. Pull credentials from env vars or a `yq`-readable secrets file rather than hardcoding them; use `--password-stdin` instead of `-p` flags.
- **`make -j` is unsafe by default**: targets sharing `LOG_FILE` or temp files will clobber each other. Use `.NOTPARALLEL:` for workflows that must serialize, or generate per-target temp paths.
- **`$(MAKE)` not `make` for sub-invocations** — `$(MAKE)` propagates `-n`, `-j`, and `MAKEFLAGS`. Plain `make` starts a fresh process and breaks dry-run / parallel mode.
- **`shell` is evaluated at parse time.** `TIMESTAMP := $(shell date)` runs once when Make reads the file — that's usually what you want, but `find ... -delete` inside `$(shell ...)` will run before any target executes.

## What you DO

1. Start every Makefile from `assets/templates/`.
2. Set `SHELL := /bin/bash`, `.SHELLFLAGS := -euo pipefail -c`, `.DEFAULT_GOAL := help`, `.DELETE_ON_ERROR:`, and `MAKEFLAGS += --warn-undefined-variables --no-print-directory`.
3. Validate `ENV` (and any other enum input) up-front with `$(filter ...)` + `$(error ...)`.
4. Declare every non-file target as `.PHONY`.
5. Provide pre-flight `check-tools` / `check-env` / `check-state` targets and depend on them.
6. Use a `define run_with_log ... endef` macro to capture all output to `logs/<scope>/<env>/<cmd>_<timestamp>.log`.
7. Group related operations into composite workflow targets (`deploy: validate init plan apply`).
8. Add confirmation gates (`read -p "Type 'destroy-$(ENV)' to confirm"`) on destructive ops; bypass with `CI=true` for non-interactive runs.
9. Use `:=` (simple expansion) by default; reserve `=` for genuinely lazy values.
10. Use `$$` to refer to shell variables inside recipes; use `$(VAR)` for Make variables.
11. Write a `help` target with grouped sections and concrete examples; make it the `.DEFAULT_GOAL`.
12. Use `$(MAKE)` (not `make`) for sub-invocations.
13. Run `scripts/validate-makefile.sh` on the result; iterate until ≥ 90%.

## What you do NOT do

- Indent recipes with spaces, or rely on auto-detection.
- Forget `set -e` / `pipefail` and let pipe failures slip past silently.
- Skip `.PHONY` declarations on non-file targets.
- Use `=` (recursive) where `:=` (simple) would work — it bites later.
- Run destructive ops without a `read -p` confirmation, or without `CI=true` to bypass for automation.
- Leak secrets to logs (no `echo $$PASS`, no missing `@` on credential-bearing lines).
- Use `make` instead of `$(MAKE)` in recursive invocations.
- Hardcode `/home/<user>/...` or `/Users/<user>/...` — use relative paths or `$(CURDIR)`.
- Write a Makefile without a `help` target, or a `help` that just lists targets without examples.
- Mix multiple unrelated responsibilities in a single recipe (deploy + log-cleanup + notify) — split them and depend.
