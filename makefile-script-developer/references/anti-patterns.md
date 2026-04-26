# Makefile Anti-Patterns

Common mistakes that look harmless but bite later. Each entry shows the bad version, the fix, and how to spot it.

---

## 1. Spaces instead of tabs

```makefile
build:
    gcc -o app main.c    # ❌ four spaces — Make rejects with "missing separator"
```

**Fix:** indent recipes with a single TAB. Configure your editor:

```jsonc
// .editorconfig
[Makefile]
indent_style = tab
```

**Detection:** `grep -nP "^[ ]+[a-z]" Makefile` finds space-indented recipes.

---

## 2. `$VAR` instead of `$$VAR` in recipes

```makefile
deploy:
	@for f in $FILES; do echo $f; done   # ❌ Make eats the $; loop body sees empty f
```

`$F` is interpreted by Make as variable `F` (almost certainly empty), then by the shell. Result: silent no-op.

```makefile
deploy:
	@for f in $$FILES; do echo $$f; done   # ✅ shell-side $f
	@echo $(VAR)                           # ✅ Make-side $(VAR)
```

**Detection:** `grep -nE '\$[A-Za-z_]' Makefile | grep -v '\$\$' | grep -v '\$('` finds bare `$X` references.

---

## 3. Missing `.PHONY`

```makefile
build:                  # ❌ if a file named 'build' exists, this is skipped
	go build -o app
```

```makefile
.PHONY: build
build:
	go build -o app
```

**Detection:** every non-file target should appear in a `.PHONY` declaration. Look for targets like `clean`, `deploy`, `test`, `help` without one.

---

## 4. Recursive (`=`) where simple (`:=`) was meant

```makefile
TIMESTAMP = $(shell date +"%H:%M:%S")    # ❌ regenerates on every reference

deploy:
	@echo "Start: $(TIMESTAMP)"
	@sleep 2
	@echo "End:   $(TIMESTAMP)"           # different value than Start
```

```makefile
TIMESTAMP := $(shell date +"%H:%M:%S")   # ✅ evaluated once at parse time
```

Use `=` only when you genuinely need lazy evaluation — usually for variables that depend on per-target `$(eval ...)` assignments.

**Detection:** `grep -E '^[A-Z_]+ = \$\(shell' Makefile` finds expensive recursive shell calls.

---

## 5. Forgetting `pipefail`

```makefile
SHELL := /bin/bash
# .SHELLFLAGS not set — defaults to `-c`

deploy:
	terraform plan | grep "create"   # ❌ if terraform fails, grep still succeeds, recipe passes
```

```makefile
.SHELLFLAGS := -euo pipefail -c

deploy:
	terraform plan | grep "create"   # ✅ pipeline fails if terraform fails
```

**Detection:** check the file header. Anything other than `-euo pipefail -c` is suspect.

---

## 6. Silent failures from missing `set -e`

```makefile
SHELL := /bin/bash
# .SHELLFLAGS not set — Make calls /bin/bash -c "..." without -e, so the recipe
# continues past failures within the same line.

deploy:
	cd build/                # ❌ if cd fails, the next line still runs in cwd
	rm -rf *                 # 🔥 deletes Makefile root
```

```makefile
.SHELLFLAGS := -euo pipefail -c
```

Makefile shell semantics: each *line* of a recipe is its own shell invocation. `set -e` only matters when a single line has multiple commands joined by `;` or `&&` — but you do hit that constantly with multi-line escapes (`\` continuations).

---

## 7. `make` instead of `$(MAKE)`

```makefile
deploy-all:
	make deploy ENV=dev      # ❌ new make process, doesn't propagate -j / -n / MAKEFLAGS
	make deploy ENV=staging
```

```makefile
deploy-all:
	$(MAKE) deploy ENV=dev   # ✅ propagates flags
	$(MAKE) deploy ENV=staging
```

**Detection:** `grep -nE '\bmake\b' Makefile | grep -v '\$(MAKE)'` finds bare `make` calls.

---

## 8. Unconditional ANSI / emojis breaking CI logs

```makefile
deploy:
	@echo -e "\033[32m✅ Deploy complete\033[0m"
```

Looks great in a terminal, garbage in `cron` / Jenkins / a piped log. If you must, gate on TTY:

```makefile
deploy:
	@if [ -t 1 ]; then echo -e "\033[32m✅ Deploy complete\033[0m"; else echo "Deploy complete"; fi
```

Or just stick to plain ASCII / unicode and let users grep what they want.

---

## 9. Confirmation prompt without `read -p`

```makefile
destroy:
	@echo "About to destroy. Cancel within 10s..."
	@sleep 10                # ❌ no real gate — accidental ENTER does it anyway
	terraform destroy
```

```makefile
destroy:
	@read -p "Type 'destroy-$(ENV)' to confirm: " confirm; \
	[ "$$confirm" = "destroy-$(ENV)" ] || (echo "Cancelled"; exit 1)
	terraform destroy
```

Tying the confirmation string to `$(ENV)` prevents copy-paste muscle memory from destroying prod.

---

## 10. Hardcoded paths that aren't portable

```makefile
deploy:
	cp /home/alice/secrets/key.pem .   # ❌ only works on alice's box
```

```makefile
SECRETS_DIR ?= $(CURDIR)/secrets

deploy:
	cp $(SECRETS_DIR)/key.pem .
```

Use `$(CURDIR)` for the Makefile directory, `$(HOME)` for the user's home, env vars for everything else.

---

## 11. No quoting around `$$VAR` in shell

```makefile
deploy:
	@if [ $$ENV = prod ]; then ...    # ❌ unquoted; breaks if ENV is empty
```

```makefile
deploy:
	@if [ "$$ENV" = "prod" ]; then ...   # ✅ always quote
```

Inside a recipe you're writing bash. Same quoting rules as bash apply (see `linux-script-developer` skill for the full set).

---

## 12. Modifying the working directory across recipes

```makefile
init:
	cd terraform/             # ❌ this cd only affects THIS line of THIS recipe
	terraform init            # this runs in the original cwd

# Each recipe line is a fresh shell. Bare `cd` doesn't persist.
```

```makefile
init:
	cd terraform/ && terraform init    # ✅ same shell, same line
```

Or:

```makefile
init:
	$(MAKE) -C terraform/ init        # delegate to terraform/Makefile
```

---

## 13. Echoing secrets

```makefile
push:
	docker login -u $(USER) -p $(PASS) registry.example.com   # ❌ command echoed; PASS in logs
```

```makefile
push:
	@docker login -u $(USER) -p "$$DOCKER_PASS" registry.example.com   # ✅ @ suppresses echo, env-var lookup
```

Combine:
- Lead with `@` to suppress the echo.
- Pull secrets from env vars, not Make variables (so they aren't expanded into the visible recipe).
- Never `echo $$DOCKER_PASS` for "debugging".

---

## 14. Single huge recipe doing five things

```makefile
deploy:
	go build -o app .
	docker build -t app .
	docker push app
	kubectl apply -f deploy.yaml
	kubectl rollout status deploy/app
	# everything in one target — can't re-run a single step
```

```makefile
.PHONY: build image push apply rollout deploy
build:    ; go build -o app .
image:    ; docker build -t app .
push:     ; docker push app
apply:    ; kubectl apply -f deploy.yaml
rollout:  ; kubectl rollout status deploy/app

deploy: build image push apply rollout
```

Now `make image` rebuilds without re-pushing; `make rollout` re-checks status without rebuilding.

---

## 15. Using `make` parallelism without `.NOTPARALLEL` for ordered targets

```makefile
deploy: backup-state apply
# user runs `make -j4 deploy` → backup-state and apply race
```

```makefile
.NOTPARALLEL: deploy backup-state apply
deploy: backup-state apply
```

Or restructure so dependencies enforce serialization (which they should — but `apply` should depend on `backup-state` *being done*, not just both being scheduled).

---

## 16. Forgetting the `@` prefix

Without `@`, every recipe line echoes its command before running. For workflow output that's noise:

```makefile
deploy:
	echo "🚀 Deploying..."        # echoes "echo "🚀 Deploying..." then "🚀 Deploying..."
```

```makefile
deploy:
	@echo "🚀 Deploying..."        # echoes only "🚀 Deploying..."
```

Use `@` for messages and credential-bearing commands. Leave it off for lines whose output you actually want logged (e.g. `terraform apply`).
