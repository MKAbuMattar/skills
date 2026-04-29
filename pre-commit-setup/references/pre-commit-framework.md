# The `pre-commit` framework

Load this when setting up the universal `pre-commit` framework — the default path for any repo, especially polyglot ones. `pre-commit.com` is a Python tool that runs language-specific hooks before each commit; despite the name being a Python package, it works for any language.

## Install

The user's machine needs `pre-commit` installed. Install order of preference:

| Platform             | Command                                |
| -------------------- | -------------------------------------- |
| macOS (Homebrew)     | `brew install pre-commit`              |
| Linux (any pipx)     | `pipx install pre-commit`              |
| Linux (system pip)   | `pip install --user pre-commit`        |
| Inside a Python venv | `pip install pre-commit`               |
| Windows / cross-plat | `pipx install pre-commit` (after pipx) |

Verify: `pre-commit --version` — should print `pre-commit 3.x.x` or higher.

## Hook into git

From inside the repo:

```bash
pre-commit install                       # installs .git/hooks/pre-commit
pre-commit install --hook-type commit-msg  # if you're enforcing commit-msg
pre-commit install --hook-type pre-push    # optional: pre-push checks
```

This writes a small shim into `.git/hooks/pre-commit` that delegates to `pre-commit run`. The actual hook config lives in `.pre-commit-config.yaml` (committed to the repo).

## Config file: `.pre-commit-config.yaml`

Minimal example:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-merge-conflict
      - id: check-added-large-files
        args: ["--maxkb=500"]
```

Key fields:

- **`repo`** — Git URL of the hook source. Special value `local` for hooks defined in this repo.
- **`rev`** — Git ref to pin to. **Always pin to a tagged version** like `v4.6.0`. Never use `main` or `HEAD` — floating refs break reproducibility.
- **`hooks[].id`** — Which hook from that repo to run.
- **`hooks[].args`** — Extra CLI args.
- **`hooks[].files`** / **`exclude`** — Path patterns to scope the hook.
- **`hooks[].stages`** — When to run: `pre-commit` (default), `commit-msg`, `pre-push`, `manual`.
- **`hooks[].language_version`** — Pin Python/Node/Ruby version when needed.

## Common knobs

### Scope a hook to certain files

```yaml
- id: prettier
  files: \.(js|jsx|ts|tsx|json|md|yml|yaml|html|css)$
```

### Exclude generated paths

```yaml
exclude: |
  (?x)^(
    dist/.*|
    build/.*|
    .*\.min\.js|
    .*\.lock
  )$
```

`(?x)` enables verbose mode so you can use whitespace and comments inside the regex.

### Run a hook only manually

```yaml
- id: expensive-check
  stages: [manual]
```

Then run `pre-commit run expensive-check --all-files` on demand; it won't run on every commit.

### Use a local hook

```yaml
- repo: local
  hooks:
    - id: project-tests
      name: project tests
      entry: npm test
      language: system
      pass_filenames: false
      stages: [pre-push]
```

`language: system` means "use whatever's on PATH". `pass_filenames: false` is needed for whole-project commands like tests.

## Maintenance commands

| Goal                                         | Command                              |
| -------------------------------------------- | ------------------------------------ |
| Run all hooks against all files (smoke test) | `pre-commit run --all-files`         |
| Run all hooks against staged files only      | `pre-commit run`                     |
| Run one hook by id                           | `pre-commit run black`               |
| Bump hook versions to latest                 | `pre-commit autoupdate`              |
| Bump to a specific repo's latest tag         | `pre-commit autoupdate --repo <url>` |
| Clean cached hook environments               | `pre-commit clean`                   |
| Uninstall hooks                              | `pre-commit uninstall`               |
| Skip hooks for one commit (emergency only)   | `git commit --no-verify`             |
| Skip a single hook for one run               | `SKIP=eslint git commit -m "..."`    |

## Common errors and fixes

### "executable file not found"

The hook needs a runtime that isn't installed. Example: `golangci-lint` hook on a machine without Go. Fix: install the runtime, or add `language_version` to pin a known one.

### "Cowardly refusing to install hooks with `core.hooksPath` set"

The user has a custom hooks path set globally (often from a previous Husky setup or org config). Fix: `git config --unset-all core.hooksPath` or `pre-commit install --allow-missing-config`.

### Hooks pass locally but fail in CI

Pre-commit caches hook environments under `~/.cache/pre-commit/`. CI may not cache them. Add the CI cache dir to your CI config so `pre-commit run --all-files` doesn't re-clone every hook on every build.

### `autoupdate` introduces breaking changes

`pre-commit autoupdate` can pull in major-version bumps that break the config. Run it manually, then run `pre-commit run --all-files` and read the diff before committing the bump.

### "files were modified by this hook"

A formatter modified a staged file. The hook fails to signal the modification. Re-stage (`git add`) and commit again. This is normal on the first run after adding a new formatter.

## Performance tips

- **Use `files:` patterns** to scope hooks to relevant extensions. Running a Python linter on `.md` files wastes time.
- **Use `exclude:` for generated paths** like `dist/`, `build/`, `vendor/`, lockfiles.
- **Move slow checks to `pre-push` or `manual`.** Type-checking a 50k-LOC project on every commit is too slow; type-check on push or in CI.
- **Pin to small hook implementations** when possible. `ruff` for Python is faster than `flake8` + `isort` + `black` together.

## Why this is the default for polyglot repos

Husky shells out to `npm` scripts. `lint-staged` knows how to invoke JS tooling on staged files. Neither has native support for invoking, e.g., `phpstan`, `mypy`, `golangci-lint`, `checkstyle`. `pre-commit` does, and the language-isolation is built in (each hook gets its own env). For a repo that mixes Node + Python + Go, `pre-commit` is the only sane choice.
