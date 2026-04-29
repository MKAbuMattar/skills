# Full example: pre-commit setup on a polyglot repo

This walks through wiring `pre-commit` into a repo that contains a Node.js frontend, a Python API, and a few shell scripts. The same flow works for any combination of languages this skill supports.

---

## Repo state at start

```
repo/
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/...
├── api/
│   ├── pyproject.toml
│   └── src/...
├── scripts/
│   ├── deploy.sh
│   └── seed-db.sh
├── README.md
└── .gitignore
```

No `.pre-commit-config.yaml`, no `.husky/`, no commit hooks of any kind.

---

## Step 1: Verify the workspace

```bash
git rev-parse --is-inside-work-tree
# true
```

It's a git repo. Continue.

---

## Step 2: Detect languages

```bash
bash scripts/detect-languages.sh
# node python shell markdown
```

Polyglot. **Use the `pre-commit` framework, not Husky.**

---

## Step 3: Install `pre-commit`

The user is on macOS:

```bash
brew install pre-commit
pre-commit --version
# pre-commit 3.8.0
```

(On Linux, `pipx install pre-commit`. Inside a Python venv, `pip install pre-commit`.)

---

## Step 4: Write `.pre-commit-config.yaml`

Start from `assets/templates/pre-commit-config-multi-language.yaml`, strip out the languages we don't have (Go, Rust, Ruby, Java, PHP, Terraform), keep Node + Python + Shell + Markdown + universal blocks. Result:

```yaml
repos:
  # Universal hygiene
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: mixed-line-ending
        args: [--fix=lf]
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

  # Node / TypeScript (frontend/)
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        files: \.(js|jsx|ts|tsx|json|md|yml|yaml|html|css|scss)$

  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v9.10.0
    hooks:
      - id: eslint
        files: ^frontend/.*\.(js|jsx|ts|tsx)$
        types: [file]
        additional_dependencies:
          - eslint@9.10.0
          - typescript-eslint@8.6.0

  # Python (api/)
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
        files: ^api/.*\.py$
      - id: ruff-format
        files: ^api/.*\.py$

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.2
    hooks:
      - id: mypy
        files: ^api/.*\.py$
        args: [--ignore-missing-imports]
        stages: [pre-push]

  # Shell (scripts/)
  - repo: https://github.com/scop/pre-commit-shfmt
    rev: v3.9.0-1
    hooks:
      - id: shfmt
        args: [-i, "2", -ci, -w]

  - repo: https://github.com/koalaman/shellcheck-precommit
    rev: v0.10.0
    hooks:
      - id: shellcheck
        args: [--severity=warning]

  # Markdown
  - repo: https://github.com/igorshubovych/markdownlint-cli
    rev: v0.42.0
    hooks:
      - id: markdownlint
        args: ["--disable", "MD013", "MD041", "--"]

  # Conventional Commits
  - repo: https://github.com/commitizen-tools/commitizen
    rev: v3.29.1
    hooks:
      - id: commitizen
        stages: [commit-msg]

exclude: |
  (?x)^(
    frontend/dist/.*|
    frontend/.next/.*|
    frontend/node_modules/.*|
    api/.venv/.*|
    .*\.min\.(js|css)|
    package-lock\.json|
    pnpm-lock\.yaml
  )$
```

Notes on the choices:

- ESLint and Ruff are scoped with `files:` patterns so the Node linter doesn't try to lint Python files (and vice versa).
- `mypy` and `tsc`-equivalent type-checking would be too slow for every commit; mypy is set to `stages: [pre-push]` instead.
- Frontend/TypeScript type-checking via `tsc --noEmit` would go in a `local` hook on `stages: [pre-push]` if the team wants it.
- `gitleaks` (not `detect-secrets`) — no baseline file needed, less ceremony.

---

## Step 5: Install the hooks

```bash
pre-commit install
# pre-commit installed at .git/hooks/pre-commit

pre-commit install --hook-type commit-msg
# pre-commit installed at .git/hooks/commit-msg
```

---

## Step 6: First smoke test

```bash
pre-commit run --all-files
```

First run output (representative — formatters fix existing drift):

```
trim trailing whitespace.................................................Passed
fix end of files.........................................................Failed
- hook id: end-of-file-fixer
- exit code: 1
- files were modified by this hook

Fixing scripts/seed-db.sh
Fixing api/src/health.py

mixed line ending........................................................Passed
check for merge conflicts................................................Passed
...
prettier.................................................................Failed
- files were modified by this hook

frontend/src/App.tsx
frontend/src/lib/format.ts

ruff.....................................................................Failed
- exit code: 1
- files were modified by this hook

api/src/routes/users.py:14:5: F401 [*] `os` imported but unused
Found 1 error (1 fixed, 0 remaining).
```

This is normal and expected. Re-stage the auto-fixes and run again:

```bash
git add -A
pre-commit run --all-files
```

Now everything should pass:

```
trim trailing whitespace.................................................Passed
fix end of files.........................................................Passed
prettier.................................................................Passed
ruff.....................................................................Passed
ruff-format..............................................................Passed
shfmt....................................................................Passed
shellcheck...............................................................Passed
markdownlint.............................................................Passed
gitleaks.................................................................Passed
detect-private-key.......................................................Passed
```

---

## Step 7: Commit the new config

```bash
git add .pre-commit-config.yaml
git commit -m "chore: add pre-commit hooks (formatter, linter, secrets, conventional commits)"
```

The commit goes through the new hooks (which is the final smoke test) — they all pass, the commit-msg passes Conventional Commits validation, and `chore: add pre-commit hooks…` lands.

---

## Step 8: Tell the user what's now blocked

> Pre-commit hooks are wired up. From now on, every commit will:
>
> - Auto-format JS/TS, Python, and Shell files.
> - Lint JS/TS (ESLint) and Python (Ruff).
> - Block commits containing secrets (gitleaks), private keys, AWS creds, large files (>500 KB), merge-conflict markers, or invalid JSON/YAML/TOML.
> - Require Conventional Commit message format.
>
> Slower checks (mypy type-checking) run on `git push`, not every commit.
>
> Emergency bypass: `git commit --no-verify`. Use sparingly.
>
> To bump hook versions later: `pre-commit autoupdate`. Then `pre-commit run --all-files` and read the diff before committing.

---

## What this example skipped (and why)

- **Husky.** The repo has a Python service, so Husky isn't the right choice — `pre-commit` handles all three languages.
- **A test runner in pre-commit.** Tests take too long; those belong in pre-push or CI.
- **`detect-secrets` baseline.** `gitleaks` is simpler when there's no need to grandfather existing matches.
- **Spell-check (`typos`).** Optional, useful for prose-heavy repos; left out of this example for brevity.

---

## What changes for a different language mix

| Stack                        | What changes                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Pure Node + user wants Husky | Use the Husky track from `references/husky-track.md`. No `.pre-commit-config.yaml`.                              |
| Pure Python                  | Strip Node + Shell blocks. Keep universal + Ruff + mypy + commit-msg.                                            |
| Java + Go + PHP              | Strip Node/Python/Shell. Keep universal + the three Java/Go/PHP blocks. Local hooks for Maven/Composer commands. |
| Docs-only repo               | Use `pre-commit-config-minimal.yaml` — universal hygiene + secrets only.                                         |
| Add Terraform later          | Append the Terraform block from `language-hooks.md`. Run `pre-commit install` again is not needed.               |
