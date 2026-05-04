# Module anatomy

Load this when you need the file-by-file breakdown of the 8-file pattern. The structure is non-negotiable; consumers across the repo depend on it being predictable.

## Directory structure

```
modules/<service>/<resource>/
├── main.tf            # resource definition
├── variables.tf       # input variables, all prefixed
├── outputs.tf         # exported attributes
├── versions.tf        # terraform + provider version constraints
├── README.md          # static intro + terraform-docs injection block
└── wrappers/
    ├── main.tf        # batch-operation module
    ├── variables.tf   # only `defaults` and `items`
    ├── outputs.tf     # the `wrapper` map
    └── versions.tf    # same as root versions.tf
```

**Total: 2 directories, 9 files** (8 `.tf` files + 1 `README.md`).

## File-by-file

### `main.tf`

```hcl
resource "<provider>_<service>_<resource>" "this" {
  count = var.<prefix>_create ? 1 : 0

  # Required arguments
  name   = var.<prefix>_name
  region = var.<prefix>_region

  # Optional arguments
  description = var.<prefix>_description

  # Tags with merge pattern (Name tag always derived from <prefix>_name)
  tags = merge(
    var.<prefix>_tags,
    {
      Name = var.<prefix>_name,
    },
  )

  # Dynamic blocks (one per nested config; see dynamic-blocks.md)
  dynamic "<block>" {
    iterator = <block>_cfg
    for_each = can(length(var.<prefix>_<block>)) ? var.<prefix>_<block> : []

    content {
      field1 = lookup(<block>_cfg.value, "field1", null)
      field2 = lookup(<block>_cfg.value, "field2", null)
    }
  }
}
```

Notes:

- The resource label is **always `"this"`**. Do not name it after the resource type.
- The `count` line is the very first thing inside the resource block. Always.
- Tags pattern uses `merge()` so consumers can add tags without losing the auto-derived `Name`.

### `variables.tf`

Every variable starts with `<prefix>_`. The `<prefix>_create` toggle is always first. See `variable-patterns.md` for full coverage.

```hcl
variable "<prefix>_create" {
  description = "Controls if <resource> should be created"
  type        = bool
  default     = true
}

variable "<prefix>_region" {
  description = <<-EOT
    (Optional, String, ForceNew) Specifies the region in which to create the resource.
    If omitted, the provider-level region will be used.
  EOT
  type        = string
  default     = null
}

variable "<prefix>_name" {
  description = <<-EOT
    (Required, String) Specifies the name of the <resource>.
  EOT
  type        = string
  default     = ""
}
```

### `outputs.tf`

Every output uses the `try / element / concat` pattern. See `output-patterns.md`.

```hcl
output "<prefix>_id" {
  description = <<-EOT
    The resource ID.

    Type: String
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.id, [""]), 0), "")
}
```

### `versions.tf`

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
```

Pin a real minimum version. Never `~>` floating refs.

### `README.md`

Static intro outside the markers, terraform-docs injects between them. See `readme-and-terraform-docs.md` for the full template.

```markdown
# <resource> Module

Terraform module which creates a <resource> on <provider>.

## Usage

... (single + wrapper examples)

<!-- BEGIN_TF_DOCS -->

(terraform-docs auto-fills this)

<!-- END_TF_DOCS -->

## Notes

... (provider docs link, limitations)
```

### `wrappers/main.tf`

```hcl
module "wrapper" {
  source   = "../"
  for_each = var.items

  <prefix>_create = try(each.value.<prefix>_create, var.defaults.<prefix>_create, true)
  <prefix>_name   = try(each.value.<prefix>_name, var.defaults.<prefix>_name, "")
  # ... one line per root variable
}
```

### `wrappers/variables.tf`

Always exactly two variables, both **strictly typed** to mirror every root variable as `optional(<type>)`:

```hcl
variable "defaults" {
  description = "Map of default values which will be used for each item."
  type = object({
    <prefix>_create      = optional(bool)
    <prefix>_region      = optional(string)
    <prefix>_name        = optional(string)
    <prefix>_description = optional(string)
    <prefix>_tags        = optional(map(string))

    # Mirror every dynamic-block variable as optional(list(object({...}))).
    <prefix>_<block_name> = optional(list(object({
      field1 = string
      field2 = optional(string)
    })))

    # Timeouts — when the resource supports them.
    <prefix>_timeouts = optional(object({
      create = optional(string)
      update = optional(string)
      delete = optional(string)
    }))
  })
  default = {}
}

variable "items" {
  description = "Maps of items to create a wrapper from."
  type = map(object({
    # IDENTICAL field set to defaults — same names, types, optionality.
    <prefix>_create      = optional(bool)
    <prefix>_region      = optional(string)
    <prefix>_name        = optional(string)
    <prefix>_description = optional(string)
    <prefix>_tags        = optional(map(string))

    <prefix>_<block_name> = optional(list(object({
      field1 = string
      field2 = optional(string)
    })))

    <prefix>_timeouts = optional(object({
      create = optional(string)
      update = optional(string)
      delete = optional(string)
    }))
  }))
  default = {}
}
```

**`type = any` is no longer accepted** — typed wrappers are the contract because:

- Misspelled fields and wrong types fail at plan time instead of being silently ignored.
- IDE / editor autocompletes the field set.
- `terraform-docs` renders the full wrapper schema for consumers.

See `wrapper-pattern.md` for full coverage including how to mirror complex nested object types.

### `wrappers/outputs.tf`

```hcl
output "wrapper" {
  description = "Map of outputs of a wrapper."
  value       = module.wrapper
}
```

### `wrappers/versions.tf`

Identical to root `versions.tf`. Don't drift.

## Naming conventions

| Element             | Pattern                        | Example                       |
| ------------------- | ------------------------------ | ----------------------------- |
| Module path         | `modules/<service>/<resource>` | `modules/vpc/subnet`          |
| Resource label      | `"this"`                       | always literal                |
| Variable prefix     | `<service>_<resource>_*`       | `vpc_subnet_*`                |
| Iterator name       | `<block>_cfg`                  | `rule_cfg`, `tag_cfg`         |
| Hyphens in resource | become underscores in prefix   | `vpc-subnet` → `vpc_subnet`   |
| Output names        | `<prefix>_<attribute>`         | `vpc_subnet_id`               |
| Wrapper variables   | `defaults` + `items` (only)    | both `any`, both `{}` default |

## File count check

```bash
find <module-path> -maxdepth 2 -type f | wc -l   # → 9
find <module-path> -maxdepth 2 -type d | wc -l   # → 2 (root + wrappers/)
```

If those don't match, the module is the wrong shape. Don't ship it.

## When the module is special

Some genuinely simple modules don't need every block. Even then:

- Keep the 8-file `.tf` count. Empty stubs in `outputs.tf` are fine for resources with no exports.
- Keep the wrappers — even when there's no obvious batch use case. Consumers may compose multiple instances later.

The discipline of the structure pays back over the lifetime of the repo.
