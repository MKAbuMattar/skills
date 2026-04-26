# Sample pipeline — `acme-api` service

A worked example showing every file from `assets/templates/` filled in for a small Node/TypeScript service called `acme-api`. Use it as a reference when wiring the templates into your own repo.

## Repo shape

```
acme-api/
├── .releaserc.json              ← from .releaserc.json.template
├── commitlint.config.js         ← from commitlint.config.js.template
├── grype.yaml                   ← from grype.yaml.template
├── Jenkinsfile                  ← from Jenkinsfile.template (registry/image filled in)
├── sonar-project.properties     ← from sonar-project.properties.template
├── package.json
├── pnpm-lock.yaml               ← detected → pipeline runs `pnpm test`
├── Dockerfile
├── src/
└── tests/
```

## What changed from the templates

| File                       | Edits made                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `Jenkinsfile`              | `REGISTRY=ghcr.io`, `IMAGE_ORG=acme`, `IMAGE_NAME=api`, `CHART_REPO=git@github.com:acme/charts.git` |
| `sonar-project.properties` | `sonar.projectKey=acme-api`, `sonar.sources=src`, `sonar.tests=tests`, JS coverage path enabled     |
| `commitlint.config.js`     | Uncommented `scope-enum: ['api','auth','db','deps','infra']`                                        |
| `.releaserc.json`          | Removed the `hotfix/*` branch (the team uses trunk + `release/*` only)                              |
| `grype.yaml`               | `fail-on: high`; one example ignore for a known false-positive on `node:18-alpine`                  |

## Pipeline behaviour by branch (after wiring)

| Push to          | Tag pushed to ghcr.io      | GitOps update?              | Score gate? | Default `SECURITY_LEVEL` (auto) |
| ---------------- | -------------------------- | --------------------------- | ----------- | ------------------------------- |
| `feature/*` (PR) | none (build-and-scan only) | no                          | report only | `none` (no sign / no encrypt)   |
| `develop`        | `1.5.0-beta.3+a8d3538`     | yes → `dev` env values.yaml | block at 70 | `sign-only`                     |
| `release/1.5.x`  | `1.5.0-rc.2+a8d3538`       | yes → `staging` values.yaml | block at 70 | `sign-and-encrypt`              |
| `main`           | `1.5.0` and `:latest`      | yes → `prod` values.yaml    | block at 80 | `sign-and-encrypt`              |
| `hotfix/1.4.x`   | `1.4.x-hotfix.<n>+<sha>`   | yes → `staging` then `prod` | block at 80 | `sign-and-encrypt`              |

The `SECURITY_LEVEL` build parameter accepts `auto` (default — derive from branch), `none`, `sign-only`, `encrypt-only`, or `sign-and-encrypt`. Override per-build for one-off rebuilds (e.g. `SECURITY_LEVEL=none` to skip the Vault round-trip when debugging the pipeline). See `references/security-levels.md`.

## Files in this example

The four config files (commitlint, .releaserc, sonar, grype) are essentially the templates with the placeholder values filled in. The Jenkinsfile is in this directory too. Reading them side-by-side with the templates in `assets/templates/` is the fastest way to see what to change in your own repo.

## How to run the score script against this example

```bash
# From a CI run, you'd already have these reports — fake them here for a dry run.
cd assets/examples/sample-pipeline
echo '{"projectStatus":{"conditions":[{"metricKey":"new_coverage","actualValue":"82"}]}}' > sonar-report.json
echo '{"matches":[]}' > grype-report.json
bash ../../../scripts/compute-score.sh sonar-report.json grype-report.json
cat scorecard.md
rm sonar-report.json grype-report.json score.json scorecard.md
```
