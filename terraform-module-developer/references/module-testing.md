# Module testing

Load this when adding tests to a Terraform module. Two layers: an `examples/` directory that exercises the module like a real consumer, and `*.tftest.hcl` files using the Terraform 1.6+ native test framework.

## `examples/` directory pattern

Every module gets a peer `examples/` tree:

```
modules/<service>/<resource>/      # the module
examples/<service>/<resource>/      # working examples
├── basic/
│   ├── main.tf
│   ├── outputs.tf
│   ├── variables.tf
│   ├── versions.tf
│   ├── README.md
│   └── terraform.tfvars.example
└── complete/
    ├── main.tf
    └── ...
```

Each example is a self-contained Terraform configuration that calls the module:

```hcl
# examples/<service>/<resource>/basic/main.tf
module "<prefix>" {
  source = "../../../modules/<service>/<resource>"

  <prefix>_name        = "example-<resource>"
  <prefix>_description = "Basic example of <resource>"
  <prefix>_region      = var.region

  <prefix>_tags = {
    Environment = "test"
    Terraform   = "true"
  }
}
```

```hcl
# examples/<service>/<resource>/basic/outputs.tf
output "<prefix>_id" {
  value = module.<prefix>.<prefix>_id
}
```

The example is a working consumer — anyone reading the module finds a runnable starting point. CI runs `terraform plan` on each example to verify the module's contract.

Every module's README links to its examples:

```markdown
## Examples

See the [examples](../../../examples/<service>/<resource>) directory for working configurations:

- [`basic/`](../../../examples/<service>/<resource>/basic/) — minimal usage.
- [`complete/`](../../../examples/<service>/<resource>/complete/) — every supported argument.
```

## Native test framework (Terraform 1.6+)

`*.tftest.hcl` files run inside the module with the test command:

```bash
terraform init   # in the module directory
terraform test
```

### Plan-only test (no apply)

For modules where a real apply is expensive or impossible offline:

```hcl
# modules/<service>/<resource>/tests/basic.tftest.hcl
run "basic" {
  command = plan

  variables {
    <prefix>_name = "test-<resource>"
  }

  assert {
    condition     = output.<prefix>_id != null
    error_message = "expected <prefix>_id to be defined"
  }

  assert {
    condition     = length(<provider>_<service>_<resource>.this) == 1
    error_message = "expected exactly one <resource>; got ${length(<provider>_<service>_<resource>.this)}"
  }
}

run "create_disabled" {
  command = plan

  variables {
    <prefix>_create = false
    <prefix>_name   = "test-<resource>"
  }

  assert {
    condition     = length(<provider>_<service>_<resource>.this) == 0
    error_message = "expected zero <resource> when create=false"
  }
}
```

### Full apply test

For modules where a real apply is feasible (against a sandbox account):

```hcl
# modules/<service>/<resource>/tests/integration.tftest.hcl
run "integration" {
  command = apply

  variables {
    <prefix>_name = "test-${run.name}-${random_id.suffix.hex}"
    <prefix>_tags = {
      TestRun = run.name
    }
  }

  assert {
    condition     = output.<prefix>_id != ""
    error_message = "<prefix>_id must be set after apply"
  }

  # Use providers to query the actual cloud and verify
  assert {
    condition     = data.<provider>_<service>_<resource>.this.name == output.<prefix>_name
    error_message = "remote state mismatch"
  }
}
```

`command = apply` actually applies the module against the configured provider. For CI, gate this behind a credentials check and a sandbox account; for local development, run `terraform test` rarely.

### Variable validation tests

```hcl
run "rejects_empty_name" {
  command = plan

  variables {
    <prefix>_name = ""
  }

  expect_failures = [
    var.<prefix>_name,
  ]
}
```

The `expect_failures` block tells the test framework "this is supposed to fail with a validation error". Useful for `validation` blocks in `variables.tf`.

### Mocking providers

```hcl
run "mocked" {
  command = plan

  providers = {
    <provider> = mock_provider <provider>
  }

  # ... assertions ...
}
```

`mock_provider` lets you run plan-only tests without real provider credentials. Useful for fast CI feedback.

## Test directory layout

```
modules/<service>/<resource>/
├── main.tf
├── ...
└── tests/
    ├── basic.tftest.hcl       # plan-only smoke test
    ├── integration.tftest.hcl # apply against a sandbox
    └── validation.tftest.hcl  # validation-block tests
```

The `tests/` directory is per-module. Naming convention: `<aspect>.tftest.hcl`.

## Running tests

```bash
# Plan-only tests (fast, no credentials needed for mocked tests)
cd modules/<service>/<resource>
terraform init -test-directory=tests
terraform test -test-directory=tests -filter=tests/basic.tftest.hcl

# Full integration (requires credentials and a sandbox account)
terraform test -test-directory=tests -filter=tests/integration.tftest.hcl
```

## CI integration

```yaml
# .github/workflows/terraform-test.yml
name: terraform-test
on:
  pull_request:
    paths: ["modules/**/*.tf", "**/*.tftest.hcl"]

jobs:
  plan-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ">= 1.6"
      - run: |
          for d in modules/*/*; do
            if [ -d "$d/tests" ]; then
              (cd "$d" && terraform init -test-directory=tests && \
                terraform test -test-directory=tests -filter=tests/basic.tftest.hcl)
            fi
          done

  integration-tests:
    runs-on: ubuntu-latest
    if: github.event.pull_request.head.repo.full_name == github.repository  # not from forks
    environment: test  # uses environment-scoped secrets
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: |
          for d in modules/*/*; do
            if [ -d "$d/tests" ]; then
              (cd "$d" && terraform init -test-directory=tests && \
                terraform test -test-directory=tests -filter=tests/integration.tftest.hcl)
            fi
          done
        env:
          # Provider credentials from environment secrets
          TF_VAR_test_account_id: ${{ secrets.SANDBOX_ACCOUNT }}
```

Two jobs: plan tests run on every PR (cheap, fast, mocked); integration tests gate on the PR being from the repo (not a fork) and run against a sandbox account.

## Examples in CI

Run `terraform plan` on every example in CI to catch breaking changes:

```yaml
plan-examples:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: hashicorp/setup-terraform@v3
    - run: |
        for d in examples/*/*/*; do
          if [ -f "$d/main.tf" ]; then
            (cd "$d" && terraform init -backend=false && terraform plan -input=false)
          fi
        done
      env:
        TF_VAR_region: <test-region>
```

## terratest (advanced)

For complex assertions (HTTP probes, response shapes, retry logic), use `terratest` — a Go testing library that wraps Terraform.

```go
// modules/<service>/<resource>/tests/terratest_test.go
package tests

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
)

func TestBasic(t *testing.T) {
    opts := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: "../../../examples/<service>/<resource>/basic",
        Vars: map[string]interface{}{
            "<prefix>_name": "test-<resource>",
        },
    })

    defer terraform.Destroy(t, opts)
    terraform.InitAndApply(t, opts)

    id := terraform.Output(t, opts, "<prefix>_id")
    if id == "" {
        t.Fatalf("expected <prefix>_id to be set")
    }
}
```

`terratest` is heavier than the native test framework — only reach for it when the native framework's assertion language isn't expressive enough.

## Anti-patterns

- **No `examples/` directory** — every module needs at least a `basic/` example.
- **Tests that share state** — each `run` block should be independent. Use `random_id` to namespace resource names per run.
- **Real apply tests on every PR** — slow, expensive, flaky. Plan-only tests on PRs; apply tests on a schedule or post-merge.
- **Hardcoded test region / account** — pass these as test-only variables; let CI inject from secrets.
- **`terraform test` without `terraform init`** — the test runner needs the provider downloaded first.
- **Skipping cleanup on apply tests** — every apply test must `Destroy` (terratest) or rely on the test framework's auto-cleanup.
- **Tests that don't run in CI** — manual-only tests rot.
