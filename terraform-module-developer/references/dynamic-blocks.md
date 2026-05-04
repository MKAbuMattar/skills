# Dynamic blocks

Load this when the resource has nested configuration blocks. The pattern is fixed; this file shows the variations.

## The pattern

```hcl
dynamic "<block_name>" {
  iterator = <block_name>_cfg
  for_each = can(length(var.<prefix>_<block_name>)) ? var.<prefix>_<block_name> : []

  content {
    field1 = lookup(<block_name>_cfg.value, "field1", null)
    field2 = lookup(<block_name>_cfg.value, "field2", null)
  }
}
```

Three things make this non-negotiable:

1. **`iterator = <block_name>_cfg`** — without it, the block name _shadows_ the variable. With `_cfg`, you get a clean reference (`<block_name>_cfg.value.field`) and the variable name stays available.
2. **`can(length(...))`** — handles `null` AND `undefined` AND empty list in one expression. `var.x != null ? var.x : []` only handles null.
3. **`lookup(..., "field", null)`** for optional fields — for required fields, use `<block_name>_cfg.value.field` directly.

## Required vs optional fields

```hcl
content {
  # Required field: direct reference (errors if missing — provider rejects)
  action = <block_name>_cfg.value.action

  # Optional field: lookup with null default
  description = lookup(<block_name>_cfg.value, "description", null)
}
```

For optional fields with a meaningful default at the provider level, prefer `null` so the provider's default applies. Use a non-null default only when the module has its own opinion.

## Nested dynamic blocks

```hcl
dynamic "lifecycle_rule" {
  iterator = rule_cfg
  for_each = can(length(var.<prefix>_lifecycle_rule)) ? var.<prefix>_lifecycle_rule : []

  content {
    name    = rule_cfg.value.name
    enabled = lookup(rule_cfg.value, "enabled", true)

    # Nested optional block: presence check + single-element list wrapper
    dynamic "expiration" {
      iterator = exp_cfg
      for_each = can(rule_cfg.value.expiration) ? [rule_cfg.value.expiration] : []

      content {
        days                         = lookup(exp_cfg.value, "days", null)
        date                         = lookup(exp_cfg.value, "date", null)
        expired_object_delete_marker = lookup(exp_cfg.value, "expired_object_delete_marker", null)
      }
    }
  }
}
```

The nested `expiration` is wrapped in `[rule_cfg.value.expiration]` — a single-element list — because the outer iterator gives one rule at a time, and the nested block is `optional(object({...}))`.

For nested _list_ blocks (multiple of the same nested config):

```hcl
dynamic "rule_filter" {
  iterator = filter_cfg
  for_each = can(length(rule_cfg.value.filters)) ? rule_cfg.value.filters : []

  content {
    prefix = lookup(filter_cfg.value, "prefix", null)
  }
}
```

## Variable definition

The variable that drives a dynamic block is always `list(object({...}))`:

```hcl
variable "<prefix>_<block_name>" {
  description = <<-EOT
    Specifies the <block_name> configuration. The block supports:
    - field1 - (Required, String) Description from registry.
    - field2 - (Optional, String) Description from registry.
  EOT
  type = list(object({
    field1 = string
    field2 = optional(string)
  }))
  default = []
}
```

The default `[]` is what makes the `can(length(...))` work cleanly — empty list bypasses the dynamic block entirely.

For optional nested objects (single instance):

```hcl
type = list(object({
  name = string
  expiration = optional(object({
    days = optional(number)
    date = optional(string)
  }))
}))
```

## Multiple dynamic blocks of the same shape

Some resources expose ingress and egress rules as separate blocks. Apply the same pattern twice:

```hcl
dynamic "ingress_rules" {
  iterator = rule_cfg
  for_each = can(length(var.<prefix>_ingress_rules)) ? var.<prefix>_ingress_rules : []

  content {
    action     = rule_cfg.value.action
    protocol   = rule_cfg.value.protocol
    ip_version = rule_cfg.value.ip_version

    source_ip_address               = lookup(rule_cfg.value, "source_ip_address", null)
    source_ip_address_group_id      = lookup(rule_cfg.value, "source_ip_address_group_id", null)
    destination_ip_address          = lookup(rule_cfg.value, "destination_ip_address", null)
    destination_ip_address_group_id = lookup(rule_cfg.value, "destination_ip_address_group_id", null)
  }
}

dynamic "egress_rules" {
  iterator = rule_cfg
  for_each = can(length(var.<prefix>_egress_rules)) ? var.<prefix>_egress_rules : []

  content {
    action     = rule_cfg.value.action
    protocol   = rule_cfg.value.protocol
    ip_version = rule_cfg.value.ip_version

    source_ip_address               = lookup(rule_cfg.value, "source_ip_address", null)
    source_ip_address_group_id      = lookup(rule_cfg.value, "source_ip_address_group_id", null)
    destination_ip_address          = lookup(rule_cfg.value, "destination_ip_address", null)
    destination_ip_address_group_id = lookup(rule_cfg.value, "destination_ip_address_group_id", null)
  }
}
```

Both can use `iterator = rule_cfg` because each `dynamic` block has its own scope.

## When NOT to use a dynamic block

If the resource has a fixed-shape nested block that the consumer always sets, just inline it with regular variable references:

```hcl
# Resource has exactly one server_side_encryption block, never variable count
server_side_encryption_configuration {
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = var.<prefix>_sse_algorithm
    }
  }
}
```

Use dynamic blocks only when the consumer needs zero-to-many of the block.

## Anti-patterns

- **Missing `iterator`**: `dynamic "rules" { for_each = var.rules }` — the block name shadows the variable; the next `rules.value.x` is ambiguous.
- **`var.x != null ? var.x : []`**: doesn't handle the case where the variable is set to an empty list directly. `can(length(var.x)) ? var.x : []` does.
- **Direct `<block_name>_cfg.value.optional_field`** for optional fields: errors when the field is missing. Use `lookup`.
- **`for_each` on the dynamic block + `count` on the outer resource**: works, but consumers find it confusing. Pick one — usually the outer `count` is enough; `for_each` for the dynamic; never both at the resource level.
- **Hardcoded values inside `content`**: defeats the purpose of dynamic. Pass everything through `lookup` or direct references.
- **Forgetting the `_cfg` suffix on the iterator**: convention is universal. Without it, code review picks up the inconsistency.
