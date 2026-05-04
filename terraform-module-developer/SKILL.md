---
name: terraform-module-developer
description: Build production-ready, multi-provider Terraform modules with the strict 8-file structure (4 root + 4 wrappers/) — typed variables prefixed with the resource name, count-conditional resources, dynamic blocks with iterator pattern, outputs using try/element/concat, full heredoc provider docs, and a wrapper module supporting batch ops via for_each. Generates a polished README.md with BEGIN_TF_DOCS / END_TF_DOCS markers so terraform-docs auto-injects inputs/outputs/providers/resources tables. Bundles a generic .terraform-docs.yml, .tflint.hcl, pre-commit fragment, security scanning (tflint + tfsec + checkov) and module testing patterns. Works with any Terraform provider — AWS, Azure, GCP, HuaweiCloud, OCI, DigitalOcean, Cloudflare, and community providers. Use whenever the user asks to create a Terraform module, IaC module, .tf module, scaffold a tf resource, wire terraform-docs, or hits you with 'make me a terraform module', 'scaffold a tf resource', 'wire up terraform-docs', or 'add a wrapper for batch ops'.
license: MIT. See LICENSE for full terms.
compatibility: Terraform 1.3+ (also OpenTofu 1.6+) with any provider. Tested patterns work with AWS, Azure, GCP, HuaweiCloud, OCI, DigitalOcean, Cloudflare, and community providers.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Terraform Module Developer

The strict 8-file pattern: 4 root files (`main.tf` + `variables.tf` + `outputs.tf` + `versions.tf`) + 4 wrapper files (`wrappers/*.tf`) + a polished `README.md` with `terraform-docs` auto-injection. Multi-provider; works for any Terraform/OpenTofu provider.

## When to use

- The user asks for a new Terraform module, IaC module, `.tf` resource, or a wrapper module.
- The user wants to harden, refactor, or review an existing module.
- A polyglot infra repo needs consistent module structure across services / regions / providers.
- The user wants `terraform-docs` wired up so READMEs stay in sync with code.
- The user wants `tflint` / `tfsec` / `checkov` running pre-commit and in CI.

Skip this skill for: cloud-vendor-specific business logic (use a vendor SDK skill), application code (different language skills), or non-IaC config like Helm charts (use `gitops-cd-developer`).

## Required structure

Every module is exactly this — no fewer files, no extra files, this layout:

```
modules/<service>/<resource>/
├── main.tf            # resource definition, count = var.<prefix>_create ? 1 : 0
├── variables.tf       # all vars prefixed `<prefix>_*`, heredoc descriptions
├── outputs.tf         # try/element/concat pattern for every output
├── versions.tf        # required_version + required_providers (pinned)
├── README.md          # static intro + BEGIN_TF_DOCS / END_TF_DOCS markers
└── wrappers/
    ├── main.tf        # module "wrapper" { for_each = var.items, ... }
    ├── variables.tf   # `defaults` (any) + `items` (any)
    ├── outputs.tf     # output "wrapper" { value = module.wrapper }
    └── versions.tf    # same constraints as root
```

**Total: 2 directories, 9 files** (8 `.tf` + 1 `README.md`). Validators check this exactly.

Plus, repo-root tooling (one-time setup):

- `.terraform-docs.yml` — config that injects between the README markers.
- `.tflint.hcl` — linting rules + provider plugins.
- `.pre-commit-config.yaml` (or fragment) — wires terraform-fmt, terraform-docs, tflint, tfsec into commit hooks.

## Workflow

1. **Confirm the provider.** Default: ask the user which provider (`aws`, `azurerm`, `google`, `huaweicloud`, `oci`, `digitalocean`, `cloudflare`, etc.) and pin a version. Save provider preference to memory after first run.
2. **Confirm the service + resource.** `<service>` is the namespace (e.g., `vpc`, `compute`, `storage`). `<resource>` is the specific resource type (e.g., `subnet`, `instance`, `bucket`). Variable prefix derived as `<service>_<resource>` with hyphens turned into underscores.
3. **Scaffold the structure.** Run `bash scripts/scaffold-module.sh <service> <resource> <provider> <provider-version>`. Creates the 9 files from `assets/templates/terraform/`. See `references/module-anatomy.md` for the file-by-file breakdown.
4. **Fetch provider docs.** Open the resource page on the Terraform Registry. Capture the full set of arguments, optional fields, dynamic blocks, and exported attributes. The heredoc descriptions in `variables.tf` should mirror the registry exactly.
5. **Fill in `main.tf`.** Map provider arguments to module variables. Use the count conditional. Apply `references/dynamic-blocks.md` for any nested blocks.
6. **Fill in `variables.tf`.** Apply `references/variable-patterns.md` — naming, heredoc, complex types with `optional()`, the `<prefix>_timeouts` object pattern when the resource supports timeouts.
7. **Fill in `outputs.tf`.** Apply `references/output-patterns.md` — `try(element(concat(<resource>.this.*.<attr>, [<default>]), 0), <fallback>)` for every export.
8. **Fill in `wrappers/`.** Apply `references/wrapper-pattern.md` — every root variable gets a corresponding `try(each.value.<x>, var.defaults.<x>, <default>)` line in `wrappers/main.tf`.
9. **Wire terraform-docs.** Apply `references/readme-and-terraform-docs.md` — confirm `.terraform-docs.yml` exists at repo root, README has the `BEGIN_TF_DOCS` / `END_TF_DOCS` markers, and the pre-commit hook is registered.
10. **Wire security scanning + tests.** Apply `references/security-scanning.md` (tflint + tfsec/trivy + checkov) and `references/module-testing.md` (terraform test framework + examples/ directory).
11. **Validate.** Run `bash scripts/validate-module.sh <module-path>` — checks file count (2 dirs / 9 files), no `list(any)`, prefix consistency, iterator patterns, README markers. Aim for 100%.
12. **Format + native validate.** `terraform fmt -recursive && terraform validate` from the module directory.
13. **Generate docs.** `terraform-docs -c .terraform-docs.yml <module-path>` — confirm the README inputs/outputs tables fill in correctly.

## Available resources

- `references/module-anatomy.md` — 8-file structure, four-file pattern, naming conventions, count conditional, file-by-file breakdown.
- `references/variable-patterns.md` — naming convention, heredoc descriptions, complex object types with `optional()`, `<prefix>_timeouts` object pattern.
- `references/output-patterns.md` — `try(element(concat(...), 0), <fallback>)` pattern with examples for string / list / map / object outputs.
- `references/dynamic-blocks.md` — iterator pattern (`iterator = <name>_cfg`), nested dynamic blocks, `can(length())` guard.
- `references/wrapper-pattern.md` — `for_each = var.items`, `defaults` + `items` variables, `try(each.value, var.defaults, <fallback>)` chain, type-safe wrapper variables for timeouts.
- `references/readme-and-terraform-docs.md` — README template structure, `BEGIN_TF_DOCS` / `END_TF_DOCS` markers, `.terraform-docs.yml` config (`mode: inject`, `formatter: markdown table`), pre-commit hook integration, CI integration.
- `references/provider-conventions.md` — multi-provider notes (AWS / Azure / GCP / HuaweiCloud / OCI / DigitalOcean / Cloudflare): naming differences, region handling, tagging conventions, provider-specific gotchas.
- `references/security-scanning.md` — tflint config + plugins, tfsec / trivy security scanning, checkov compliance scanning, integrating all three into pre-commit and CI.
- `references/module-testing.md` — Terraform 1.6+ native test framework (`*.tftest.hcl`), `examples/` directory pattern, integration tests, contract tests.
- `references/anti-patterns.md` — 12 named anti-patterns with the better alternative.
- `assets/templates/terraform/{main,variables,outputs,versions}.tf.tmpl` + `README.md.tmpl` — root module starting points (renamed `.tmpl` so IDE Terraform plugins don't try to parse the placeholder tokens).
- `assets/templates/terraform/wrappers-{main,variables,outputs,versions}.tf.tmpl` — wrapper module starting points.
- `assets/templates/configs/{terraform-docs.yml,tflint.hcl,pre-commit-fragment.yaml,editorconfig}` — repo-root tooling configs.
- `assets/examples/{simple-module,dynamic-blocks,multi-block,module-test}.md` — full worked examples (network / storage / firewall / test).
- `scripts/scaffold-module.sh` — generic, multi-provider scaffolder. Run it instead of writing 9 files by hand.
- `scripts/validate-module.sh` — score a module against the checklist. Run after editing.
- `scripts/setup-tooling.sh` — install terraform-docs, tflint, tfsec, checkov via standard package managers.

## Top gotchas (always inline — do not skip)

- **8 files, 2 directories. No fewer, no extras.** A module without `wrappers/` is incomplete. A module with extra `.tf` files (e.g., `data.tf`, `locals.tf`) is the wrong shape — fold them into `main.tf`.
- **Variable prefix is `<service>_<resource>_*`.** Always. `vpc_subnet_name`, not `name`. Prefix-less variables fight every consumer that imports more than one of your modules.
- **Dynamic blocks REQUIRE `iterator = <name>_cfg`.** Without the iterator, the block name shadows the variable. With it, you get a clean `<name>_cfg.value.field` reference.
- **Output pattern is non-negotiable: `try(element(concat(<resource>.this.*.<attr>, [<default>]), 0), <fallback>)`.** Handles count = 0, null attrs, and missing fields in one expression.
- **`list(any)` is banned.** Always use `list(object({...}))` with `optional()` for optional fields. `list(any)` loses type safety and breaks consumer-side validation.
- **Timeouts use ONE object variable, not three.** `<prefix>_timeouts` of type `object({create=optional, update=optional, delete=optional})`. Never `<prefix>_timeout_create` / `_update` / `_delete` as separate vars.
- **Wrapper variables: `defaults` + `items` only, both strictly typed.** `defaults` is `object({...})`, `items` is `map(object({...}))`. Every field is `optional(<type>)` and mirrors a root variable — same name, same type, same nested shape. `type = any` is the old shortcut; typed wrappers are the contract because misspelled fields and wrong types fail at plan time instead of silently being ignored.
- **README has BEGIN_TF_DOCS / END_TF_DOCS markers.** terraform-docs runs in `mode: inject` and replaces *only* the content between markers. The static portion (Usage, Examples, Notes, Provider Documentation link) lives outside the markers.
- **`.terraform-docs.yml` lives at repo root.** Not per-module. It applies to every module via `terraform-docs -c .terraform-docs.yml <path>`.
- **Pin every `required_providers` version.** Lower bound minimum (`>= 1.91.0`). Floating refs (`~> 1`, `latest`) break reproducibility across team members and CI.
- **`enterprise_project_id` and similar provider-specific fields are always `optional`.** Don't make them required even when the provider treats them as semi-required — different organizations have different setups.
- **Module-level region defaults to `null`, not a hardcoded value.** Let the provider-level region win when the module caller doesn't override. Hardcoded defaults (`"us-east-1"`, `"westus2"`, or any other concrete region) leak organizational choices into reusable modules.

## What you DO

1. Always start from `scripts/scaffold-module.sh`. Never hand-write the 9 files.
2. Use the variable prefix `<service>_<resource>_*` consistently.
3. Use `count = var.<prefix>_create ? 1 : 0` on the resource block.
4. Write heredoc descriptions on every variable that mirror the provider registry.
5. Use `list(object({...}))` with `optional()` for any list-of-records variable.
6. Use the `<prefix>_timeouts` object variable (not three separate vars) when the resource supports timeouts.
7. Use the iterator pattern (`iterator = <name>_cfg`) on every dynamic block.
8. Use the `try(element(concat(...), 0), <fallback>)` pattern for every output.
9. Write a `wrappers/` directory with **typed** `defaults` (`object({...})`) and `items` (`map(object({...}))`), mirroring every root variable as `optional(<type>)`. Thread per-resource values via the `try(each.value, var.defaults, <fallback>)` chain in `wrappers/main.tf`.
10. Place `BEGIN_TF_DOCS` / `END_TF_DOCS` markers in every README between Usage and Notes.
11. Wire terraform-docs as a pre-commit hook (and a CI check).
12. Wire tflint + tfsec/trivy + checkov as pre-commit + CI.
13. Add an `examples/` subdirectory with a working basic example, then `tests/*.tftest.hcl` for the native test framework.
14. Run `scripts/validate-module.sh` after every edit; aim for 100%.
15. Run `terraform fmt -recursive && terraform validate` before declaring done.

## What you do NOT do

- Skip the `wrappers/` directory.
- Use `list(any)` or `map(any)` anywhere — the wrapper's `defaults` and `items` are also strictly typed (`object({...})` / `map(object({...}))`).
- Hand-write per-resource wrapper variables (only `defaults` + `items`).
- Hardcode regions, project IDs, or organizational defaults.
- Use `~>` or unpinned floating refs for provider versions.
- Place `data.tf` / `locals.tf` as separate files (fold into `main.tf`).
- Forget the `iterator = <name>_cfg` on a dynamic block.
- Use `for_each = var.x != null ? var.x : []` (use `can(length(var.x)) ? var.x : []`).
- Write the inputs / outputs / providers tables manually in README — let terraform-docs inject them.
- Commit a module without running `terraform fmt`.
- Create a module without an `examples/` working example.
- Mix `count` and `for_each` on the same resource — pick one.
- Reference provider-specific resources without including the provider in `required_providers`.
- Make tags optional with no `merge()` for the `Name` tag (every module merges a `Name` tag from `<prefix>_name`).
