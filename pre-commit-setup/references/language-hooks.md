# Language hooks

Load this when picking which hooks to add for each detected language. Each section is a copy-paste block for `.pre-commit-config.yaml`. Pin all `rev:` values when you copy — the values shown are reasonable as of late 2025; run `pre-commit autoupdate` after copying to bump to the latest.

## Node.js / TypeScript

Formatter (Prettier), linter (ESLint), type-checker (`tsc`).

```yaml
- repo: https://github.com/pre-commit/mirrors-prettier
  rev: v3.1.0
  hooks:
    - id: prettier
      files: \.(js|jsx|ts|tsx|json|md|yml|yaml|html|css|scss)$

- repo: https://github.com/pre-commit/mirrors-eslint
  rev: v9.10.0
  hooks:
    - id: eslint
      files: \.(js|jsx|ts|tsx)$
      types: [file]
      additional_dependencies:
        - eslint@9.10.0
        - typescript-eslint@8.6.0

- repo: local
  hooks:
    - id: tsc
      name: typecheck (tsc)
      entry: npx tsc --noEmit
      language: system
      pass_filenames: false
      types: [ts]
      stages: [pre-push] # too slow for pre-commit; runs on push instead
```

**Why local for `tsc`:** `tsc --noEmit` is project-scoped; per-file mode misses cross-file errors. Pre-push is the right lifecycle.

## Python

Formatter (Black or Ruff-format), linter (Ruff), type-checker (Mypy). Ruff is the modern unified tool — prefer it over Black + Flake8 + isort separately.

```yaml
- repo: https://github.com/astral-sh/ruff-pre-commit
  rev: v0.6.9
  hooks:
    - id: ruff # linter
      args: [--fix]
    - id: ruff-format # formatter

- repo: https://github.com/pre-commit/mirrors-mypy
  rev: v1.11.2
  hooks:
    - id: mypy
      additional_dependencies:
        - types-requests
        - pydantic
      args: [--ignore-missing-imports]
      stages: [pre-push] # type-check on push, not on every commit
```

If the project still uses Black + isort + Flake8 (legacy), use those instead — but recommend migrating to Ruff.

## PHP

Formatter (PHP-CS-Fixer), static analysis (PHPStan or Psalm).

```yaml
- repo: local
  hooks:
    - id: php-cs-fixer
      name: PHP CS Fixer
      entry: vendor/bin/php-cs-fixer fix
      language: system
      types: [php]
      pass_filenames: true

    - id: phpstan
      name: PHPStan
      entry: vendor/bin/phpstan analyse --no-progress --error-format=raw
      language: system
      types: [php]
      pass_filenames: false
      stages: [pre-push]
```

**Prerequisite:** `composer require --dev friendsofphp/php-cs-fixer phpstan/phpstan` and a `phpstan.neon` config file.

## Java

Formatter (google-java-format), static analysis (Checkstyle, SpotBugs).

```yaml
- repo: https://github.com/macisamuele/language-formatters-pre-commit-hooks
  rev: v2.14.0
  hooks:
    - id: pretty-format-java
      args: [--autofix, --aosp]

- repo: local
  hooks:
    - id: checkstyle
      name: Checkstyle
      entry: ./gradlew checkstyleMain
      language: system
      types: [java]
      pass_filenames: false
      stages: [pre-push]
```

For Maven projects, swap `./gradlew checkstyleMain` for `mvn checkstyle:check`. SpotBugs / PMD plug in similarly.

## Go

Formatter (gofmt or goimports), linter (golangci-lint).

```yaml
- repo: https://github.com/dnephin/pre-commit-golang
  rev: v0.5.1
  hooks:
    - id: go-fmt
    - id: go-imports
    - id: golangci-lint

- repo: local
  hooks:
    - id: go-vet
      name: go vet
      entry: go vet ./...
      language: system
      types: [go]
      pass_filenames: false
      stages: [pre-push]
```

`golangci-lint` runs many linters in one binary — it's the standard. Install: `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`.

## Rust

Formatter (rustfmt), linter (clippy).

```yaml
- repo: https://github.com/doublify/pre-commit-rust
  rev: v1.0
  hooks:
    - id: fmt
    - id: clippy
      args: ["--", "-D", "warnings"]
```

`-D warnings` upgrades clippy warnings to errors. Adjust if the project tolerates warnings during development.

## Ruby

Formatter + linter (RuboCop covers both).

```yaml
- repo: https://github.com/rubocop/rubocop
  rev: v1.66.1
  hooks:
    - id: rubocop
      args: [--autocorrect]
```

## Shell

Formatter (shfmt), linter (shellcheck).

```yaml
- repo: https://github.com/scop/pre-commit-shfmt
  rev: v3.9.0-1
  hooks:
    - id: shfmt
      args: [-i, "2", -ci, -w] # 2-space indent, indent case, write in place

- repo: https://github.com/koalaman/shellcheck-precommit
  rev: v0.10.0
  hooks:
    - id: shellcheck
      args: [--severity=warning]
```

## Terraform / HCL

```yaml
- repo: https://github.com/antonbabenko/pre-commit-terraform
  rev: v1.96.1
  hooks:
    - id: terraform_fmt
    - id: terraform_validate
    - id: terraform_tflint
```

## YAML / JSON / TOML / Markdown

These are covered by the universal hooks in `universal-hooks.md` (validation) and the language formatters above (Prettier handles JSON/YAML/MD; Ruff handles TOML; etc.).

## Multi-language repos

Concatenate the relevant blocks. The `pre-commit` framework runs each hook in its own isolated environment, so mixing Python + Node + Go hooks doesn't cause version conflicts. See `assets/templates/pre-commit-config-multi-language.yaml` for a kitchen-sink config.

## When a language has no community hook

Use a `local` hook that shells out to whatever the project already uses:

```yaml
- repo: local
  hooks:
    - id: my-formatter
      name: my formatter
      entry: ./scripts/format.sh
      language: system
      types: [<file-type>]
```

Document the prerequisite (which binary needs to be on PATH) in the project README.
