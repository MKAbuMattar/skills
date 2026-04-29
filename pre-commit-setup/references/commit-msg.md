# Commit-message hooks (Conventional Commits)

Load this when adding Conventional Commits enforcement to a repo. Skip if the repo doesn't use Conventional Commits and the user didn't ask for it — enforcing a commit-message format on a team that doesn't use one will block their work and annoy them.

## When to enforce

Add a commit-msg hook when:

- The user explicitly asked for Conventional Commits.
- The repo already uses them (check: `git log --oneline -20` — do most lines start with `feat:`, `fix:`, `chore:`, etc.?).
- The repo uses semantic-release / changesets / release-please / similar tooling that requires the format.

Do not add when:

- The team is mid-migration to a different convention.
- The repo is in early prototype stage and commit hygiene isn't a priority.
- The user pushed back when you suggested it.

## What Conventional Commits looks like

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Examples:

- `feat: add password-reset endpoint`
- `fix(auth): reject expired tokens with 401, not 500`
- `chore: bump pre-commit hooks`
- `feat!: remove deprecated v1 API` (breaking change)
- `docs(readme): clarify install steps`

Standard types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`.

## Enforcement: `commitlint` (Node-based)

Best fit for repos that already have Node tooling. Install:

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

Create `commitlint.config.js`:

```javascript
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "header-max-length": [2, "always", 100],
  },
};
```

### Wire via `pre-commit` framework

```yaml
- repo: https://github.com/alessandrojcm/commitlint-pre-commit-hook
  rev: v9.18.0
  hooks:
    - id: commitlint
      stages: [commit-msg]
      additional_dependencies: ["@commitlint/config-conventional"]
```

Then run `pre-commit install --hook-type commit-msg` to wire it into git.

### Wire via Husky (Node-only repos)

Create `.husky/commit-msg`:

```bash
npx --no-install commitlint --edit "$1"
```

Husky v9 picks this up automatically; no shebang needed.

## Enforcement: `commitizen` (Python-based, cross-language)

Best fit for non-Node repos. Install:

```bash
pip install commitizen
# or
pipx install commitizen
```

### Wire via `pre-commit` framework

```yaml
- repo: https://github.com/commitizen-tools/commitizen
  rev: v3.29.1
  hooks:
    - id: commitizen
      stages: [commit-msg]
```

Configuration in `pyproject.toml`:

```toml
[tool.commitizen]
name = "cz_conventional_commits"
version = "0.1.0"
tag_format = "v$version"
```

`commitizen` also bundles a `cz commit` interactive wizard for users who want guided commit messages, and a `cz bump` for SemVer bumping based on commit history. Both are nice-to-haves; the pre-commit hook enforces format on whatever the user types in the commit-msg editor.

## Enforcement: `conform` (Go-based, cross-language)

Standalone Go binary, no language runtime needed. Useful for repos that want to avoid both Node and Python deps.

```yaml
- repo: https://github.com/siderolabs/conform
  rev: v0.1.0-alpha.30
  hooks:
    - id: conform
      stages: [commit-msg]
```

Configuration in `.conform.yaml`. See [conform docs](https://github.com/siderolabs/conform) for rule syntax.

## Enforcement: lightweight regex hook (no runtime needed)

If you don't want to add a tool at all, a tiny `local` hook works:

```yaml
- repo: local
  hooks:
    - id: conventional-commit-msg
      name: Conventional Commits format
      entry: |
        bash -c '
          msg=$(cat "$1" | head -1)
          if ! echo "$msg" | grep -qE "^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([a-z0-9-]+\))?!?: .+$"; then
            echo "Commit message must follow Conventional Commits: <type>[(scope)][!]: <description>"
            echo "Got: $msg"
            exit 1
          fi
        '
      language: system
      stages: [commit-msg]
      pass_filenames: true
```

Pros: zero dependencies. Cons: less flexible than `commitlint` / `commitizen` (no body / footer rules, no breaking-change automation).

## Choosing between them

| Repo type                    | Recommended                          |
| ---------------------------- | ------------------------------------ |
| Pure Node, has Husky         | `commitlint` via Husky               |
| Pure Node, has `pre-commit`  | `commitlint` via the pre-commit hook |
| Polyglot or non-Node         | `commitizen` via `pre-commit`        |
| No Node, no Python tolerated | `conform` (Go binary)                |
| Want zero new deps           | regex `local` hook                   |

## Helping users write good messages

Whatever you wire up, point users to:

- [conventionalcommits.org](https://www.conventionalcommits.org/) — the spec.
- An interactive commit prompt (`cz commit` from commitizen, or `npx git-cz` from the JS commitizen) for users who want a guided path.

## Bypass for emergencies

```bash
git commit --no-verify -m "..."
```

Document this in the project README so users know the escape hatch exists. Don't normalize bypassing — but the path needs to exist for legitimate emergencies.
