# Security scanning

Load this when wiring static analysis into a Terraform module repo. Three layers: lint (tflint), security (tfsec or trivy), compliance (checkov). All three plug into pre-commit and CI.

## tflint

`tflint` catches Terraform issues that `terraform validate` doesn't: deprecated syntax, unused variables, provider-specific rules (instance type that doesn't exist, region that's deprecated, etc.).

### Install

```bash
# macOS
brew install tflint

# Linux
curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash

# Verify
tflint --version
```

### `.tflint.hcl` (repo root)

```hcl
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# One block per provider you use
plugin "aws" {
  enabled = true
  version = "0.32.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

plugin "azurerm" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

plugin "google" {
  enabled = true
  version = "0.30.0"
  source  = "github.com/terraform-linters/tflint-ruleset-google"
}

# Disable rules that don't fit your conventions
rule "terraform_naming_convention" {
  enabled = true
  variable {
    format = "snake_case"
  }
}
```

### Per-provider plugins

The base `terraform` plugin handles syntax / structure rules. Provider plugins add rules like "this AWS instance type doesn't exist in this region" or "this GCP API has been deprecated". Install only the providers your repo uses.

For HuaweiCloud, OCI, DigitalOcean, Cloudflare — there are no first-party tflint plugins as of late 2025. The base `terraform` plugin still catches the common issues.

### Initialize plugins

```bash
tflint --init   # downloads provider plugins; idempotent
```

Run this once after editing `.tflint.hcl`.

### Run

```bash
# Per module
tflint --chdir=modules/<service>/<resource>

# Recursive over the whole repo
tflint --recursive
```

### Pre-commit hook

```yaml
# .pre-commit-config.yaml fragment
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.96.1
    hooks:
      - id: terraform_tflint
        args:
          - "--args=--config=__GIT_WORKING_DIR__/.tflint.hcl"
```

## tfsec

`tfsec` (now part of `aquasecurity/trivy`) flags security misconfigurations — open security groups, unencrypted storage, missing IAM constraints, public buckets.

### Install (standalone tfsec)

```bash
brew install tfsec    # macOS
# or via curl: see github.com/aquasecurity/tfsec
```

### Install (trivy, the successor)

`tfsec` is being merged into `trivy config`. New repos should use `trivy`:

```bash
brew install trivy
trivy config modules/
```

`trivy config` includes the `tfsec` rules plus checks for Dockerfiles, Helm, Kubernetes manifests, etc. — useful for repos that mix infrastructure types.

### Run

```bash
# Standalone tfsec
tfsec modules/

# trivy
trivy config --config-file .trivy.yaml modules/
```

### `.trivy.yaml`

```yaml
config:
  terraform:
    severity:
      - HIGH
      - CRITICAL
  policy:
    paths: []
```

### Pre-commit hook

```yaml
# .pre-commit-config.yaml fragment
- repo: https://github.com/aquasecurity/tfsec
  rev: v1.28.11
  hooks:
    - id: tfsec
      args: ["--minimum-severity=HIGH"]
```

For trivy:

```yaml
- repo: local
  hooks:
    - id: trivy-config
      name: trivy config scan
      entry: trivy config --severity HIGH,CRITICAL .
      language: system
      pass_filenames: false
      types: [terraform]
```

### Tuning severity

`tfsec` and `trivy` can be noisy on first run — many findings are theoretical (e.g., "encryption could be customer-managed instead of platform-managed"). Triage strategy:

1. Run with default severity. Read every finding.
2. Fix the genuine ones in the module.
3. For findings that conflict with your team's policy (e.g., "we deliberately don't use customer-managed keys for X"), add an inline ignore comment:
   ```hcl
   # tfsec:ignore:AWS017 # bucket encryption handled at the org level
   resource "aws_s3_bucket" "this" { ... }
   ```
4. Set `--minimum-severity=HIGH` to suppress LOW / MEDIUM findings until you've worked through them.

## checkov

`checkov` is policy-as-code by Bridgecrew (now Prisma Cloud). Overlaps with `tfsec` but adds compliance frameworks: SOC2, PCI-DSS, HIPAA, ISO 27001, CIS benchmarks. Useful when you have compliance requirements.

### Install

```bash
pip install checkov
# or
pipx install checkov
```

### Run

```bash
checkov -d modules/ --framework terraform
checkov -d modules/ --framework terraform --check CKV_AWS_*
```

### Pre-commit hook

```yaml
- repo: https://github.com/bridgecrewio/checkov
  rev: 3.2.255
  hooks:
    - id: checkov
      args:
        - "-d"
        - "modules"
        - "--framework"
        - "terraform"
        - "--quiet"
```

### Combining tfsec + checkov

They overlap (~60-70% of findings are the same). Some teams run both because they catch different things in the long tail. Most teams pick one and use it consistently. Pick:

- **tfsec / trivy** if your priority is breadth of cloud-misconfig catches with a fast tool.
- **checkov** if your priority is compliance frameworks and policy-as-code.

Don't run both as pre-commit hooks (the developer will get duplicate findings). Run one as pre-commit, the other in CI.

## Pre-commit fragment (full)

```yaml
# .pre-commit-config.yaml fragment for terraform module repos
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.96.1
    hooks:
      - id: terraform_fmt
      - id: terraform_validate
      - id: terraform_tflint
        args:
          - "--args=--config=__GIT_WORKING_DIR__/.tflint.hcl"
      - id: terraform_docs
        args:
          - "--args=--config=.terraform-docs.yml"

  - repo: https://github.com/aquasecurity/tfsec
    rev: v1.28.11
    hooks:
      - id: tfsec
        args: ["--minimum-severity=HIGH"]
```

## CI

Run the full pipeline on PRs that touch `.tf` files:

```yaml
# .github/workflows/terraform.yml
name: Terraform
on:
  pull_request:
    paths: ["modules/**/*.tf", "examples/**/*.tf"]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform fmt -check -recursive
      - run: |
          for d in modules/*/*; do
            (cd "$d" && terraform init -backend=false && terraform validate)
          done

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: terraform-linters/setup-tflint@v4
      - run: tflint --init
      - run: tflint --recursive

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/tfsec-action@v1.0.3
        with:
          soft_fail: false
          tfsec_args: "--minimum-severity=HIGH"
```

## Triaging findings

For a fresh repo, expect dozens of findings on the first scan. Triage in this order:

1. **CRITICAL** findings — fix all of them. They're "this resource is publicly exposed" or "this credential is in plaintext".
2. **HIGH** — fix unless there's a deliberate reason; add an ignore comment with the reason.
3. **MEDIUM / LOW** — defer to a follow-up. Don't block PRs on them; track in a security-debt issue.

Add ignore comments where appropriate; don't disable the scanner globally.

## Anti-patterns

- **Disabling the scanner because it's noisy** — triage one rule at a time.
- **Running both tfsec and checkov as pre-commit hooks** — duplicate findings frustrate developers.
- **Floating versions** in `.pre-commit-config.yaml` — pin every `rev`.
- **Inline ignore comments without a reason** — `# tfsec:ignore:AWS017` without context becomes unmaintainable. Always add the reason: `# tfsec:ignore:AWS017 # encryption handled at org level`.
- **Skipping CI security scan because pre-commit already runs it** — pre-commit isn't the contract; CI is. Run both.
- **Setting `soft_fail: true` in CI** — defeats the point. Either fail the PR or remove the scanner.
