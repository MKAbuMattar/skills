# Agent Skills Specification (condensed)

Quick reference for the [official spec](https://agentskills.io/specification). Load this when you need to confirm a frontmatter field, a naming rule, or a directory convention.

## Directory structure

```
<skill-name>/
├── SKILL.md          # required
├── scripts/          # optional: executable code
├── references/       # optional: documentation loaded on demand
├── assets/           # optional: templates, images, data files
└── LICENSE           # optional but recommended
```

Top-level skill folder name **must** equal the `name` field in `SKILL.md`.

## `SKILL.md` format

```markdown
---
<YAML frontmatter>
---

<Markdown body — instructions for the agent>
```

### Frontmatter fields

| Field           | Required | Constraints                                                                                                           |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`          | Yes      | 1–64 chars. Lowercase `a-z`, digits, single hyphens. No leading/trailing hyphens. No consecutive hyphens. Matches folder. |
| `description`   | Yes      | 1–1024 chars. Non-empty. Says **what** the skill does and **when** to use it.                                          |
| `license`       | No       | License name or pointer to bundled file (e.g. `MIT. See LICENSE for full terms.`).                                     |
| `compatibility` | No       | 1–500 chars. Environment requirements (runtime, packages, network access). Most skills don't need it.                  |
| `metadata`      | No       | Free-form `key: value` map. Use namespaced keys to avoid client conflicts.                                             |
| `allowed-tools` | No       | Space-separated tool allowlist. **Experimental** — support varies by client.                                           |

#### `name` examples

```yaml
name: pdf-processing      # OK
name: data-analysis       # OK
name: code-review         # OK

name: PDF-Processing      # FAIL — uppercase
name: -pdf                # FAIL — leading hyphen
name: pdf--processing     # FAIL — consecutive hyphens
name: pdf_processing      # FAIL — underscore
```

#### `description` shape

Good:

```yaml
description: >
  Extract text and tables from PDF files, fill PDF forms, and merge multiple
  PDFs. Use this skill whenever the user has a PDF and wants to read, modify,
  combine, or extract data from it — including casual phrasings like
  "what does this PDF say?" or "fill out this form for me", even if they
  don't explicitly mention "PDF" or "extraction".
```

Poor:

```yaml
description: Helps with PDFs.
```

The good example: imperative ("Use this skill whenever..."), specific scope (extract / fill / merge), explicit casual variants.

## Body content

The Markdown body has no format restrictions, but the recommended sections are:

- Step-by-step instructions
- Examples of inputs and outputs
- Common edge cases / gotchas

The agent loads the **entire body** when the skill activates, so keep it focused. Move detailed reference material into separate files.

## Progressive disclosure

Three load stages:

| Stage          | What's loaded                            | Token budget                  |
| -------------- | ---------------------------------------- | ----------------------------- |
| Discovery      | `name` + `description` for every skill   | ~100 tokens per skill         |
| Activation     | Full `SKILL.md` body                     | < 5,000 tokens (recommended)  |
| Resources      | `scripts/`, `references/`, `assets/`     | Loaded only when needed       |

Keep `SKILL.md` under **500 lines** and **5,000 tokens**. Move detail into `references/`, and tell the agent *when* to load each file.

## File references

Reference other files using paths **relative to the skill root**:

```markdown
See [the API error guide](references/api-errors.md) for details.

Run the extraction script:
scripts/extract.py
```

Keep references one level deep — avoid `references/sub/sub/file.md` chains.

## Validation

Use the official validator:

```bash
skills-ref validate ./my-skill
```

Or run the bundled `scripts/validate-skill.sh` in this skill, which checks the same constraints plus body line/token counts and that referenced files exist.
