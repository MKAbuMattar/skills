# Module testing example

End-to-end testing for a module: an `examples/` directory with a runnable basic configuration, and `*.tftest.hcl` files using the Terraform 1.6+ native test framework.

**Module under test:** `modules/network/vnet/` (from the simple-module example).

## examples/ tree

```
examples/network/vnet/
├── basic/
│   ├── main.tf
│   ├── outputs.tf
│   ├── variables.tf
│   ├── versions.tf
│   ├── README.md
│   └── terraform.tfvars.example
└── complete/
    └── ...
```

## examples/network/vnet/basic/main.tf

```hcl
module "vnet" {
  source = "../../../modules/network/vnet"

  network_vnet_name = "example-vnet"
  network_vnet_cidr = "10.0.0.0/16"

  network_vnet_tags = {
    Environment = "test"
    Terraform   = "true"
  }
}
```

## examples/network/vnet/basic/outputs.tf

```hcl
output "vnet_id" {
  value = module.vnet.network_vnet_id
}

output "vnet_name" {
  value = module.vnet.network_vnet_name
}

output "vnet_cidr" {
  value = module.vnet.network_vnet_cidr
}
```

## examples/network/vnet/basic/variables.tf

```hcl
# Optional variables for example tuning. Sensible defaults so plan works without input.

variable "region" {
  type    = string
  default = "<test-region>"
}
```

## examples/network/vnet/basic/versions.tf

Identical to the module's `versions.tf`, plus the consumer-side provider config:

```hcl
terraform {
  required_version = ">= 1.3"

  required_providers {
    <provider> = {
      source  = "<namespace>/<provider>"
      version = ">= <minimum-version>"
    }
  }
}

provider "<provider>" {
  region = var.region
}
```

## examples/network/vnet/basic/README.md

```markdown
# basic example — vnet

Minimal configuration showing how to create a single vnet with the module.

## Usage

\`\`\`bash
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
\`\`\`

## Cleanup

\`\`\`bash
terraform destroy
\`\`\`
```

## modules/network/vnet/tests/basic.tftest.hcl

Plan-only smoke tests — fast, no credentials needed if mocked:

```hcl
# Test: module produces the expected outputs when create=true
run "basic" {
  command = plan

  variables {
    network_vnet_name = "test-vnet"
    network_vnet_cidr = "10.0.0.0/16"
  }

  assert {
    condition     = length(<provider>_network_vnet.this) == 1
    error_message = "expected exactly one vnet to plan; got ${length(<provider>_network_vnet.this)}"
  }

  assert {
    condition     = <provider>_network_vnet.this[0].name == "test-vnet"
    error_message = "vnet name mismatch"
  }

  assert {
    condition     = <provider>_network_vnet.this[0].cidr == "10.0.0.0/16"
    error_message = "vnet cidr mismatch"
  }

  assert {
    condition     = <provider>_network_vnet.this[0].tags["Name"] == "test-vnet"
    error_message = "Name tag should be auto-derived from network_vnet_name"
  }
}

# Test: count = 0 when create=false
run "create_disabled" {
  command = plan

  variables {
    network_vnet_create = false
    network_vnet_name   = "test-vnet"
    network_vnet_cidr   = "10.0.0.0/16"
  }

  assert {
    condition     = length(<provider>_network_vnet.this) == 0
    error_message = "expected zero vnets when create=false"
  }
}

# Test: tags are merged with the auto-derived Name tag
run "tags_merged" {
  command = plan

  variables {
    network_vnet_name = "test-vnet"
    network_vnet_cidr = "10.0.0.0/16"
    network_vnet_tags = {
      Environment = "test"
      Owner       = "platform"
    }
  }

  assert {
    condition = (
      <provider>_network_vnet.this[0].tags["Name"] == "test-vnet" &&
      <provider>_network_vnet.this[0].tags["Environment"] == "test" &&
      <provider>_network_vnet.this[0].tags["Owner"] == "platform"
    )
    error_message = "tags should include both consumer-provided and auto-derived Name"
  }
}
```

## modules/network/vnet/tests/integration.tftest.hcl

Full apply test against a sandbox account. Gated in CI behind credentials:

```hcl
run "integration" {
  command = apply

  variables {
    network_vnet_name = "test-${run.name}"
    network_vnet_cidr = "10.99.0.0/16"
    network_vnet_tags = {
      TestRun = run.name
    }
  }

  assert {
    condition     = output.network_vnet_id != ""
    error_message = "network_vnet_id must be populated after apply"
  }

  assert {
    condition     = length(output.network_vnet_id) > 0
    error_message = "network_vnet_id must be a non-empty string"
  }
}
```

## Running the tests

```bash
cd modules/network/vnet

# Initialize providers + test directory
terraform init -test-directory=tests

# Plan-only tests (fast)
terraform test -test-directory=tests -filter=tests/basic.tftest.hcl

# Integration test (slow, needs credentials and a sandbox account)
terraform test -test-directory=tests -filter=tests/integration.tftest.hcl

# All tests
terraform test -test-directory=tests
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
      - name: Run plan tests
        run: |
          for d in modules/*/*; do
            if [ -d "$d/tests" ]; then
              echo "Testing $d"
              (cd "$d" && terraform init -test-directory=tests \
                && terraform test -test-directory=tests -filter=tests/basic.tftest.hcl)
            fi
          done

  plan-examples:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - name: Plan all examples
        run: |
          for d in examples/*/*/*; do
            if [ -f "$d/main.tf" ]; then
              echo "Planning $d"
              (cd "$d" && terraform init -backend=false && terraform plan -input=false)
            fi
          done
```

## What this example demonstrates

- **Per-module `tests/` directory** with `basic.tftest.hcl` (plan-only, fast) and `integration.tftest.hcl` (apply, slow).
- **`run` blocks** with explicit `command = plan` or `command = apply`.
- **`assert` blocks** verifying both resource attributes (via internal references) and module outputs.
- **`run.name` for unique resource naming** in apply tests so parallel runs don't collide.
- **`examples/` directory** with a runnable basic example that doubles as documentation and a CI plan check.
- **CI integration** that gates fast plan tests on every PR and slower apply tests on credential availability.
