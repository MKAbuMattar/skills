# Anti-patterns

Load this when reviewing or refactoring an existing module. Each entry names a pattern to remove and the better alternative.

## `list(any)` / `map(any)` for record variables

Bad:

```hcl
variable "<prefix>_rules" {
  type = list(any)
}
```

Good:

```hcl
variable "<prefix>_rules" {
  type = list(object({
    action   = string
    protocol = string
    port     = optional(number)
  }))
  default = []
}
```

`list(any)` accepts mismatched record shapes silently. The error surfaces deep in the resource block as a confusing message about a field that "doesn't exist". Proper object types fail at plan time with a clear error.

**`any` is banned everywhere — including the wrapper's `defaults` and `items`.** See the next section.

## Untyped wrapper variables (`type = any`)

Bad:

```hcl
# wrappers/variables.tf
variable "defaults" {
  type    = any
  default = {}
}

variable "items" {
  type    = any
  default = {}
}
```

Good:

```hcl
# wrappers/variables.tf
variable "defaults" {
  type = object({
    <prefix>_create = optional(bool)
    <prefix>_name   = optional(string)
    # ... one optional field per root variable
  })
  default = {}
}

variable "items" {
  type = map(object({
    <prefix>_create = optional(bool)
    <prefix>_name   = optional(string)
    # ... same field set as defaults
  }))
  default = {}
}
```

`type = any` was an early shortcut and is no longer accepted. Typed wrappers are the contract because:

- **Misspelled fields fail at plan time.** `defaults.<prefix>_namee` (typo) errors as "no such field" instead of being silently ignored.
- **Wrong types fail at plan time.** Passing a string to a `bool`-typed field errors out cleanly.
- **IDEs autocomplete the field set.** With `any`, you're flying blind.
- **`terraform-docs` renders the full wrapper schema.** Consumers see the exact shape.

Every root variable mirrors verbatim to both `defaults` and `items` as an `optional(<root-type>)` field. Same name, same type, same nested shape.

## Missing `iterator` on dynamic blocks

Bad:

```hcl
dynamic "rules" {
  for_each = var.<prefix>_rules
  content {
    action = rules.value.action
  }
}
```

Good:

```hcl
dynamic "rules" {
  iterator = rule_cfg
  for_each = var.<prefix>_rules
  content {
    action = rule_cfg.value.action
  }
}
```

Without `iterator`, the block name shadows the variable. `rules.value` is ambiguous — the convention solves this.

## Wrong `for_each` guard

Bad:

```hcl
for_each = var.<prefix>_rules != null ? var.<prefix>_rules : []
```

Good:

```hcl
for_each = can(length(var.<prefix>_rules)) ? var.<prefix>_rules : []
```

`!= null` doesn't handle the case where the variable is set to an empty list explicitly. `can(length(...))` does.

## Direct attribute reference on a resource with `count`

Bad:

```hcl
output "<prefix>_id" {
  value = <provider>_<service>_<resource>.this.id
}
```

Good:

```hcl
output "<prefix>_id" {
  value = try(element(concat(<provider>_<service>_<resource>.this.*.id, [""]), 0), "")
}
```

When `count = 0` (the resource isn't created), the direct reference fails. The `try / element / concat` chain returns the fallback.

## Separate timeout variables

Bad:

```hcl
variable "<prefix>_timeout_create" { ... }
variable "<prefix>_timeout_update" { ... }
variable "<prefix>_timeout_delete" { ... }
```

Good:

```hcl
variable "<prefix>_timeouts" {
  type = object({
    create = optional(string)
    update = optional(string)
    delete = optional(string)
  })
  default = {}
}
```

Single object variable. Wrapper threads it through cleanly.

## Hardcoded regions / project IDs / org defaults

Bad:

```hcl
variable "<prefix>_region" {
  default = "us-east-1"
}
```

Good:

```hcl
variable "<prefix>_region" {
  default = null   # falls back to provider-level region
}
```

A hardcoded default leaks the module author's environment into every consumer's stack.

## Missing `wrappers/`

Bad: a module with only the 4 root files.

Good: 8 files in 2 directories. The wrapper is non-negotiable — every module gets it, even when no current consumer needs batch operations. Future consumers will.

## Manual inputs/outputs tables in README

Bad:

```markdown
## Inputs

| Name             | Description    | Type     | Default | Required |
| ---------------- | -------------- | -------- | ------- | -------- |
| <prefix>_name    | The name       | `string` | `""`    | yes      |
| ...              | ...            | ...      | ...     | ...      |
```

Good:

```markdown
<!-- BEGIN_TF_DOCS -->
<!-- terraform-docs auto-injects -->
<!-- END_TF_DOCS -->
```

Manual tables drift instantly. terraform-docs owns them.

## Floating provider versions

Bad:

```hcl
required_providers {
  aws = {
    source  = "hashicorp/aws"
    version = "~> 5"
  }
}
```

Good:

```hcl
required_providers {
  aws = {
    source  = "hashicorp/aws"
    version = ">= 5.50.0"
  }
}
```

`~> 5` accepts every minor version up to `< 6`. Any minor release can break behavior. Use a real lower bound.

## Mixing `count` and `for_each` on the same resource

Bad:

```hcl
resource "<provider>_<service>_<resource>" "this" {
  count    = var.<prefix>_create ? 1 : 0
  for_each = var.<prefix>_items   # error: cannot mix count and for_each
}
```

Pick one. The convention in this skill is `count` for the create-toggle and `for_each` only at the wrapper layer.

## Missing `Name` tag merge

Bad:

```hcl
tags = var.<prefix>_tags
```

Good:

```hcl
tags = merge(
  var.<prefix>_tags,
  { Name = var.<prefix>_name },
)
```

The `Name` tag is the universal cloud convention for "what is this resource called in human terms". Always derive it from `<prefix>_name` and merge with consumer-supplied tags.

## Using `data.tf` / `locals.tf` as separate files

Bad:

```
modules/<service>/<resource>/
├── main.tf
├── variables.tf
├── outputs.tf
├── versions.tf
├── data.tf       # ← extra
├── locals.tf     # ← extra
└── wrappers/...
```

Good: fold `data` blocks and `locals` into `main.tf`. The 4-file count is the contract.

## Per-resource variables in `wrappers/variables.tf`

Bad:

```hcl
# wrappers/variables.tf
variable "<prefix>_name" { ... }
variable "<prefix>_tags" { ... }
```

Good:

```hcl
# wrappers/variables.tf — exactly two variables
variable "defaults" { type = any; default = {} }
variable "items"    { type = any; default = {} }
```

The wrapper threads root variables through `try(each.value.x, var.defaults.x, <fallback>)`. It never declares them.

## Forgetting to wrap stale references

When you rename a variable in `variables.tf`, you must also:

1. Update every reference in `main.tf`.
2. Update the corresponding line in `wrappers/main.tf`.
3. Re-run terraform-docs to regenerate the README inputs table.

A rename PR that misses step 2 or 3 will pass CI on first push but break the next consumer.

## Skipping `terraform fmt`

Run `terraform fmt -recursive` before every commit. Pre-commit's `terraform_fmt` hook enforces this.

## Adding `data` blocks for resources that should be inputs

Bad:

```hcl
# main.tf
data "<provider>_subnet" "default" {
  filter { ... }   # picks "the right" subnet at runtime
}

resource "<provider>_<service>_<resource>" "this" {
  subnet_id = data.<provider>_subnet.default.id
}
```

Good:

```hcl
variable "<prefix>_subnet_id" {
  description = <<-EOT
    (Required, String) The subnet ID to attach this resource to.
  EOT
  type    = string
  default = ""
}

resource "<provider>_<service>_<resource>" "this" {
  subnet_id = var.<prefix>_subnet_id
}
```

A `data` block hides a runtime decision that should be the consumer's. Inputs are explicit; data lookups are implicit. Modules should be explicit.

`data` blocks are fine for things the consumer genuinely can't know (current AWS account ID, current Azure tenant, the latest AMI for a given filter). Use sparingly, and document what the data lookup is doing.

## Inline `provider` blocks in modules

Bad:

```hcl
# modules/<service>/<resource>/main.tf
provider "aws" {
  region = "us-east-1"
}
```

Modules never declare `provider` blocks. They only declare `required_providers` in `versions.tf`. The consumer configures providers at the root.

## Outputting credentials without `sensitive = true`

Bad:

```hcl
output "<prefix>_password" {
  value = <provider>_<service>_<resource>.this.password
}
```

Good:

```hcl
output "<prefix>_password" {
  sensitive = true
  value     = try(element(concat(<provider>_<service>_<resource>.this.*.password, [""]), 0), "")
}
```

`sensitive = true` keeps the value out of `plan` / `apply` output and the state's human view.
