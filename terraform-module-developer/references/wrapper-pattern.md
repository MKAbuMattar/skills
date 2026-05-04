# Wrapper pattern

Load this when filling in `wrappers/`. The wrapper exists so consumers can stamp out N instances of the module via `for_each`, with per-item overrides on top of shared defaults — and the wrapper's variables are **strictly typed** to mirror the root module's surface.

## What the wrapper does

```hcl
module "many_subnets" {
  source = "./modules/vpc/subnet/wrappers"

  defaults = {
    vpc_subnet_region = "<region>"
    vpc_subnet_tags = {
      Terraform   = "true"
      Environment = "dev"
    }
  }

  items = {
    public  = { vpc_subnet_name = "public-subnet",  vpc_subnet_cidr = "10.0.0.0/24" }
    private = { vpc_subnet_name = "private-subnet", vpc_subnet_cidr = "10.0.1.0/24" }
    db      = { vpc_subnet_name = "db-subnet",      vpc_subnet_cidr = "10.0.2.0/24" }
  }
}
```

Each entry in `items` instantiates the module once. Per-item values override `defaults`, which override the module's own defaults. **Both `defaults` and `items` are typed — the consumer gets compile-time errors when a field is misspelled or has the wrong type.**

## File-by-file

### `wrappers/main.tf`

```hcl
module "wrapper" {
  source   = "../"
  for_each = var.items

  <prefix>_create      = try(each.value.<prefix>_create, var.defaults.<prefix>_create, true)
  <prefix>_region      = try(each.value.<prefix>_region, var.defaults.<prefix>_region, null)
  <prefix>_name        = try(each.value.<prefix>_name, var.defaults.<prefix>_name, "")
  <prefix>_description = try(each.value.<prefix>_description, var.defaults.<prefix>_description, null)
  <prefix>_tags        = try(each.value.<prefix>_tags, var.defaults.<prefix>_tags, {})
  <prefix>_timeouts    = try(each.value.<prefix>_timeouts, var.defaults.<prefix>_timeouts, {})

  # One line per dynamic-block variable
  <prefix>_<block_name> = try(each.value.<prefix>_<block_name>, var.defaults.<prefix>_<block_name>, [])
}
```

The `try(each.value, var.defaults, <fallback>)` chain is non-negotiable. It's a 3-level lookup: per-item → shared defaults → module's own default. Each fallback matches the type the variable expects (`""` for strings, `null` for nullable strings, `{}` for maps, `[]` for lists, `true`/`false` for bools, `0` for numbers).

### `wrappers/variables.tf` — typed object shape (REQUIRED)

```hcl
variable "defaults" {
  description = "Map of default values which will be used for each item."
  type = object({
    <prefix>_create      = optional(bool)
    <prefix>_region      = optional(string)
    <prefix>_name        = optional(string)
    <prefix>_description = optional(string)
    <prefix>_tags        = optional(map(string))

    # Every dynamic-block variable in the root mirrored here as optional(list(object({...}))).
    <prefix>_<block_name> = optional(list(object({
      field1 = string
      field2 = optional(string)
    })))

    # Timeouts — when the resource supports timeouts.
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
    # IDENTICAL field set to defaults — same names, same types, same optionality.
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

Three rules:

1. **`defaults` is `object({...})`. `items` is `map(object({...}))`.** Same shape inside both — `items` just adds the `map` key for batching.
2. **Every field is `optional(<type>)`.** The consumer can supply partial specs at either layer; the `try()` chain in `main.tf` falls back through them.
3. **`default = {}`** on both — empty map is the no-op state.

### Why typed (not `any`)

`type = any` was an old shortcut. Typed wrappers are the contract because:

- **Misspelled fields fail at plan time, not runtime.** `defaults.vpc_subnet_namee` (typo) becomes a clear "no such field" error instead of silently being ignored.
- **Wrong types fail at plan time.** Passing a string to `<prefix>_disabled` (a bool) errors out instead of producing a confusing downstream cast.
- **Editor / IDE autocompletes the field set.** With `any`, you're flying blind.
- **`terraform-docs` renders the wrapper's full schema.** Consumers see the exact shape.

The cost is one place to add new fields when the root module grows — but you already have to update `wrappers/main.tf` for every new variable (the `try()` line). The typed object is the same change in the same change-set.

### Mirroring complex root variables

The wrapper's typed object **must mirror the root module's complex types verbatim**, not flatten them.

If the root has:

```hcl
variable "<prefix>_scope_selectors" {
  type = list(object({
    key = string
    value = list(object({
      decoration = string
      kind       = string
      pattern    = string
      extras     = optional(string)
    }))
  }))
  default = []
}
```

Then the wrapper has:

```hcl
<prefix>_scope_selectors = optional(list(object({
  key = string
  value = list(object({
    decoration = string
    kind       = string
    pattern    = string
    extras     = optional(string)
  }))
})))
```

The whole nested type is wrapped in a single outer `optional(...)` — that's the only addition. Inner `optional()` markers stay where they were.

### `wrappers/outputs.tf`

```hcl
output "wrapper" {
  description = "Map of outputs of a wrapper."
  value       = module.wrapper
}
```

A consumer accesses each instance as `module.many_subnets.wrapper["public"].<prefix>_id`.

### `wrappers/versions.tf`

Identical to root `versions.tf`. Don't drift.

## Wrapper validation

Run `terraform validate` from inside `wrappers/` separately. The wrapper has its own working directory; a typo in `wrappers/main.tf` won't be caught by validating the root.

```bash
(cd modules/<service>/<resource>          && terraform fmt && terraform validate)
(cd modules/<service>/<resource>/wrappers && terraform fmt && terraform validate)
```

## Updating the wrapper when the root changes

Every change to `<service>/<resource>/variables.tf` requires three follow-up changes in the same change-set:

1. **Add the new variable's field** to both `defaults` and `items` typed objects in `wrappers/variables.tf`.
2. **Add a `try()` line** in `wrappers/main.tf` threading the new variable through.
3. **Re-run `terraform-docs`** so both READMEs (root and wrapper) reflect the new surface.

If you forget step 1, the wrapper compiles but silently rejects the field (because it's not in the type). If you forget step 2, the wrapper compiles but the field is unreachable. Both are caught by integration tests that exercise the wrapper.

## Anti-patterns

- **`type = any`** for `defaults` or `items`: legacy, no longer accepted. Always typed.
- **Per-resource variables in `wrappers/variables.tf`** beyond `defaults` and `items`: only those two, never anything else.
- **Drift between root `variables.tf` and wrapper's typed object**: every new root variable lands in the wrapper's typed object in the same PR.
- **Flat (de-prefixed) field names in wrapper objects**: the wrapper's field names must match the root variable names verbatim. `<prefix>_name`, not `name`.
- **Wrapping `for_each` over a `list`**: `var.items` is `map(object(...))`, not `list(object(...))`. Lists don't have stable keys; map keys become the wrapper's `each.key`.
- **Output named `wrappers`** instead of `wrapper`: convention is singular, matching the inner module label.
- **Inner-type drift**: when a root variable's nested object adds/removes a field, the wrapper's mirror must match exactly.
