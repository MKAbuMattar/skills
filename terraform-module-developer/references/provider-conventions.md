# Provider conventions

Load this when working with a specific Terraform provider. The 8-file pattern is provider-agnostic, but each provider has naming quirks, region handling, tagging conventions, and required IDs that affect the variables and outputs.

## Provider matrix

| Provider     | Source                      | Resource prefix | Tagging                          | Region var | Project / Account ID     |
| ------------ | --------------------------- | --------------- | -------------------------------- | ---------- | ------------------------ |
| AWS          | `hashicorp/aws`             | `aws_`          | `tags`                           | `region`   | n/a (account from auth)  |
| Azure (RM)   | `hashicorp/azurerm`         | `azurerm_`      | `tags`                           | `location` | `subscription_id`        |
| GCP          | `hashicorp/google`          | `google_`       | `labels`                         | `region`   | `project`                |
| HuaweiCloud  | `huaweicloud/huaweicloud`   | `huaweicloud_`  | `tags`                           | `region`   | `enterprise_project_id`  |
| OCI          | `oracle/oci`                | `oci_`          | `freeform_tags` + `defined_tags` | `region`   | `compartment_id`         |
| DigitalOcean | `digitalocean/digitalocean` | `digitalocean_` | `tags` (list)                    | `region`   | n/a                      |
| Cloudflare   | `cloudflare/cloudflare`     | `cloudflare_`   | n/a                              | n/a        | `account_id` / `zone_id` |
| Kubernetes   | `hashicorp/kubernetes`      | `kubernetes_`   | `metadata.labels`                | n/a        | `namespace`              |
| Helm         | `hashicorp/helm`            | `helm_`         | n/a                              | n/a        | `namespace`              |

## Common shape (works for AWS / Azure / GCP / HuaweiCloud / OCI)

```hcl
resource "<provider>_<service>_<resource>" "this" {
  count = var.<prefix>_create ? 1 : 0

  name        = var.<prefix>_name
  region      = var.<prefix>_region    # or `location` for Azure
  description = var.<prefix>_description

  # Provider-specific account/project ID (optional, falls back to provider-level)
  enterprise_project_id = var.<prefix>_enterprise_project_id   # HuaweiCloud
  # project              = var.<prefix>_project                 # GCP
  # subscription_id      = var.<prefix>_subscription_id         # Azure
  # compartment_id       = var.<prefix>_compartment_id          # OCI

  tags = merge(
    var.<prefix>_tags,
    { Name = var.<prefix>_name },
  )
}
```

## Provider-specific notes

### AWS

- Tagging is `tags = map(string)`, plus `tags_all` (computed; provider merges from default tags).
- Region is `region` and is set provider-level; rarely module-level.
- ARN is the canonical resource identifier; output `<prefix>_arn` for every taggable resource.
- Resource names sometimes have length limits (S3 buckets: 3-63 chars, lowercase + hyphens). Add a validation block.
- Some resources need `availability_zone` instead of `region` (e.g., EBS volumes).

### Azure (azurerm)

- Region variable is `location`, not `region`. Adjust the variable: `<prefix>_location`.
- Tagging is `tags = map(string)`.
- Resources require a `resource_group_name` — make this a required variable: `<prefix>_resource_group_name`.
- `subscription_id` / `tenant_id` typically come from the provider config, not per-resource.

### GCP

- Tagging is `labels = map(string)`, NOT `tags` (the `tags` field on GCP exists but means "network firewall tags" — different concept).
- `project` variable is provider-level usually; module-level `<prefix>_project` allows cross-project resource creation.
- Region is `region`, but some resources are zonal (`zone`) or multi-regional (`location`).
- Self-link is the canonical resource identifier; output `<prefix>_self_link`.

### HuaweiCloud

- `enterprise_project_id` is HuaweiCloud's account-segmentation field. Always optional, defaults to `null` (provider-level inherited).
- Region is `region`. Standard regions follow the format used by HuaweiCloud (the consumer picks; module never hardcodes).
- Tagging is `tags = map(string)`.
- Some resources expose `tags` as a list of `{key, value}` objects instead of a map — check the registry.

### OCI

- Two tag systems: `freeform_tags = map(string)` and `defined_tags = map(any)` (uses tag namespaces).
- Always require `<prefix>_compartment_id` (OCI's resource grouping).
- Region is `region`.
- OCID is the canonical resource identifier; output `<prefix>_id` (which is the OCID).

### DigitalOcean

- Tags is `tags = list(string)` (NOT a map). The variable type is `list(string)` and the merge pattern doesn't apply directly.
- For DO modules, replace the tag merge in `main.tf`:
  ```hcl
  tags = concat(var.<prefix>_tags, ["Name:${var.<prefix>_name}"])
  ```
- Region uses short codes (`nyc1`, `sfo3`, etc.).

### Cloudflare

- No regions; resources are global.
- Most resources scope to a `zone_id` or `account_id`. Make these required: `<prefix>_zone_id`, `<prefix>_account_id`.
- No tagging; comments via `comment = string` field on some resources.

### Kubernetes / Helm

- No regions; scoping is via `namespace` and the kubeconfig the provider uses.
- "Tags" are `metadata.labels`. Wrap labels under a sub-block in `main.tf`:
  ```hcl
  metadata {
    name      = var.<prefix>_name
    namespace = var.<prefix>_namespace
    labels    = merge(var.<prefix>_labels, { app = var.<prefix>_name })
  }
  ```

## When the resource argument names differ across providers

Don't try to "normalize" them in the module. Use the provider's actual field name. The variable prefix already disambiguates.

```hcl
# AWS module
variable "ec2_instance_image_id" { ... }   # field: ami

# GCP module
variable "compute_instance_machine_image" { ... }   # field: source_image

# Azure module
variable "compute_vm_image_publisher" { ... }   # field: publisher (within image_reference block)
```

The consumer expects to see the provider-native shape.

## Multi-provider modules

Avoid them when you can — most consumers use one cloud per module. When you genuinely need a multi-provider module (e.g., a DNS module that supports both Route 53 and Cloudflare):

1. Use feature flags: `<prefix>_aws_enabled`, `<prefix>_cloudflare_enabled`.
2. Resource per provider, gated by the flag's `count`.
3. Outputs that fall back across providers using `coalesce`:
   ```hcl
   output "<prefix>_dns_record_id" {
     value = coalesce(
       try(aws_route53_record.this.*.id[0], null),
       try(cloudflare_record.this.*.id[0], null),
       "",
     )
   }
   ```

This adds complexity. Prefer two single-provider modules when possible.

## Provider version pinning

Every module pins a real minimum version in `versions.tf`. Pick a version that:

- Has the latest field your module references.
- Is at least 6 months old (so consumers' lock files have likely caught up).
- Is not a `0.x` version unless the provider only has `0.x` releases.

```hcl
required_providers {
  <provider> = {
    source  = "<namespace>/<provider>"
    version = ">= <minimum-with-the-fields-you-use>"
  }
}
```

For the wrapper, the `versions.tf` is identical to the root. The wrapper's parent (the consumer's repo) usually pins exact versions in its own `.terraform.lock.hcl`.

## Anti-patterns

- **Hardcoded provider regions** in module defaults: `default = "us-east-1"` leaks the module author's choice.
- **Cross-provider in one module without flags**: makes consumers pay the dependency cost of every provider, even ones they don't use.
- **Skipping `enterprise_project_id` / `compartment_id` / `resource_group_name`** because "the provider has a default": the field exists for a reason — making it explicit on the module variable lets consumers override per-instance.
- **Trying to map `tags` and `labels` to a single variable**: the providers expose different shapes; the module should mirror them.
- **Floating provider versions** (`~> 5`): every minor release of the provider can change behavior; pin a real lower bound.
