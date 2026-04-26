# Conventional Commits

The commit-message format. Load this when configuring `commitlint` or when designing the SemVer auto-bump rules (this drives `semver.md`).

## The format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **`type`** (required) — one word from the list below.
- **`scope`** (optional) — area of code (`api`, `auth`, `ui`, `deps`, …). Use parentheses.
- **`subject`** (required) — imperative mood, no trailing period, ≤ 72 chars.
- **`body`** (optional) — wrap at 100, explain _why_ not _what_.
- **`footer`** (optional) — `BREAKING CHANGE: …`, `Closes #123`, `Refs #45`.

### Examples

```
feat(auth): add SSO login via Google

Replaces the legacy username/password form for admin users.
Closes #234
```

```
fix(api): handle null response in /v1/users

The downstream service returns `null` on lookup miss; the parser
crashed. Now treats null as "not found".
```

```
feat(api)!: rename /v1/users to /v2/users

BREAKING CHANGE: clients must update the endpoint path. /v1/users
returns 410 Gone for two release cycles, then is removed.
```

The `!` after the scope is a shorthand for "breaking change" — equivalent to a `BREAKING CHANGE:` footer for SemVer purposes.

## Accepted types (default ruleset)

| Type                                      | When                                                  | SemVer effect                  |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| `feat`                                    | New user-visible feature                              | minor                          |
| `fix`                                     | Bug fix                                               | patch                          |
| `perf`                                    | Performance improvement                               | patch                          |
| `refactor`                                | Internal restructure, no user-visible change          | none                           |
| `docs`                                    | Documentation only                                    | none                           |
| `test`                                    | Tests only                                            | none                           |
| `build`                                   | Build system / dependencies                           | none                           |
| `ci`                                      | CI configuration                                      | none                           |
| `chore`                                   | Catch-all for housekeeping that doesn't fit elsewhere | none                           |
| `revert`                                  | Reverts a previous commit                             | depends on the reverted commit |
| `style`                                   | Formatting, whitespace                                | none                           |
| Any with `!` or `BREAKING CHANGE:` footer | Breaking change                                       | major                          |

The same default the [Conventional Commits 1.0.0 spec](https://www.conventionalcommits.org) ships with.

## Adding custom types

Most teams don't need to. If you do — for example a `security:` type for fixes that close a CVE — add it to `commitlint.config.js`:

```javascript
'type-enum': [2, 'always', [
  'feat', 'fix', 'perf', 'refactor', 'docs', 'test',
  'build', 'ci', 'chore', 'revert', 'style',
  'security'  // your addition
]]
```

…and update the SemVer mapping in `.releaserc.json`. Custom types that don't map to a SemVer effect default to "none". Don't keep types you never use — every additional choice is a chance to pick wrong.

## Scopes

Scopes are free-form by default. Tighten by adding `scope-enum` to `commitlint.config.js` once your repo has stable module names — typos like `feat(api)` vs `feat(apis)` are caught immediately.

```javascript
'scope-enum': [2, 'always', ['api', 'web', 'auth', 'db', 'deps', 'infra']]
```

## Enforcement

### In CI (the gate)

`commitlint --from <last-tag> --to HEAD` runs as the **first** stage of every PR build. If any commit in the range fails, the pipeline fails _before_ any expensive stage runs.

For a PR build, `<last-tag>` is the merge base with the target branch (`origin/main` or `origin/develop`). For a merge build, `<last-tag>` is the previous tag on that branch.

```bash
# In a Jenkinsfile or shell stage
LAST=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)
npx --no-install commitlint --from "$LAST" --to HEAD
```

### Locally (the early-warning)

Add Husky:

```bash
npx husky-init
echo 'npx --no-install commitlint --edit "$1"' > .husky/commit-msg
chmod +x .husky/commit-msg
```

Now `git commit -m "broken message"` fails locally. The CI gate is still the source of truth — local hooks can be skipped — but Husky catches 95% of typos before push.

### As a comment on a PR (optional)

A bot can post the SemVer effect of the PR's commits as a check:

> ✅ Commits parse cleanly. Next version: **1.5.0** (minor — 2 `feat`, 4 `fix`, 1 `chore`).

Useful for reviewers; not required for the gate.

## Common mistakes

- **Sentence-cased subjects.** "Add feature X" — wrong; should be "add feature X" (imperative). Set `subject-case` to `lower-case` or `lower-case, sentence-case` per team taste.
- **Period at the end of the subject.** Don't.
- **Subject describes the _what_ of the diff, not the user-visible change.** "Update useEffect dependency" tells you nothing — `fix(ui): table no longer freezes on filter change` does.
- **Mixing types in one commit.** A commit that's `feat: …` _and_ changes a doc is fine (the doc is part of the feature). A commit that's `feat: ...` _and_ a `chore: ...` is two commits.
- **Forgetting `BREAKING CHANGE:` on a major bump.** Without it, SemVer auto-bump infers minor, and the release ships with an undocumented break. Use the `!` shorthand if a footer is too heavy.
