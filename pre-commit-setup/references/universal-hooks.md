# Universal hooks

Load this for the language-agnostic hooks that should run on every commit regardless of what languages the repo contains. These catch the bugs that have nothing to do with code — accidentally committed secrets, large binaries, half-merged conflicts, mangled JSON.

## File hygiene

```yaml
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.6.0
  hooks:
    - id: trailing-whitespace
    - id: end-of-file-fixer
    - id: mixed-line-ending
      args: [--fix=lf]
    - id: check-merge-conflict
    - id: check-case-conflict
    - id: check-symlinks
    - id: destroyed-symlinks
```

What each does:

- **trailing-whitespace** — strips trailing spaces from lines.
- **end-of-file-fixer** — ensures files end with exactly one newline.
- **mixed-line-ending** — normalizes line endings (default to LF; use `--fix=crlf` only on Windows-only repos).
- **check-merge-conflict** — blocks commits containing `<<<<<<<`, `=======`, `>>>>>>>` markers.
- **check-case-conflict** — catches files that differ only in case (breaks on case-insensitive filesystems).
- **check-symlinks** — flags broken symlinks.
- **destroyed-symlinks** — flags symlinks that became regular files (a common bad merge).

## Large file detection

```yaml
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.6.0
  hooks:
    - id: check-added-large-files
      args: ["--maxkb=500"]
```

Default is 500 KB. Bump for repos that legitimately store images / fixtures (`--maxkb=2000`); never disable. For repos with large binaries, use Git LFS instead and set the threshold low.

## Structured-format validation

Add the ones the repo actually uses (skip the others):

```yaml
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.6.0
  hooks:
    - id: check-json
    - id: check-yaml
      args: [--unsafe] # allows custom tags (e.g., GitLab CI, K8s manifests)
    - id: check-toml
    - id: check-xml
    - id: pretty-format-json
      args: [--autofix, --indent=2, --no-sort-keys]
```

`--unsafe` for `check-yaml` is needed because many CI / infra YAML files use custom tags that strict YAML parsers reject. The hook still catches actual syntax errors.

## Secret scanners

Pick **one**, not both. They overlap and adding both creates double-runs without extra value.

### Option A: gitleaks (recommended, no baseline)

```yaml
- repo: https://github.com/gitleaks/gitleaks
  rev: v8.18.4
  hooks:
    - id: gitleaks
```

Runs on every commit. Catches API keys, tokens, private keys, etc., across many providers. No baseline file needed; flags any match.

To allow a known-safe match (e.g., a test fixture), add an inline allowlist comment:

```python
# gitleaks:allow
TEST_API_KEY = "sk_test_xyz"
```

Or configure exclusions in `.gitleaks.toml`.

### Option B: detect-secrets (with baseline)

```yaml
- repo: https://github.com/Yelp/detect-secrets
  rev: v1.5.0
  hooks:
    - id: detect-secrets
      args: ["--baseline", ".secrets.baseline"]
      exclude: package-lock\.json|pnpm-lock\.yaml|yarn\.lock
```

Setup:

```bash
pip install detect-secrets
detect-secrets scan > .secrets.baseline
git add .secrets.baseline
```

Only flags **new** secrets vs the baseline. Use this when the repo already contains acceptable matches (test fixtures, example configs) and you want to grandfather them.

## Private-key detection

```yaml
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.6.0
  hooks:
    - id: detect-private-key
```

Catches `BEGIN RSA PRIVATE KEY`, `BEGIN OPENSSH PRIVATE KEY`, etc. Run alongside the secret scanner — it's cheap and catches the obvious cases.

## AWS credentials

```yaml
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.6.0
  hooks:
    - id: detect-aws-credentials
      args: ["--allow-missing-credentials"]
```

`--allow-missing-credentials` lets the hook run even when the developer has no AWS config locally; otherwise it errors on missing config rather than missing credentials.

## Markdown / docs

```yaml
- repo: https://github.com/igorshubovych/markdownlint-cli
  rev: v0.42.0
  hooks:
    - id: markdownlint
      args: ["--disable", "MD013", "MD041", "--"] # disable line-length and h1-must-be-first
```

Adjust the `--disable` list to whatever rules the team finds noise.

## Spell check (optional)

```yaml
- repo: https://github.com/crate-ci/typos
  rev: v1.24.6
  hooks:
    - id: typos
```

`typos` is the modern, fast spell-checker designed for code. Catches things like `recieve`, `lenght`, `seperate`. Configure exclusions in `_typos.toml` for project-specific terminology.

## Combining

A typical `.pre-commit-config.yaml` opens with the universal block:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-merge-conflict
      - id: check-case-conflict
      - id: check-added-large-files
        args: ["--maxkb=500"]
      - id: check-json
      - id: check-yaml
        args: [--unsafe]
      - id: check-toml
      - id: detect-private-key

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks

  # ... language-specific blocks below
```

Then language blocks from `language-hooks.md`, then commit-msg from `commit-msg.md`.
