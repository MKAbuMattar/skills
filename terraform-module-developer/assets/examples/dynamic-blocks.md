# Dynamic blocks example: a storage bucket with lifecycle rules

A module with multiple dynamic blocks, including nested optional blocks. Demonstrates the iterator pattern, nested dynamic blocks, and complex object types.

**Layout:** `modules/storage/bucket/`

## main.tf (excerpt — dynamic blocks)

```hcl
resource "<provider>_storage_bucket" "this" {
  count = var.storage_bucket_create ? 1 : 0

  name        = var.storage_bucket_name
  region      = var.storage_bucket_region
  acl         = var.storage_bucket_acl
  description = var.storage_bucket_description

  tags = merge(
    var.storage_bucket_tags,
    { Name = var.storage_bucket_name },
  )

  # Lifecycle rules (a list of objects with optional nested objects)
  dynamic "lifecycle_rule" {
    iterator = rule_cfg
    for_each = can(length(var.storage_bucket_lifecycle_rule)) ? var.storage_bucket_lifecycle_rule : []

    content {
      name    = rule_cfg.value.name
      enabled = lookup(rule_cfg.value, "enabled", true)
      prefix  = lookup(rule_cfg.value, "prefix", null)

      # Nested optional block: expiration
      dynamic "expiration" {
        iterator = exp_cfg
        for_each = can(rule_cfg.value.expiration) ? [rule_cfg.value.expiration] : []

        content {
          days                         = lookup(exp_cfg.value, "days", null)
          date                         = lookup(exp_cfg.value, "date", null)
          expired_object_delete_marker = lookup(exp_cfg.value, "expired_object_delete_marker", null)
        }
      }

      # Nested optional block: noncurrent_version_expiration
      dynamic "noncurrent_version_expiration" {
        iterator = ncv_cfg
        for_each = can(rule_cfg.value.noncurrent_version_expiration) ? [rule_cfg.value.noncurrent_version_expiration] : []

        content {
          days = lookup(ncv_cfg.value, "days", null)
        }
      }
    }
  }

  # Logging (a single optional object)
  dynamic "logging" {
    iterator = log_cfg
    for_each = can(var.storage_bucket_logging) && var.storage_bucket_logging != null ? [var.storage_bucket_logging] : []

    content {
      target_bucket = log_cfg.value.target_bucket
      target_prefix = lookup(log_cfg.value, "target_prefix", null)
    }
  }

  # CORS rules (a list)
  dynamic "cors_rule" {
    iterator = cors_cfg
    for_each = can(length(var.storage_bucket_cors_rule)) ? var.storage_bucket_cors_rule : []

    content {
      allowed_origins = cors_cfg.value.allowed_origins
      allowed_methods = cors_cfg.value.allowed_methods
      allowed_headers = lookup(cors_cfg.value, "allowed_headers", null)
      expose_headers  = lookup(cors_cfg.value, "expose_headers", null)
      max_age_seconds = lookup(cors_cfg.value, "max_age_seconds", null)
    }
  }
}
```

## variables.tf (excerpt — complex types)

```hcl
variable "storage_bucket_lifecycle_rule" {
  description = <<-EOT
    Specifies the lifecycle rules. The lifecycle_rule block supports:
    - name - (Required, String) The rule name.
    - enabled - (Optional, Bool) Whether the rule is enabled. Default: true.
    - prefix - (Optional, String) Prefix matching rule.
    - expiration - (Optional, Object) Object expiration policy.
      - days - (Optional, Number) Days until expiration.
      - date - (Optional, String) Expiration date in YYYY-MM-DD format.
      - expired_object_delete_marker - (Optional, Bool) Whether to clean up delete markers.
    - noncurrent_version_expiration - (Optional, Object) Non-current version expiration.
      - days - (Optional, Number) Days until non-current version is removed.
  EOT
  type = list(object({
    name    = string
    enabled = optional(bool)
    prefix  = optional(string)
    expiration = optional(object({
      days                         = optional(number)
      date                         = optional(string)
      expired_object_delete_marker = optional(bool)
    }))
    noncurrent_version_expiration = optional(object({
      days = optional(number)
    }))
  }))
  default = []
}

variable "storage_bucket_logging" {
  description = <<-EOT
    Specifies the logging configuration. The block supports:
    - target_bucket - (Required, String) The target bucket for log delivery.
    - target_prefix - (Optional, String) Prefix prepended to log object keys.
  EOT
  type = object({
    target_bucket = string
    target_prefix = optional(string)
  })
  default = null
}

variable "storage_bucket_cors_rule" {
  description = <<-EOT
    Specifies the CORS rules. The cors_rule block supports:
    - allowed_origins - (Required, List(String)) Origins allowed to make CORS requests.
    - allowed_methods - (Required, List(String)) HTTP methods allowed (GET, PUT, POST, DELETE, HEAD).
    - allowed_headers - (Optional, List(String)) Headers allowed in cross-origin requests.
    - expose_headers - (Optional, List(String)) Headers exposed to the consumer in CORS responses.
    - max_age_seconds - (Optional, Number) How long the browser caches CORS preflight responses.
  EOT
  type = list(object({
    allowed_origins = list(string)
    allowed_methods = list(string)
    allowed_headers = optional(list(string))
    expose_headers  = optional(list(string))
    max_age_seconds = optional(number)
  }))
  default = []
}
```

## What this example demonstrates

- **Multiple dynamic blocks** in one resource: lifecycle_rule, logging, cors_rule.
- **Nested optional dynamic blocks**: expiration and noncurrent_version_expiration inside lifecycle_rule.
- **Single-instance optional block** pattern (logging): wrap the value in `[var.x]` when present.
- **List-of-records optional blocks** (lifecycle_rule, cors_rule): use `can(length(...)) ? var.x : []`.
- **`lookup` for optional fields, direct reference for required fields.**
- **Comprehensive heredoc descriptions** that document every nested field.

## Wrapper handling

The wrapper's `defaults` and `items` are typed objects. Every root-module dynamic-block variable mirrors verbatim into the wrapper's typed object as an `optional(<root-type>)` field — the inner shape is **identical**, just wrapped in one outer `optional(...)`:

```hcl
# wrappers/variables.tf (excerpt)
variable "defaults" {
  description = "Map of default values which will be used for each item."
  type = object({
    storage_bucket_create      = optional(bool)
    storage_bucket_name        = optional(string)
    storage_bucket_acl         = optional(string)
    storage_bucket_region      = optional(string)
    storage_bucket_description = optional(string)
    storage_bucket_tags        = optional(map(string))

    storage_bucket_lifecycle_rule = optional(list(object({
      name    = string
      enabled = optional(bool)
      prefix  = optional(string)
      expiration = optional(object({
        days                         = optional(number)
        date                         = optional(string)
        expired_object_delete_marker = optional(bool)
      }))
      noncurrent_version_expiration = optional(object({
        days = optional(number)
      }))
    })))

    storage_bucket_logging = optional(object({
      target_bucket = string
      target_prefix = optional(string)
    }))

    storage_bucket_cors_rule = optional(list(object({
      allowed_origins = list(string)
      allowed_methods = list(string)
      allowed_headers = optional(list(string))
      expose_headers  = optional(list(string))
      max_age_seconds = optional(number)
    })))
  })
  default = {}
}

variable "items" {
  description = "Maps of items to create a wrapper from."
  type        = map(object({ # ... same field set as defaults ... }))
  default     = {}
}
```

In `wrappers/main.tf`, every list-typed variable falls back to `[]`; every nullable-object variable falls back to `null`:

```hcl
storage_bucket_lifecycle_rule = try(each.value.storage_bucket_lifecycle_rule, var.defaults.storage_bucket_lifecycle_rule, [])
storage_bucket_logging        = try(each.value.storage_bucket_logging,        var.defaults.storage_bucket_logging,        null)
storage_bucket_cors_rule      = try(each.value.storage_bucket_cors_rule,      var.defaults.storage_bucket_cors_rule,      [])
```
