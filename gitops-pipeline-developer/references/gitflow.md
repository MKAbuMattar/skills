# Gitflow

The branching model the pipeline assumes by default. Load this when the repo's branching strategy needs to be designed, documented, or changed.

## The branches

| Branch           | Lifetime     | Holds                                           | Receives merges from                 | Merges to                |
| ---------------- | ------------ | ----------------------------------------------- | ------------------------------------ | ------------------------ |
| `main`           | Forever      | Production-released code; tagged `vX.Y.Z`       | `release/*`, `hotfix/*`              | (none)                   |
| `develop`        | Forever      | Next release in progress                        | `feature/*`, `release/*`, `hotfix/*` | `release/*`              |
| `feature/<name>` | Until merged | One feature, integration-ready                  | (developer commits)                  | `develop`                |
| `release/<X.Y>`  | Days–weeks   | Release stabilization (only fixes/docs allowed) | `develop` (cut once)                 | `main` **and** `develop` |
| `hotfix/<X.Y.Z>` | Hours–days   | Production patches branched from `main`         | `main` (cut once)                    | `main` **and** `develop` |

**Hard rules:**

- Never commit directly to `main` or `develop`. Always go through a PR.
- Every `release/*` and `hotfix/*` merges to **both** `main` and `develop`. The pipeline enforces this by failing if it sees a `release/*` close on `main` without a matching close on `develop` within the same window.
- Tags live on `main` only.

## Environment mapping

| Branch      | Deploys to              | Tag suffix     | Notes                                    |
| ----------- | ----------------------- | -------------- | ---------------------------------------- |
| `main`      | production              | none (`1.4.0`) | Manual approval gate before deploy       |
| `release/*` | staging                 | `-rc.<n>`      | Automated deploy; promotion gate to prod |
| `develop`   | dev / shared            | `-beta.<n>`    | Continuous deploy on every merge         |
| `feature/*` | preview / PR env        | `-alpha.<sha>` | Optional; deploy on demand               |
| `hotfix/*`  | staging then production | `-hotfix.<n>`  | Same gate as a release                   |

The pipeline reads the current ref (`$BRANCH_NAME` / `$GITHUB_REF` / `$CI_COMMIT_REF_NAME`) and dispatches accordingly. `references/semver.md` covers exactly how the suffix is computed.

## Trunk-based as an alternative

If the repo wants trunk-based: drop `develop`, drop `release/*`. `main` _is_ trunk; `feature/*` PRs merge straight in. Hotfixes are normal commits. The same conventional-commits + SemVer rules still drive the version. The pipeline file changes in three places:

1. The branch dispatch in _Compute Version_ (only `main` + `feature/*` are recognized).
2. `.releaserc` lists only `main` (no prerelease branches by default).
3. The "release ↔ develop sync" alignment check is dropped.

When in doubt — Gitflow if releases are infrequent and need stabilization; trunk-based if you ship continuously and have a strong test suite + feature flags.

## What the pipeline does on each branch event

| Event                          | Pipeline behavior                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| PR opened to `develop`         | Lint commits, lint code, test, sonar scan, build image, grype scan. **No push, no GitOps update.**             |
| Merge to `develop`             | Same + push image with `-beta.<n>+<sha>` tag, GitOps update to dev environment.                                |
| `release/*` cut from `develop` | Same + push `-rc.<n>+<sha>`, GitOps update to staging.                                                         |
| Merge to `main` (from release) | Compute final SemVer, push `X.Y.Z` and `:latest`, sign with cosign, GitOps update to prod, generate CHANGELOG. |
| `hotfix/*` cut from `main`     | Same as release/, but deploys directly to staging then prod once approved; final tag bumps **patch**.          |

## Authoring rules

- **One feature = one branch = one PR.** Never reuse a feature branch across two unrelated changes.
- **Rebase before merge** (squash-and-merge or rebase-and-merge) so `main` and `develop` keep linear history. The pipeline relies on `git log <last-tag>..HEAD` for SemVer, and merge commits inflate it.
- **Branch protection** on `main` and `develop`: required PR review, required status checks (commitlint, sonar, grype, score), no force-push.
- **Delete branches after merge.** Keeps `git branch -a` readable and the branch picker (if you have one) sane.
