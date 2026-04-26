# SemVer + auto-bump

How the pipeline computes the next version from commit history. Load this when configuring `.releaserc.json` or when debugging "why did SemVer pick this version".

## The version shape

Production: `MAJOR.MINOR.PATCH` — `1.4.0`.

Prerelease: `MAJOR.MINOR.PATCH-<channel>.<n>+<short-sha>` — `1.5.0-rc.2+a8d3538`.

- **MAJOR** — incompatible API changes (any commit with `BREAKING CHANGE:` footer or `!` shorthand).
- **MINOR** — new functionality, backward-compatible (any `feat:` commit).
- **PATCH** — backward-compatible bug fixes (any `fix:` or `perf:` commit).
- **`<channel>`** — `rc`, `beta`, `alpha`, `hotfix`, `dev` — driven by branch (see `gitflow.md`).
- **`<n>`** — auto-incrementing counter within the prerelease channel.
- **`<short-sha>`** — first 7 chars of the commit. Critical for build uniqueness (see _Why short-SHA_ below).

## Auto-bump rules (semantic-release default)

`semantic-release` walks `git log <last-tag>..HEAD` and applies, in order:

1. Any commit with `BREAKING CHANGE:` footer or a `!` after the type → **major**.
2. Otherwise, any `feat:` commit → **minor**.
3. Otherwise, any `fix:` / `perf:` commit → **patch**.
4. Otherwise, no release.

The first matching rule wins for the whole range — one `feat:` in a range full of `chore:` still bumps minor. One `BREAKING CHANGE:` in a range full of `feat:` bumps major.

### Custom mapping

In `.releaserc.json`:

```json
{
  "plugins": [
    ["@semantic-release/commit-analyzer", {
      "preset": "conventionalcommits",
      "releaseRules": [
        { "type": "perf",   "release": "minor" },
        { "type": "docs",   "scope": "README", "release": "patch" },
        { "type": "revert", "release": "patch" }
      ]
    }],
    ...
  ]
}
```

Use sparingly. Every custom rule is a future surprise.

## Why short-SHA on prereleases

Without a SHA suffix, two builds of `release/1.5.0` produce identical tags `1.5.0-rc.1`. Push #2 silently overwrites push #1's image. GitOps then sees no diff in `values.yaml` and the running pod never rolls.

With `1.5.0-rc.1+<sha>`, every build produces a unique image tag. The instance namespace stays stable (`stg-150`); only the image ref inside `values.yaml` rolls.

Implementation:

```bash
SHORT_SHA=$(git rev-parse --short=7 HEAD)
TAG="${BASE_VERSION}-${CHANNEL}.${COUNTER}+${SHORT_SHA}"
```

Production tags do NOT get the SHA suffix — `1.5.0` is `1.5.0` is `1.5.0`. The git tag itself is the immutable identifier.

## Channels by branch

```
main            → 1.5.0                      (final release)
release/1.5     → 1.5.0-rc.<n>+<sha>         (release candidate)
develop         → 1.5.0-beta.<n>+<sha>       (beta from integration branch)
feature/<name>  → 1.5.0-alpha.<sha>          (per-PR preview, no counter — SHA is enough)
hotfix/1.4.x    → 1.4.<patch>-hotfix.<n>+<sha>
```

Configure in `.releaserc.json`:

```json
{
  "branches": [
    "main",
    { "name": "develop", "prerelease": "beta" },
    { "name": "release/+([0-9])?(.{+([0-9]),x}).x", "prerelease": "rc" },
    { "name": "hotfix/+([0-9]).+([0-9]).+([0-9])", "prerelease": "hotfix" }
  ]
}
```

The glob patterns are semantic-release's syntax — they're parsed by `micromatch`. Test with `npx semantic-release --dry-run --debug`.

## Tag format on the registry

| Branch / kind  | Tag pushed               | Also tagged                                                |
| -------------- | ------------------------ | ---------------------------------------------------------- |
| Final release  | `1.5.0`                  | `:latest` (production-only convention)                     |
| RC             | `1.5.0-rc.1+a8d3538`     | `:1.5.0-rc` (mutable pointer to latest RC of this version) |
| Beta           | `1.5.0-beta.3+a8d3538`   | (none)                                                     |
| Alpha (per PR) | `1.5.0-alpha+a8d3538`    | (none)                                                     |
| Hotfix         | `1.4.2-hotfix.1+a8d3538` | `:1.4.2-hotfix` (mutable pointer)                          |

Prod consumers pin on the immutable `:1.5.0` tag (or better, the digest); the `:latest` and mutable-pointer tags exist for human convenience only.

## Reading the version from CI

The pipeline reads `VERSION` (or asks `semantic-release --dry-run` directly) at the _Compute Version_ stage. Two patterns:

### Pattern A: `VERSION` file checked into repo (simpler)

```bash
# semantic-release writes VERSION via @semantic-release/exec
NEXT_VERSION=$(cat VERSION)   # 1.5.0 or 1.5.0-rc.2+a8d3538
```

### Pattern B: derive at build time, never commit (cleaner repo)

```bash
NEXT_VERSION=$(npx --no-install semantic-release \
    --dry-run \
    --branches "$BRANCH_NAME" 2>/dev/null \
    | sed -n 's/.*next release version is \(.*\)/\1/p')
```

Pattern A is easier to reason about and lets non-CI tools (Dockerfiles, version probes) read the same file. Pattern B keeps the repo from churning on every release. Default to A unless you have a reason.

## Common mistakes

- **`feat:` after a release that should have been a major.** No `BREAKING CHANGE:` was set, so SemVer picks minor. Push the major manually with `git tag` and force-feed semantic-release with the `--first-release` workaround once.
- **Pre-release counter not advancing.** Counters live in tags. If you delete a tag, the counter rewinds. Don't delete tags.
- **Two CI runs racing on the same branch produce identical SHAs.** Impossible — the SHA is the commit. If two pipelines run on the same commit (a re-run), the SHA matches but the tag suffix matches; the `+` suffix in SemVer is "build metadata" and is _ignored_ for ordering. Two re-runs publishing `1.5.0-rc.1+a8d3538` is fine — they're the same logical artifact.
- **Pinning prod to `:latest` or `:1.5.0` instead of `@sha256:...`.** Mutable references mean `kubectl rollout` doesn't redeploy on a new push. Pin to digest.
