# SonarQube quality gate

How the pipeline scans code, fetches the gate result, and blocks on failure. Load this when configuring `sonar-project.properties` or the quality gate.

## The flow

1. **CI runs the scanner** (`sonar-scanner` CLI or the Maven / Gradle / npm wrapper) against the working copy. The scanner uploads issues, coverage, and duplication metrics to the SonarQube server.
2. **Server applies the quality gate** — a set of conditions on the new code. Default conditions: A reliability rating, A security rating, < 3% duplications on new code, ≥ 70% coverage on new code.
3. **CI polls** `GET /api/qualitygates/project_status?projectKey=...` until the analysis is `SUCCESS` (or fails with `ERROR`).
4. **Pipeline fails** if the gate status is `ERROR` or `WARN`.

The gate must be set to **block** in the SonarQube admin UI (Project Settings → Quality Gate). A gate that only warns is a gate that doesn't gate.

## `sonar-project.properties`

Minimum viable config — copy `assets/templates/sonar-project.properties.template` and fill in:

```properties
sonar.projectKey=<unique-project-key>          # globally unique on the server
sonar.projectName=<human-readable-name>
sonar.projectVersion=${VERSION}                # piped from the pipeline

sonar.sources=src
sonar.tests=tests
sonar.exclusions=**/*.generated.*,**/vendor/**,**/node_modules/**
sonar.test.inclusions=**/*.test.*,**/*.spec.*

# Coverage report — produced by the test stage
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.python.coverage.reportPaths=coverage.xml
sonar.go.coverage.reportPaths=coverage.out

# Pull request decoration (GitHub / GitLab / Bitbucket)
sonar.pullrequest.key=${PR_NUMBER}
sonar.pullrequest.branch=${BRANCH_NAME}
sonar.pullrequest.base=${TARGET_BRANCH}
```

`sonar.projectKey` lives in the URL of the project on the server; it's globally unique per SonarQube instance. Don't reuse keys across repos.

## Coverage report paths by language

The scanner needs the _path to the report file_, not the source root. Generate the report in your test stage; tell Sonar where it landed.

| Language     | Coverage tool                                 | Report file                     | Property                               |
| ------------ | --------------------------------------------- | ------------------------------- | -------------------------------------- |
| JS / TS      | `nyc` / `c8` / `vitest`                       | `coverage/lcov.info`            | `sonar.javascript.lcov.reportPaths`    |
| Python       | `coverage.py` (XML)                           | `coverage.xml`                  | `sonar.python.coverage.reportPaths`    |
| Go           | `go test -coverprofile`                       | `coverage.out`                  | `sonar.go.coverage.reportPaths`        |
| Java (Maven) | `jacoco`                                      | `target/site/jacoco/jacoco.xml` | `sonar.coverage.jacoco.xmlReportPaths` |
| Rust         | `cargo-tarpaulin`                             | `cobertura.xml`                 | `sonar.coverageReportPaths`            |
| .NET         | `dotnet test --collect:"XPlat Code Coverage"` | `coverage.cobertura.xml`        | `sonar.cs.opencover.reportsPaths`      |

For the test command itself, **use the project's package manager** — `pnpm test`, `uv run pytest`, `cargo test`, etc.

## Pipeline stage

```groovy
stage('SonarQube scan') {
    steps {
        withSonarQubeEnv('sonarqube-server') {       // configured under Manage Jenkins → Configure System
            sh """
                sonar-scanner \\
                    -Dsonar.projectVersion=${VERSION} \\
                    -Dsonar.pullrequest.key=${env.CHANGE_ID ?: ''} \\
                    -Dsonar.pullrequest.branch=${env.CHANGE_BRANCH ?: ''} \\
                    -Dsonar.pullrequest.base=${env.CHANGE_TARGET ?: ''}
            """
        }
        timeout(time: 10, unit: 'MINUTES') {
            waitForQualityGate abortPipeline: true   // hard fail on ERROR
        }
    }
}
```

`waitForQualityGate` requires the SonarQube Jenkins plugin and a webhook configured on the SonarQube server pointing back at Jenkins (`Administration → Webhooks`). Without the webhook, `waitForQualityGate` polls indefinitely.

For GitHub Actions / GitLab CI, the equivalent is the `sonarsource/sonarqube-quality-gate-action` (or a curl-poll loop on `/api/qualitygates/project_status`).

## Quality gate conditions — what to set

The "Sonar way" gate is a fine starting point but tune for your repo:

| Condition                       | Recommended                 | Why                                                                    |
| ------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| Coverage on new code            | ≥ 70% (≥ 80% for libraries) | Keeps test coverage from sliding; existing-code coverage is left alone |
| Duplicated lines on new code    | < 3%                        | Prevents copy-paste regressions                                        |
| Maintainability rating new code | A                           | Code smells in new code are addressed before merge                     |
| Reliability rating new code     | A                           | New bugs are zero-tolerance                                            |
| Security rating new code        | A                           | New vulnerabilities are zero-tolerance                                 |
| Security hotspots reviewed      | 100%                        | Forces explicit "this is fine" / "this is a real risk" judgments       |

**On new code only.** Gating on the whole codebase punishes you forever for any historical debt. New-code conditions ratchet up quality without a "fix everything first" project.

## Exclusions

Add to `sonar.exclusions` (file-glob, comma-separated):

- Generated code: `**/*.generated.*`, `**/*.pb.go`, `**/*_pb2.py`, `**/dist/**`, `**/build/**`
- Vendored deps: `**/vendor/**`, `**/node_modules/**`, `**/third_party/**`
- Migrations (data-shaped, not code-shaped): `**/migrations/**`
- Test fixtures: `**/fixtures/**`, `**/__snapshots__/**`

Don't exclude regular tests — they belong in `sonar.tests`, scanned but counted as test code.

## PR decoration

When properly configured, SonarQube comments on the PR with the analysis result. Configure once per project under **Project Settings → Pull Request Decoration**:

- GitHub: install the SonarQube GitHub App, add the repo.
- GitLab: configure a project-access token, add `sonar.pullrequest.gitlab.repository`.
- Bitbucket: configure with a Bitbucket Cloud OAuth client.

The pipeline's `sonar.pullrequest.*` properties tell the scanner this is a PR analysis; the server posts the comment automatically.

## Common mistakes

- **Quality gate set to "WARN" instead of "BLOCK".** The build passes; the regression lands.
- **`sonar.projectVersion` not piped.** Sonar treats every analysis as the same version, and the new-code conditions never trigger.
- **No webhook configured** → `waitForQualityGate` hangs indefinitely. The plugin docs are misleading on this; the webhook is mandatory.
- **Missing coverage report path.** Coverage shows as 0% and the gate fails. Confirm the test stage produced the file at the configured path before the scanner runs.
- **Gating on the whole codebase, not new code.** New-code conditions are the "ratchet"; whole-codebase conditions are the "you can never improve anything until you've fixed everything" trap.
- **Excluding too aggressively.** A `sonar.exclusions=**/*.go` survives review easily. Audit exclusions every release.
