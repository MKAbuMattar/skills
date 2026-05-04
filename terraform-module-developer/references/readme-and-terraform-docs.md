# README + terraform-docs

Load this when wiring `terraform-docs` into a module. The README is half static (Usage, Examples, Notes) and half auto-generated (Inputs, Outputs, Providers, Resources). The two halves are separated by markers that `terraform-docs` knows about.

## The README template (static portion)

```markdown
# <Resource> Module

Terraform module which creates a <Resource> on <Provider>.

## Usage

### Single resource

\`\`\`hcl
module "<prefix>" {
source = "./modules/<service>/<resource>"

<prefix>\_name = "example"
<prefix>\_description = "Example <resource>"
<prefix>\_region = "<region>"

<prefix>\_tags = {
Environment = "dev"
Terraform = "true"
}
}
\`\`\`

### Multiple resources (using wrappers)

\`\`\`hcl
module "<prefix>\_multiple" {
source = "./modules/<service>/<resource>/wrappers"

defaults = {
<prefix>\_region = "<region>"
<prefix>\_tags = {
Terraform = "true"
}
}

items = {
example1 = { <prefix>\_name = "example-1" }
example2 = { <prefix>\_name = "example-2" }
}
}
\`\`\`

<!-- BEGIN_TF_DOCS -->
<!-- terraform-docs auto-injects requirements / providers / inputs / outputs / resources here -->
<!-- END_TF_DOCS -->

## Examples

See the [examples](../../../examples/<service>/<resource>) directory for working configurations.

## Notes

- <any provider-specific note, limitation, or workaround>
- <pricing or quota considerations if applicable>

## Provider documentation

For the underlying resource, see [<Provider> <resource> docs](registry-url).
```

## The two markers

```markdown
<!-- BEGIN_TF_DOCS -->
<!-- ... -->
<!-- END_TF_DOCS -->
```

`terraform-docs` runs in `mode: inject` and replaces _only_ the content between these markers. The static portion (Usage, Examples, Notes, Provider documentation) lives outside.

If the markers are missing, `terraform-docs` will _append_ to the end of the file or refuse to run, depending on the `output.mode`. Always include the markers in the template.

## `.terraform-docs.yml` (repo root)

```yaml
formatter: "markdown table"

output:
  file: "README.md"
  mode: inject
  template: |-
    <!-- BEGIN_TF_DOCS -->
    {{ .Content }}
    <!-- END_TF_DOCS -->

sort:
  enabled: true
  by: required

settings:
  anchor: true
  default: true
  description: true
  escape: true
  hide-empty: true
  lockfile: true
```

Place this at the repo root, **not** per-module. It applies to every module via `terraform-docs -c .terraform-docs.yml <module-path>`.

Field-by-field:

- `formatter: "markdown table"` — emits standard Markdown tables. Other options: `markdown document`, `markdown`, `tfvars hcl`, `tfvars json`. Tables are the right choice for module READMEs.
- `output.file: "README.md"` — writes into the README of each module.
- `output.mode: inject` — replaces between markers (vs. `replace` which overwrites the whole file).
- `output.template` — the inject template; the markers around `{{ .Content }}` are what matches the README's markers.
- `sort.by: required` — required inputs first, then optional. Easier for consumers to scan.
- `settings.anchor: true` — adds anchor links so each input is `#input_<name>`.
- `settings.default: true` — shows default values in the inputs table.
- `settings.description: true` — shows descriptions (which is why the heredoc style matters).
- `settings.escape: true` — escapes Markdown characters in defaults and descriptions.
- `settings.hide-empty: true` — hides empty sections (Modules / Resources tables when there are none).
- `settings.lockfile: true` — surfaces the `.terraform.lock.hcl` constraint when present.

## Running `terraform-docs`

```bash
# Once per module
terraform-docs -c .terraform-docs.yml modules/<service>/<resource>

# Across all modules
find modules -type d -name "wrappers" -prune -o -type d -print | \
  while read -r dir; do
    if [ -f "$dir/main.tf" ]; then
      terraform-docs -c .terraform-docs.yml "$dir"
    fi
  done
```

## Pre-commit integration

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/terraform-docs/terraform-docs
    rev: v0.19.0
    hooks:
      - id: terraform-docs-go
        args:
          - "--config=.terraform-docs.yml"
          - "modules/"
```

When a developer commits with stale READMEs, the hook regenerates them and the commit fails (as it should — they need to re-stage the regenerated files). Re-stage and commit again.

For wrapper modules: terraform-docs by default doesn't include modules with `source = "../"` in the rendered output (they're considered children of the parent path). The wrapper `README.md` (if you have one) covers that itself.

## CI integration

GitHub Actions example (`.github/workflows/terraform-docs.yml`):

```yaml
name: terraform-docs
on:
  pull_request:
    paths:
      - "modules/**/*.tf"
      - "examples/**/*.tf"

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: terraform-docs/gh-actions@v1
        with:
          working-dir: modules
          config-file: .terraform-docs.yml
          git-push: true
          git-commit-message: "chore: update terraform-docs"
```

For other CI providers, the binary install is one curl + tar:

```bash
curl -sSL https://github.com/terraform-docs/terraform-docs/releases/latest/download/terraform-docs-v0.19.0-linux-amd64.tar.gz \
  | tar xz -C /usr/local/bin terraform-docs
```

## What terraform-docs renders

When the module has the heredoc-style descriptions and the inject markers, terraform-docs produces (between the markers):

```markdown
## Requirements

| Name       | Version   |
| ---------- | --------- |
| terraform  | >= 1.3    |
| <provider> | >= 1.91.0 |

## Providers

| Name       | Version   |
| ---------- | --------- |
| <provider> | >= 1.91.0 |

## Resources

| Name                                                                      | Type     |
| ------------------------------------------------------------------------- | -------- |
| [<provider>_<service>_<resource>.this](https://registry.terraform.io/...) | resource |

## Inputs

| Name             | Description                            | Type     | Default | Required |
| ---------------- | -------------------------------------- | -------- | ------- | -------- |
| <prefix>\_name   | (Required, String) Specifies the name. | `string` | `""`    | yes      |
| <prefix>\_create | Controls if resource should be created | `bool`   | `true`  | no       |
| ...              |

## Outputs

| Name         | Description      |
| ------------ | ---------------- |
| <prefix>\_id | The resource ID. |
| ...          |
```

## Anti-patterns

- **Markers missing or mismatched** — terraform-docs silently no-ops or appends junk.
- **Manual inputs/outputs tables in README** — they go stale instantly. Let terraform-docs own them.
- **Per-module `.terraform-docs.yml`** — fine but creates drift. One config at repo root applied uniformly is the standard.
- **`output.mode: replace`** — overwrites the whole README, wiping the static portion. Use `inject`.
- **No pre-commit hook** — READMEs drift on every PR. The hook is the contract.
- **`sort.by: name`** when the convention is `required` — required inputs at top makes the consumer's eye land on what they have to set.
- **Heredoc descriptions broken across long lines** — terraform-docs renders them as-is. Keep them tight.
