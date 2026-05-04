# Simple module example: a network resource

A straightforward module without dynamic blocks. Demonstrates the 8-file pattern at minimum complexity.

**Layout:** `modules/network/vnet/`

## main.tf

```hcl
resource "<provider>_network_vnet" "this" {
  count = var.network_vnet_create ? 1 : 0

  name        = var.network_vnet_name
  region      = var.network_vnet_region
  cidr        = var.network_vnet_cidr
  description = var.network_vnet_description

  tags = merge(
    var.network_vnet_tags,
    { Name = var.network_vnet_name },
  )
}
```

## variables.tf

```hcl
variable "network_vnet_create" {
  description = <<-EOR
    Controls if vnet should be created
  EOT
  type        = bool
  default     = true
}

variable "network_vnet_region" {
  description = <<-EOT
    (Optional, String, ForceNew) Specifies the region in which to create the resource.
    If omitted, the provider-level region will be used.
  EOT
  type        = string
  default     = null
}

variable "network_vnet_name" {
  description = <<-EOT
    (Required, String) Specifies the vnet name.

    Must be 1-64 characters. Letters, digits, hyphens, underscores allowed.
  EOT
  type        = string
  default     = ""
}

variable "network_vnet_cidr" {
  description = <<-EOT
    (Required, String, ForceNew) Specifies the IPv4 CIDR block for the vnet.

    Must be a valid CIDR notation (e.g., 10.0.0.0/16).
  EOT
  type        = string
  default     = ""
}

variable "network_vnet_description" {
  description = <<-EOT
    (Optional, String) Specifies the vnet description.
  EOT
  type    = string
  default = null
}

variable "network_vnet_tags" {
  description = <<-EOT
    (Optional, Map) Specifies the key/value pairs to associate with the vnet.
  EOT
  type    = map(string)
  default = {}
}
```

## outputs.tf

```hcl
output "network_vnet_id" {
  description = <<-EOT
    The vnet ID.

    Type: String
  EOT
  value = try(element(concat(<provider>_network_vnet.this.*.id, [""]), 0), "")
}

output "network_vnet_name" {
  description = <<-EOT
    The vnet name.

    Type: String
  EOT
  value = try(element(concat(<provider>_network_vnet.this.*.name, [""]), 0), "")
}

output "network_vnet_cidr" {
  description = <<-EOT
    The vnet CIDR block.

    Type: String
  EOT
  value = try(element(concat(<provider>_network_vnet.this.*.cidr, [""]), 0), "")
}

output "network_vnet_region" {
  description = <<-EOT
    The vnet region.

    Type: String
  EOT
  value = try(element(concat(<provider>_network_vnet.this.*.region, [""]), 0), "")
}

output "network_vnet_status" {
  description = <<-EOT
    The vnet status.

    Type: String
  EOT
  value = try(element(concat(<provider>_network_vnet.this.*.status, [""]), 0), "")
}
```

## versions.tf

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

## wrappers/main.tf

```hcl
module "wrapper" {
  source   = "../"
  for_each = var.items

  network_vnet_create      = try(each.value.network_vnet_create, var.defaults.network_vnet_create, true)
  network_vnet_region      = try(each.value.network_vnet_region, var.defaults.network_vnet_region, null)
  network_vnet_name        = try(each.value.network_vnet_name, var.defaults.network_vnet_name, "")
  network_vnet_cidr        = try(each.value.network_vnet_cidr, var.defaults.network_vnet_cidr, "")
  network_vnet_description = try(each.value.network_vnet_description, var.defaults.network_vnet_description, null)
  network_vnet_tags        = try(each.value.network_vnet_tags, var.defaults.network_vnet_tags, {})
}
```

## wrappers/variables.tf (typed object — required)

```hcl
variable "defaults" {
  description = "Map of default values which will be used for each item."
  type = object({
    network_vnet_create      = optional(bool)
    network_vnet_region      = optional(string)
    network_vnet_name        = optional(string)
    network_vnet_cidr        = optional(string)
    network_vnet_description = optional(string)
    network_vnet_tags        = optional(map(string))
  })
  default = {}
}

variable "items" {
  description = "Maps of items to create a wrapper from."
  type = map(object({
    network_vnet_create      = optional(bool)
    network_vnet_region      = optional(string)
    network_vnet_name        = optional(string)
    network_vnet_cidr        = optional(string)
    network_vnet_description = optional(string)
    network_vnet_tags        = optional(map(string))
  }))
  default = {}
}
```

## wrappers/outputs.tf

```hcl
output "wrapper" {
  description = "Map of outputs of a wrapper."
  value       = module.wrapper
}
```

## wrappers/versions.tf

Identical to root `versions.tf`.

## README.md (the static portion)

```markdown
# vnet Module

Terraform module which creates a `vnet` resource on `<provider>`.

## Usage

### Single resource

\`\`\`hcl
module "network_vnet" {
source = "./modules/network/vnet"

network_vnet_name = "main-vnet"
network_vnet_cidr = "10.0.0.0/16"

network_vnet_tags = {
Environment = "prod"
Terraform = "true"
}
}
\`\`\`

### Multiple resources (using wrappers)

\`\`\`hcl
module "network_vnets" {
source = "./modules/network/vnet/wrappers"

defaults = {
network_vnet_region = "<region>"
network_vnet_tags = {
Terraform = "true"
}
}

items = {
main = { network_vnet_name = "main-vnet", network_vnet_cidr = "10.0.0.0/16" }
dr = { network_vnet_name = "dr-vnet", network_vnet_cidr = "10.1.0.0/16" }
}
}
\`\`\`

<!-- BEGIN_TF_DOCS -->
<!-- terraform-docs auto-injects -->
<!-- END_TF_DOCS -->

## Notes

- The Name tag is automatically derived from `network_vnet_name`.
- CIDR cannot be changed after creation.

## Provider documentation

See the `<provider>_network_vnet` registry page for the full argument list.
```

## What this example demonstrates

- Minimum-viable module: 8 files, 2 directories.
- No dynamic blocks (the resource is flat).
- Standard outputs: id, name, cidr, region, status.
- Wrapper that handles the create-toggle and the four user-facing variables.
- README ready for terraform-docs injection.
