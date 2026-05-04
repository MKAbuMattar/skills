# Output patterns

Load this when filling in `outputs.tf`. The pattern is fixed; this file documents what it does and how to apply it to different attribute shapes.

## The pattern

```hcl
output "<prefix>_<attribute>" {
  description = <<-EOT
    <one-line description>.

    Type: <Type>
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.<attribute>, [<default>]), 0), <fallback>)
}
```

The `try / element / concat` chain handles three failure modes in one expression:

1. **`count = 0`** — resource not created (because `<prefix>_create = false`). `<resource>.this.*` is an empty list; `concat(..., [<default>])` makes it a one-element list; `element(..., 0)` returns `<default>`.
2. **Attribute is null** — provider didn't populate the field. `try(..., <fallback>)` returns `<fallback>`.
3. **Attribute doesn't exist on this provider version** — older provider that's missing a recent attribute. `try` swallows the error.

## By attribute type

### String attribute

```hcl
output "<prefix>_id" {
  description = <<-EOT
    The resource ID in UUID format.

    Type: String
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.id, [""]), 0), "")
}
```

Default `[""]`, fallback `""`.

### List attribute (e.g., availability zones)

```hcl
output "<prefix>_availability_zones" {
  description = <<-EOT
    The availability zones the resource spans.

    Type: List(String)
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.availability_zones, [[]]), 0), [])
}
```

Default `[[]]` (a list containing one empty list), fallback `[]`.

### Map attribute (e.g., tags)

```hcl
output "<prefix>_tags" {
  description = <<-EOT
    The tags associated with the resource.

    Type: Map(String)
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.tags, [{}]), 0), {})
}
```

Default `[{}]`, fallback `{}`.

### Object attribute (rare)

```hcl
output "<prefix>_endpoint_config" {
  description = <<-EOT
    The endpoint configuration object.

    Type: Object
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.endpoint_config, [null]), 0), null)
}
```

Default `[null]`, fallback `null`.

### Number attribute

```hcl
output "<prefix>_port" {
  description = <<-EOT
    The port the resource listens on.

    Type: Number
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.port, [0]), 0), 0)
}
```

Default `[0]`, fallback `0`.

### Boolean attribute

```hcl
output "<prefix>_enabled" {
  description = <<-EOT
    Whether the resource is enabled.

    Type: Bool
  EOT
  value = try(element(concat(<provider>_<service>_<resource>.this.*.enabled, [false]), 0), false)
}
```

Default `[false]`, fallback `false`.

## What to output

For every module, output at minimum:

- `<prefix>_id` — the resource ID.
- `<prefix>_name` — the name (echoes the input, but lets composition skip a `var` lookup).
- `<prefix>_region` — the region (same reason).

When the resource has these standard attributes, also output:

- `<prefix>_status` / `<prefix>_state`.
- `<prefix>_arn` / `<prefix>_self_link` / `<prefix>_urn` (provider-specific resource identifier).
- `<prefix>_created_at` / `<prefix>_updated_at`.
- `<prefix>_description`.
- `<prefix>_tags`.

For resources that produce data the consumer needs to wire to other resources:

- `<prefix>_endpoint` / `<prefix>_dns_name`.
- `<prefix>_subnet_ids` / `<prefix>_security_group_ids`.
- `<prefix>_credentials_*` (when applicable; mark sensitive).

## Sensitive outputs

For secrets / tokens / passwords:

```hcl
output "<prefix>_password" {
  description = <<-EOT
    The auto-generated password.

    Type: String (Sensitive)
  EOT
  sensitive = true
  value = try(element(concat(<provider>_<service>_<resource>.this.*.password, [""]), 0), "")
}
```

`sensitive = true` keeps the value out of `plan` / `apply` output and the state's human view.

## Transforming attributes

When the consumer needs a specific shape, do the transformation in the output, not in `main.tf`. Outputs are pure expressions; transformations there don't affect the resource.

```hcl
output "<prefix>_endpoint_url" {
  description = "Constructed endpoint URL."
  value = try(
    "https://${element(concat(<provider>_<service>_<resource>.this.*.dns_name, [""]), 0)}",
    "",
  )
}
```

## Anti-patterns

- **Direct attribute reference**: `value = <provider>_<service>_<resource>.this.id` — fails at `count = 0`.
- **`one()`** for the index: works on Terraform 1.3+, but `try / element / concat` is more compatible and handles null attrs better.
- **Outputs with no `description`**: terraform-docs renders an empty cell. Always describe.
- **Outputting raw lists when the consumer expects a single value**: pick one or the other; don't make consumers `[0]` your output.
- **Forgetting `try()`**: if the attribute doesn't exist on an older provider version, your module breaks for users on the lower bound of `>= <version>`.
