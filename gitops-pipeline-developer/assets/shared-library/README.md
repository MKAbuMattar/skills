# Jenkins Shared Library

Modular pipeline that turns a 300-line Jenkinsfile into one line:

```groovy
@Library('gitops-pipeline@main') _

pipelineGitOps([
    registry:  'ghcr.io',
    org:       'acme',
    image:     'api',
    chartRepo: 'git@github.com:acme/charts.git',
])
```

Each stage is its own callable in `vars/` so you can also wire stages individually if you want a non-default order or a one-off custom step.

## Layout

```
shared-library/
├── vars/                              # Globals — every file becomes a callable named after the file
│   ├── pipelineGitOps.groovy          # Top-level orchestrator (declares stages + when-clauses)
│   ├── podTemplate.groovy             # Returns the k8s pod YAML (loads from resources/)
│   ├── setupTools.groovy              # apk add buildctl skopeo syft grype cosign sonar-scanner ...
│   ├── lintCommits.groovy             # commitlint --from <last-tag> --to HEAD
│   ├── computeVersion.groovy          # semantic-release --dry-run + short-SHA suffix
│   ├── computeSecurityLevel.groovy    # Resolve auto → none / sign-only / encrypt-only / sign-and-encrypt
│   ├── lintAndTest.groovy             # Package-manager-aware lint + test
│   ├── sonarScan.groovy               # sonar-scanner + waitForQualityGate
│   ├── buildImage.groovy              # buildctl → OCI archive (always plain)
│   ├── scanImage.groovy               # syft + grype with severity gate
│   ├── encryptImage.groovy            # JWE-encrypt OCI layers (Vault KV public key) — conditional
│   ├── pushImage.groovy               # skopeo copy (encrypted source if IMG_DO_ENCRYPT=true)
│   ├── signImage.groovy               # cosign sign + SBOM attest (Vault transit key) — conditional
│   ├── updateGitOps.groovy            # clone + yq + commit [skip ci] + push
│   ├── computeScore.groovy            # bash scripts/compute-score.sh + gate
│   └── notify.groovy                  # Slack / Teams webhook
└── resources/
    └── pod-template.yaml              # Multi-container pod the agent block uses
```

### Stage flow (with conditionals)

```
Setup → LintCommits → ComputeVersion → ResolveSecurity → LintAndTest →
  Sonar (if !SKIP_SCAN) → BuildImage → SBOM+Grype (if !SKIP_SCAN) →
  EncryptImage (if IMG_DO_ENCRYPT) → PushImage →
  SignImage (if IMG_DO_SIGN) → GitOpsUpdate → Score
```

The two security stages (`Encrypt Image` and `Sign Image`) are gated by env flags set by `computeSecurityLevel`. See `references/security-levels.md` in the parent skill for the full matrix.

## Install

### Option A — Global Pipeline Library (recommended)

1. Push this directory to its own git repo (e.g. `git@github.com:acme/jenkins-shared-library.git`).
2. **Manage Jenkins → System → Global Pipeline Libraries → Add**:
   - Name: `gitops-pipeline`
   - Default version: `main`
   - Source Code Management: Git, point at the repo above.
   - Tick "Load implicitly" if you want every Jenkinsfile to have access without the `@Library` annotation.
3. In your Jenkinsfile:
   ```groovy
   @Library('gitops-pipeline@main') _
   pipelineGitOps([ registry: '...', org: '...', image: '...', chartRepo: '...' ])
   ```

### Option B — Folder Library (no admin access required)

1. Open the Jenkins Folder containing your job.
2. **Configure → Pipeline Libraries → Add**: same fields as Option A.
3. The library is scoped to that folder.

### Option C — Inline (no git repo)

If you can't host a separate library repo, drop the entire `shared-library/` directory into your application repo and reference it via the `library` step:

```groovy
library identifier: 'gitops-pipeline@HEAD',
        retriever: legacySCM(scm: [
            $class: 'GitSCM',
            userRemoteConfigs: [[ url: '<your-repo>' ]],
            branches: [[ name: 'HEAD' ]],
            extensions: [[ $class: 'RelativeTargetDirectory', relativeTargetDir: 'shared-library' ]]
        ])
```

This is the most fragile option — prefer A or B if you can.

## Configuration map

`pipelineGitOps()` accepts a `Map` with these keys (defaults shown):

| Key                   | Default                                       | Effect                                                                        |
| --------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `registry`            | (required)                                    | Registry hostname                                                             |
| `org`                 | (required)                                    | Image organization / namespace                                                |
| `image`               | (required)                                    | Image name (no tag)                                                           |
| `chartRepo`           | (required)                                    | GitOps target repo (chart / manifests)                                        |
| `chartBranch`         | `'main'`                                      | Branch the GitOps update commits to                                           |
| `valuesFile`          | `'values.yaml'`                               | File inside the chart repo to update                                          |
| `imageKey`            | `'image'`                                     | yq path within `valuesFile` (e.g. `'spec.image'`)                             |
| `dockerfile`          | `'.'`                                         | Dockerfile dir relative to repo root                                          |
| `platform`            | `'linux/amd64'`                               | BuildKit target platform                                                      |
| `buildArgs`           | `[:]`                                         | `--build-arg KEY=VAL` map                                                     |
| `cosignKeyRef`        | `'hashivault://cosign-key'`                   | Cosign key reference (KMS / Vault transit)                                    |
| `vaultAddr`           | `'http://vault.vault.svc.cluster.local:8200'` | Vault internal address                                                        |
| `vaultRole`           | `'jenkins-signer'`                            | Vault K8s-auth role bound to the Jenkins SA                                   |
| `cosignRepo`          | `"${registry}/${org}/signatures"`             | Where signatures live                                                         |
| `encKeyPath`          | `'secret/data/enc-keys'`                      | Vault KV path; `${encEnv}` is appended to look up the public encryption key   |
| `encEnv`              | `'prod'` for releases / `'dev'` otherwise     | Env segment for the enc-key lookup; override per-build                        |
| `grypeFailOn`         | `'high'`                                      | `--fail-on` severity                                                          |
| `grypeConfig`         | `'grype.yaml'`                                | Path to grype config                                                          |
| `sonarServerName`     | `'sonarqube-server'`                          | Configured server name in Manage Jenkins                                      |
| `gateTimeoutMin`      | `10`                                          | Quality-gate wait timeout                                                     |
| `scoreThreshold`      | `70`                                          | Fail the build below this score                                               |
| `scoreScript`         | `'scripts/compute-score.sh'`                  | Path to the scoring script                                                    |
| `registryCredsSecret` | `'registry-credentials'`                      | K8s secret holding `config.json`                                              |
| `sshKeySecret`        | `'git-ssh-key'`                               | K8s secret holding `ssh-privatekey`                                           |

## Build parameters (`pipelineGitOps` declares them automatically)

| Param            | Choices                                                              | Effect                                                                                     |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `BUMP`           | `auto` · `patch` · `minor` · `major`                                 | SemVer bump. `auto` (default) derives from Conventional Commits via `semantic-release`.    |
| `CHANNEL`        | `auto` · `release` · `rc` · `beta` · `alpha` · `hotfix`              | Release channel. `auto` (default) derives from branch.                                     |
| `SECURITY_LEVEL` | `auto` · `none` · `sign-only` · `encrypt-only` · `sign-and-encrypt`  | Image security level. `auto` (default) derives from branch — see *Security level* below.   |
| `SKIP_SCAN`      | `true` · `false` (default)                                           | Skip Sonar + Grype (debug only — fails the score gate).                                    |

## Security level (Gitflow-driven)

The pipeline runs different post-build steps depending on `SECURITY_LEVEL`:

| Level                | Encrypt? | Sign?    | Use case                                                  |
| -------------------- | -------- | -------- | --------------------------------------------------------- |
| `none`               | no       | no       | Local dev / parity testing / pipeline debugging           |
| `sign-only`          | no       | **yes**  | Shared dev / staging environments                         |
| `encrypt-only`       | **yes**  | no       | Rare — pair with sign for production                      |
| `sign-and-encrypt`   | **yes**  | **yes**  | Production / regulated environments (Double Lock)         |

Default (`auto`) maps each Gitflow branch to a level:

| Branch                                | Default level       |
| ------------------------------------- | ------------------- |
| `main` / `release/*` / `hotfix/*`     | `sign-and-encrypt`  |
| `develop`                             | `sign-only`         |
| `feature/*`                           | `none`              |
| anything else                         | `sign-only` (fallback) |

Override per-build by selecting a value in the parameterized build dialog. For example, run `SECURITY_LEVEL=none` once to debug the pipeline without touching Vault. Full details: `references/security-levels.md` in the parent skill.

## Calling individual stages

Each `vars/<name>.groovy` is callable directly. Useful when you want a non-default order or a one-off custom step.

### Build-and-scan only (no push / sign / GitOps)

```groovy
@Library('gitops-pipeline@main') _

pipeline {
    agent { kubernetes { yaml podTemplate([:]) } }
    stages {
        stage('Setup')      { steps { setupTools() } }
        stage('Lint')       { steps { lintCommits() } }
        stage('Version')    { steps { computeVersion() } }
        stage('Build')      { steps { buildImage([registry:'ghcr.io', org:'acme', image:'api']) } }
        stage('Scan')       { steps { scanImage([grypeFailOn:'critical']) } }
    }
}
```

### Force a specific security level for a one-off rebuild

```groovy
@Library('gitops-pipeline@main') _

pipeline {
    agent { kubernetes { yaml podTemplate([:]) } }
    stages {
        stage('Setup')      { steps { setupTools() } }
        stage('Version')    { steps { computeVersion() } }
        stage('Force level') { steps { script { computeSecurityLevel('sign-and-encrypt') } } }
        stage('Build')      { steps { buildImage([...]) } }
        stage('Encrypt')    { when { expression { env.IMG_DO_ENCRYPT == 'true' } }
                              steps { encryptImage([...]) } }
        stage('Push')       { steps { pushImage([...]) } }
        stage('Sign')       { when { expression { env.IMG_DO_SIGN == 'true' } }
                              steps { signImage([...]) } }
    }
}
```

`computeSecurityLevel(arg)` accepts `'auto'` (resolve from branch) or any of the four concrete levels. It sets `env.SECURITY_LEVEL`, `env.IMG_DO_ENCRYPT`, `env.IMG_DO_SIGN`, which the surrounding `when {}` clauses read.

## Testing the library locally

Jenkins shared libraries are hard to test outside Jenkins. The pragmatic approach:

1. Run the **bootstrap-jenkins.sh** script (in the skill's `scripts/`) to spin up Jenkins with the library pre-configured.
2. Push a `feat:` commit to a branch and open a PR — that exercises every stage on the PR build.
3. For unit-style testing of helpers, see [JenkinsPipelineUnit](https://github.com/jenkinsci/JenkinsPipelineUnit) — useful but heavyweight; most teams skip it.
