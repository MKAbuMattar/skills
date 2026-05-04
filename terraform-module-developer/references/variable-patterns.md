# Variable patterns

Load this when filling in `variables.tf`. Naming, heredoc docs, complex object types, optional fields, and the `<prefix>_timeouts` object pattern.

## Naming

Every variable starts with the resource prefix. The prefix is `<service>_<resource>` with hyphens turned into underscores.

| Module path                | Prefix             | Variable example         |
| -------------------------- | ------------------ | ------------------------ |
| `modules/vpc/subnet`       | `vpc_subnet`       | `vpc_subnet_name`        |
| `modules/storage/bucket`   | `storage_bucket`   | `storage_bucket_acl`     |
| `modules/compute/instance` | `compute_instance` | `compute_instance_image` |
| `modules/iam/role-policy`  | `iam_role_policy`  | `iam_role_policy_doc`    |

Why the prefix matters: consumers often instantiate multiple modules. Without prefixes, `var.name` collides at every layer.

## Always-present variables

Every module declares these three first, in this order:

```hcl
variable "<prefix>_create" {
  description = <<-EOT
    Controls if <resource> should be created (it affects almost all resources)
  EOT
  type        = bool
  default     = true
}

variable "<prefix>_region" {
  description = <<-EOT
    (Optional, String, ForceNew) Specifies the region in which to create the resource.
    If omitted, the provider-level region will be used. Changing this creates a new resource.
  EOT
  type        = string
  default     = null
}

variable "<prefix>_name" {
  description = <<-EOT
    (Required, String) Specifies the name of the <resource>.

    <copy the full sentence from the provider registry here>
  EOT
  type        = string
  default     = ""
}
```

The `_create` toggle gates the `count = ...` on the resource. The `_region` defaults to `null` so the provider-level region wins when the consumer doesn't override.

## Heredoc descriptions

Always heredoc, never a one-liner. The first line declares the type and constraints in the provider's own language; the rest gives detail.

```hcl
variable "<prefix>_<argument>" {
  description = <<-EOT
    (Required|Optional, <Type>[, ForceNew]) Specifies the <argument>.

    <full sentence from the provider registry>

    Valid values: <list>.
  EOT
  type    = <type>
  default = <default>
}
```

Why heredoc: the description shows up verbatim in `terraform-docs` output, in IDE tooltips, and in `terraform plan` errors. It's the consumer's primary documentation surface — make it complete.

## Complex object types

For any list-of-records variable, use `list(object({...}))` with `optional()` for optional fields.

```hcl
variable "<prefix>_<block>" {
  description = <<-EOT
    Specifies the <block> configuration. The block supports:
    - field1 - (Required, String) Description from registry.
    - field2 - (Optional, String) Description from registry.
    - field3 - (Optional, Number) Description from registry. Default: 30.
  EOT
  type = list(object({
    field1 = string
    field2 = optional(string)
    field3 = optional(number)
  }))
  default = []
}
```

Never `list(any)` for records — it loses type safety and consumer-side error messages get worse. The block-level description must list every field with its required/optional status.

For map-of-records:

```hcl
variable "<prefix>_<map_block>" {
  type = map(object({
    field1 = string
    field2 = optional(string)
  }))
  default = {}
}
```

For nested optional records:

```hcl
type = list(object({
  name = string
  config = optional(object({
    enabled = bool
    ttl     = optional(number)
  }))
}))
```

## Tags

Always present, always `map(string)`, always defaulted to `{}`:

```hcl
variable "<prefix>_tags" {
  description = <<-EOT
    (Optional, Map) Specifies the key/value pairs to associate with the <resource>.

    Tags consumers set will be merged with an automatic `Name` tag derived from <prefix>_name.
  EOT
  type    = map(string)
  default = {}
}
```

The `merge()` for the `Name` tag lives in `main.tf`, not in the variable.

## Timeouts (single object pattern)

When the resource supports timeouts (`create`, `update`, `delete`), use **one** object variable. Never three separate variables.

### Variable

```hcl
variable "<prefix>_timeouts" {
  description = <<-EOT
    Specifies the timeouts for resource operations.

    The timeouts block supports:
    - create - (Optional, String) Timeout for create operation. Default: 10m.
    - update - (Optional, String) Timeout for update operation. Default: 10m.
    - delete - (Optional, String) Timeout for delete operation. Default: 3m.
  EOT
  type = object({
    create = optional(string)
    update = optional(string)
    delete = optional(string)
  })
  default = {}
}
```

### main.tf usage

```hcl
resource "<provider>_<service>_<resource>" "this" {
  count = var.<prefix>_create ? 1 : 0

  name = var.<prefix>_name

  timeouts {
    create = try(var.<prefix>_timeouts.create, "10m")
    update = try(var.<prefix>_timeouts.update, "10m")
    delete = try(var.<prefix>_timeouts.delete, "3m")
  }
}
```

Always provide a sensible default in `main.tf`'s `try()`. The variable's `default = {}` means consumers don't have to set anything; the `try()` chain falls back to the inline default.

### wrapper handling

```hcl
# wrappers/main.tf
<prefix>_timeouts = try(each.value.<prefix>_timeouts, var.defaults.<prefix>_timeouts, {})
```

## Variable validation

For arguments with strict valid-value lists, add a `validation` block:

```hcl
variable "<prefix>_action" {
  description = <<-EOT
    (Required, String) Specifies the action. Valid values: allow, deny.
  EOT
  type    = string
  default = "allow"

  validation {
    condition     = contains(["allow", "deny"], var.<prefix>_action)
    error_message = "<prefix>_action must be one of: allow, deny."
  }
}
```

Validation blocks fire at `plan` time. They surface bad inputs before any API call.

## Sensitive variables

For secrets / tokens / private keys:

```hcl
variable "<prefix>_secret_value" {
  description = <<-EOT
    (Required, String, Sensitive) Specifies the secret value.
  EOT
  type      = string
  sensitive = true
  default   = ""
}
```

`sensitive = true` redacts the value from `plan` and `apply` output.

## Order of variables in the file

1. `<prefix>_create` (always first).
2. `<prefix>_region`.
3. `<prefix>_name`.
4. Other required arguments (alphabetical).
5. Optional arguments (alphabetical).
6. `<prefix>_tags`.
7. `<prefix>_timeouts` (if applicable).
8. Dynamic-block variables (alphabetical).

Consistency across modules makes the codebase easy to scan.

## Anti-patterns

- `list(any)` or `map(any)` — banned in root modules. Use proper object types.
- `default = ""` for required-string variables when the provider rejects `""` — use `null` or omit the default to force the consumer to set it.
- Multiple separate timeout vars (`<prefix>_timeout_create`, `<prefix>_timeout_update`) — use the object pattern.
- Description as a single string when it should be heredoc — costs nothing, gains formatting and `terraform-docs` cleanliness.
- Forgetting `optional()` on optional object fields — Terraform will reject any input that doesn't supply the field.
