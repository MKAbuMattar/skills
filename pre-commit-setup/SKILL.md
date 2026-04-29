---
name: pre-commit-setup
description: Set up cross-language pre-commit hooks for any git repository — auto-formatting, linting, type-checking, secret scanning, large-file detection, and Conventional Commit message checks. Detects which languages the repo uses (Node.js / TypeScript, Python, PHP, Java, Go, Rust, Ruby, Shell, generic) and wires the right hooks via the universal pre-commit framework, with an optional Husky + lint-staged + Prettier track for pure-Node repos. Use whenever the user wants to add pre-commit hooks, set up husky, install pre-commit, configure lint-staged, run formatting/linting/typecheck/tests on commit, scan for secrets at commit time, enforce conventional commits, or hits you with phrases like 'set up pre-commit', 'add husky', 'wire up commit hooks', 'block secrets at commit', 'make my repo lint on commit', or 'configure git hooks'.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Pre-commit setup

Wire pre-commit hooks into any git repo. Default to the universal `pre-commit` framework (works for any language); use Husky + lint-staged for pure-Node repos when the user explicitly asks. Always cover formatting, linting, type-checking (where applicable), secret scanning, and Conventional Commits.

## When to use

- The user asked to set up pre-commit hooks, install husky, configure lint-staged, or wire up commit-time checks.
- A new repo is being bootstrapped and you're standardizing the dev experience.
- An existing repo has commit-time issues (secrets leaked, lint fails after merge, large files committed) and the user wants prevention.
- A monorepo or polyglot repo needs a single pre-commit configuration that covers multiple languages.

Skip this skill for: repos that already have a working pre-commit configuration the user is happy with (touch only with explicit ask), build-time CI checks (those belong in CI, not pre-commit), or pre-push hooks (different lifecycle).

## Required outcome

After this runs, a fresh `git commit` in the repo must:

1. Auto-format staged files (Prettier / Black / gofmt / etc., per language).
2. Lint staged files (ESLint / Ruff / PHPStan / Checkstyle / golangci-lint / etc.).
3. Run type checks (where the language supports them).
4. Scan for secrets and large files.
5. Validate the commit message format (Conventional Commits).
6. Block the commit on any failure with a readable error.
7. Be fast — the full pre-commit run should be under ~10 seconds for typical changes.

## Workflow

1. **Verify a git repo.** `git rev-parse --is-inside-work-tree`. If not, ask whether to `git init` or stop.
2. **Detect languages.** Run `bash scripts/detect-languages.sh` or do the equivalent: check for `package.json`, `pyproject.toml` / `requirements.txt` / `setup.py`, `composer.json`, `pom.xml` / `build.gradle*`, `go.mod`, `Cargo.toml`, `Gemfile`, `*.sh` files. Multiple matches → multi-language.
3. **Pick the framework:**
   - **Default → universal `pre-commit` framework** (`pre-commit.com`). Works for any language, has thousands of hook integrations. Load `references/pre-commit-framework.md`.
   - **Pure-Node repo + user explicitly asked for Husky** → Husky + lint-staged + Prettier track. Load `references/husky-track.md`.
   - **Polyglot repo** → always pre-commit framework. Husky doesn't handle non-JS files cleanly.
4. **Pick the hooks per detected language.** Load `references/language-hooks.md` and copy the matching block(s) into `.pre-commit-config.yaml`. Cover formatter, linter, and type-checker per language.
5. **Add universal hooks.** Load `references/universal-hooks.md`. Always include trailing-whitespace, end-of-file-fixer, check-merge-conflict, check-added-large-files, check-yaml/json/toml (when present), and a secret scanner (`gitleaks` or `detect-secrets`).
6. **Add commit-msg hook.** Load `references/commit-msg.md`. Wire `commitlint` (Node) or `commitizen` (cross-language) for Conventional Commits.
7. **Install.** Run `pre-commit install` (writes `.git/hooks/pre-commit`) and `pre-commit install --hook-type commit-msg` (for the commit-msg hook). For Husky, `npx husky init`.
8. **Smoke test.** Run `pre-commit run --all-files` once. Expect the first run to fix formatting on existing files; that's normal. Re-run to confirm it's clean.
9. **Commit.** Stage the new config files and commit with a Conventional message: `chore: add pre-commit hooks (formatter, linter, secrets, conventional commits)`. The commit itself is the final smoke test.

## Available resources

- `references/pre-commit-framework.md` — universal `pre-commit` framework: install, `.pre-commit-config.yaml` syntax, common hooks, troubleshooting.
- `references/husky-track.md` — Node-only Husky + lint-staged + Prettier setup, plus the optional heavyweight variant that runs typecheck + tests on every commit.
- `references/language-hooks.md` — recommended formatter / linter / type-checker hooks per language: Node.js, Python, PHP, Java, Go, Rust, Ruby, Shell. Copy-paste blocks.
- `references/universal-hooks.md` — language-agnostic hooks: whitespace, EOF, large files, merge-conflict markers, JSON/YAML/TOML validation, secret scanners.
- `references/commit-msg.md` — Conventional Commits enforcement via `commitlint` or `commitizen`.
- `assets/templates/pre-commit-config-multi-language.yaml` — kitchen-sink config covering all languages this skill knows about.
- `assets/templates/pre-commit-config-minimal.yaml` — universal hooks only (whitespace, EOF, secrets, conventional commits) for unknown-language repos.
- `assets/templates/husky-pre-commit` — Husky v9 pre-commit script for Node repos.
- `assets/templates/lintstagedrc.json` — lint-staged config for the Husky track.
- `assets/templates/prettierrc.json` — Prettier defaults.
- `assets/examples/full-example.md` — worked setup on a polyglot repo.
- `scripts/detect-languages.sh` — detect what languages a repo uses; run before picking hooks.

## Top gotchas (always inline — do not skip)

- **Polyglot repo → use `pre-commit`, not Husky.** Husky + lint-staged works well for pure-JS, but fights non-JS files and doesn't have ecosystem coverage for Python / Java / PHP / Go. The `pre-commit` framework is the universal answer.
- **Detect first, configure second.** Do not paste a Python-only or Node-only template into a polyglot repo. Run the detection step or you'll ship hooks that fail loudly on every commit.
- **`pre-commit` is a Python tool, not a JS tool.** It runs hooks for *any* language, but it itself installs via `pip install pre-commit` (or `pipx`, or `brew install pre-commit`). Don't confuse it with Husky.
- **The first `pre-commit run --all-files` will modify existing files.** Formatters fix existing whitespace, EOF, formatting. That's expected — commit the auto-fixes, then re-run. The user should know this before you run it.
- **Pin hook versions.** Use `rev: v1.2.3` not `rev: main` in `.pre-commit-config.yaml`. `pre-commit autoupdate` is the maintenance command for bumping. Floating refs break repos when upstream changes.
- **Don't run full test suites in pre-commit.** Tests take too long; pre-commit should be < 10s. Tests belong in pre-push or CI. The heavyweight Husky variant runs `npm run test` in pre-commit; that's a trade-off the user should opt into, not a default.
- **Type-checking is repo-scoped, not file-scoped.** ESLint runs per-file, but `tsc`, `mypy`, and most type checkers need the whole project. Run them outside `lint-staged`'s file-scoping (top-level command), or accept that incremental mode misses some errors.
- **`gitleaks` and `detect-secrets` are not interchangeable.** `detect-secrets` requires a baseline file (`.secrets.baseline`) and only flags new secrets vs the baseline. `gitleaks` flags any secret matching its rules. Pick one and document the workflow — don't add both.
- **Conventional Commits enforcement is opinionated.** Some teams want it, some hate it. Default to enforcing it only when the user asked for it or when the repo already uses it (check existing commit messages with `git log --oneline -20`).
- **Hooks must work on Windows / WSL / macOS / Linux.** The `pre-commit` framework handles this; raw shell hooks in Husky don't. If you're writing a custom hook, use a portable shebang and POSIX shell, or pin it to one OS in the docs.
- **Do not bypass with `--no-verify` to "fix" failing hooks.** If hooks fail, fix the cause. The only legitimate `--no-verify` is for emergency hotfixes the user explicitly chooses.
- **The hook config file is the source of truth.** `.pre-commit-config.yaml` (or Husky's `.husky/pre-commit`) is what the team commits and reviews. Don't sneak hooks into local-only Git config.

## What you DO

1. Confirm it's a git repo before doing anything (`git rev-parse --is-inside-work-tree`).
2. Detect languages via `scripts/detect-languages.sh` or equivalent.
3. Default to the `pre-commit` framework. Use Husky only when the repo is pure-Node and the user asked for Husky by name.
4. Pick formatter + linter + (where applicable) type-checker for each detected language.
5. Add universal hooks: whitespace, EOF, large files, merge-conflict markers, JSON/YAML/TOML validation, secret scanner.
6. Add commit-msg hook for Conventional Commits when appropriate (see gotchas).
7. Pin all hook versions (`rev: v1.2.3`, never `main`).
8. Run `pre-commit run --all-files` once to surface and auto-fix the existing-file format drift.
9. Commit the new config with a Conventional message; that's the final smoke test.
10. Tell the user what's now blocked at commit and how to bypass for emergencies (`--no-verify`).

## What you do NOT do

- Do not paste a single-language template into a polyglot repo.
- Do not use Husky in a polyglot repo.
- Do not run full test suites in pre-commit (move to pre-push or CI).
- Do not add `gitleaks` and `detect-secrets` together — pick one.
- Do not use floating refs (`rev: main`, `rev: HEAD`) in `.pre-commit-config.yaml`.
- Do not silently overwrite an existing pre-commit config without showing the user the diff.
- Do not enforce Conventional Commits on a repo that doesn't use them, unless the user asked.
- Do not bypass failing hooks with `--no-verify` to "make it pass". Fix the underlying cause.
- Do not add tooling for languages the repo doesn't use.
- Do not introduce a Python dependency (`pre-commit`) into a Node-only repo if the user wants Husky — respect the explicit ask.
- Do not commit a `.pre-commit-config.yaml` without first running it once and verifying it's clean.
