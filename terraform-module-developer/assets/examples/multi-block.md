# Multi-block example: a network ACL with ingress and egress rules

A module with multiple dynamic blocks of similar shape. Demonstrates how to use the same iterator name across sibling blocks (each `dynamic` has its own scope).

**Layout:** `modules/network/acl/`

## main.tf (excerpt)

```hcl
resource "<provider>_network_acl" "this" {
  count = var.network_acl_create ? 1 : 0

  name        = var.network_acl_name
  region      = var.network_acl_region
  description = var.network_acl_description

  tags = merge(
    var.network_acl_tags,
    { Name = var.network_acl_name },
  )

  # Ingress rules
  dynamic "ingress_rules" {
    iterator = rule_cfg
    for_each = can(length(var.network_acl_ingress_rules)) ? var.network_acl_ingress_rules : []

    content {
      # Required fields: direct references
      action     = rule_cfg.value.action
      protocol   = rule_cfg.value.protocol
      ip_version = rule_cfg.value.ip_version

      # Optional fields: lookup with null fallback
      source_ip_address               = lookup(rule_cfg.value, "source_ip_address", null)
      source_ip_address_group_id      = lookup(rule_cfg.value, "source_ip_address_group_id", null)
      destination_ip_address          = lookup(rule_cfg.value, "destination_ip_address", null)
      destination_ip_address_group_id = lookup(rule_cfg.value, "destination_ip_address_group_id", null)
      source_port_range               = lookup(rule_cfg.value, "source_port_range", null)
      destination_port_range          = lookup(rule_cfg.value, "destination_port_range", null)
      description                     = lookup(rule_cfg.value, "description", null)
      name                            = lookup(rule_cfg.value, "name", null)
    }
  }

  # Egress rules — same shape, same iterator name (different dynamic scope)
  dynamic "egress_rules" {
    iterator = rule_cfg
    for_each = can(length(var.network_acl_egress_rules)) ? var.network_acl_egress_rules : []

    content {
      action     = rule_cfg.value.action
      protocol   = rule_cfg.value.protocol
      ip_version = rule_cfg.value.ip_version

      source_ip_address               = lookup(rule_cfg.value, "source_ip_address", null)
      source_ip_address_group_id      = lookup(rule_cfg.value, "source_ip_address_group_id", null)
      destination_ip_address          = lookup(rule_cfg.value, "destination_ip_address", null)
      destination_ip_address_group_id = lookup(rule_cfg.value, "destination_ip_address_group_id", null)
      source_port_range               = lookup(rule_cfg.value, "source_port_range", null)
      destination_port_range          = lookup(rule_cfg.value, "destination_port_range", null)
      description                     = lookup(rule_cfg.value, "description", null)
      name                            = lookup(rule_cfg.value, "name", null)
    }
  }

  # Subnet associations (different shape, simpler)
  dynamic "associated_subnets" {
    iterator = subnet_cfg
    for_each = can(length(var.network_acl_associated_subnets)) ? var.network_acl_associated_subnets : []

    content {
      subnet_id = subnet_cfg.value.subnet_id
    }
  }
}
```

## variables.tf (excerpt — rule type definition)

```hcl
variable "network_acl_ingress_rules" {
  description = <<-EOT
    Specifies the ingress rules. The ingress_rules block supports:
    - action - (Required, String) The action. Valid values: allow, deny.
    - protocol - (Required, String) The protocol. Valid values: tcp, udp, icmp, icmpv6, any.
    - ip_version - (Required, String) IP version. Valid values: 4, 6.
    - source_ip_address - (Optional, String) Source IP or CIDR block.
    - source_ip_address_group_id - (Optional, String) Source IP address group ID.
      Mutually exclusive with source_ip_address.
    - destination_ip_address - (Optional, String) Destination IP or CIDR block.
    - destination_ip_address_group_id - (Optional, String) Destination IP address group ID.
      Mutually exclusive with destination_ip_address.
    - source_port_range - (Optional, String) Source port or range (e.g., 80, 8000-9000).
    - destination_port_range - (Optional, String) Destination port or range.
    - description - (Optional, String) Rule description.
    - name - (Optional, String) Rule name.
  EOT
  type = list(object({
    action                          = string
    protocol                        = string
    ip_version                      = string
    source_ip_address               = optional(string)
    source_ip_address_group_id      = optional(string)
    destination_ip_address          = optional(string)
    destination_ip_address_group_id = optional(string)
    source_port_range               = optional(string)
    destination_port_range          = optional(string)
    description                     = optional(string)
    name                            = optional(string)
  }))
  default = []
}

# Egress is the same shape — declare a separate variable, not a shared type
variable "network_acl_egress_rules" {
  description = <<-EOT
    Specifies the egress rules. Same fields as ingress_rules.
    See network_acl_ingress_rules for the full block description.
  EOT
  type = list(object({
    action                          = string
    protocol                        = string
    ip_version                      = string
    source_ip_address               = optional(string)
    source_ip_address_group_id      = optional(string)
    destination_ip_address          = optional(string)
    destination_ip_address_group_id = optional(string)
    source_port_range               = optional(string)
    destination_port_range          = optional(string)
    description                     = optional(string)
    name                            = optional(string)
  }))
  default = []
}

variable "network_acl_associated_subnets" {
  description = <<-EOT
    Specifies the subnet associations. The associated_subnets block supports:
    - subnet_id - (Required, String) The subnet ID to associate with this ACL.
  EOT
  type = list(object({
    subnet_id = string
  }))
  default = []
}
```

## What this example demonstrates

- **Same iterator name across sibling dynamic blocks** (`rule_cfg` for ingress and egress) — each `dynamic` has its own scope.
- **Two structurally-identical variables** (ingress_rules and egress_rules): declared separately, not via a shared type. Consumers expect each in the registry-canonical name.
- **Many optional fields** (11 per rule): all use `lookup(..., field, null)`.
- **Mutually-exclusive fields documented in the heredoc** (source_ip_address vs source_ip_address_group_id) — Terraform doesn't enforce this; the heredoc is the only documentation.
- **Field name fidelity to the provider**: `source_ip_address_group_id`, not `source_address_group_id` (the latter is wrong; check the registry).

## Wrapper handling

`wrappers/variables.tf` mirrors every root variable as a typed `optional(<root-type>)` field. The two structurally-identical rule variables (ingress and egress) keep their full schema in the wrapper:

```hcl
# wrappers/variables.tf (excerpt — same shape inside `defaults` and `items`)
variable "defaults" {
  description = "Map of default values which will be used for each item."
  type = object({
    network_acl_create      = optional(bool)
    network_acl_name        = optional(string)
    network_acl_region      = optional(string)
    network_acl_description = optional(string)
    network_acl_tags        = optional(map(string))

    network_acl_ingress_rules = optional(list(object({
      action                          = string
      protocol                        = string
      ip_version                      = string
      source_ip_address               = optional(string)
      source_ip_address_group_id      = optional(string)
      destination_ip_address          = optional(string)
      destination_ip_address_group_id = optional(string)
      source_port_range               = optional(string)
      destination_port_range          = optional(string)
      description                     = optional(string)
      name                            = optional(string)
    })))

    network_acl_egress_rules = optional(list(object({
      action                          = string
      protocol                        = string
      ip_version                      = string
      source_ip_address               = optional(string)
      source_ip_address_group_id      = optional(string)
      destination_ip_address          = optional(string)
      destination_ip_address_group_id = optional(string)
      source_port_range               = optional(string)
      destination_port_range          = optional(string)
      description                     = optional(string)
      name                            = optional(string)
    })))

    network_acl_associated_subnets = optional(list(object({
      subnet_id = string
    })))
  })
  default = {}
}

variable "items" {
  description = "Maps of items to create a wrapper from."
  type        = map(object({ # ... identical field set as defaults ... }))
  default     = {}
}
```

`wrappers/main.tf` threads them through:

```hcl
network_acl_ingress_rules      = try(each.value.network_acl_ingress_rules,      var.defaults.network_acl_ingress_rules,      [])
network_acl_egress_rules       = try(each.value.network_acl_egress_rules,       var.defaults.network_acl_egress_rules,       [])
network_acl_associated_subnets = try(each.value.network_acl_associated_subnets, var.defaults.network_acl_associated_subnets, [])
```

All list-typed variables fall back to `[]` in the wrapper chain.
