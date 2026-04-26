# Bundling Scripts in Skills

Distilled from the [official guide](https://agentskills.io/skill-creation/using-scripts). Load this when bundling executables in `scripts/`.

## Decision: one-off command vs bundled script

| Situation                                                   | Use                                       |
| ----------------------------------------------------------- | ----------------------------------------- |
| Existing tool already does the job                           | One-off command in `SKILL.md` (e.g. `uvx`) |
| Reusable logic, multi-step, or hard to get right first try   | Bundled script in `scripts/`              |
| Repeated logic across tasks (chart builder, parser, validator) | Bundled script in `scripts/`             |

## One-off commands

When a package already does what you need, reference it inline:

```bash
uvx ruff@0.8.0 check .              # Python — uvx (bundled with uv)
pipx run 'black==24.10.0' .         # Python — pipx
npx eslint@9 --fix .                # Node — bundled with npm
bunx eslint@9 --fix .               # Node — bundled with Bun
deno run --allow-read npm:eslint@9  # Deno
go run github.com/.../cmd@v1.62.0   # Go — built-in
```

Tips:

- **Pin versions** (`@0.8.0`, `==24.10.0`, `@9`) so the command behaves the same over time.
- **State prerequisites** in `SKILL.md` ("Requires Node 18+") rather than assuming the agent's environment.
- **Move to a script** when the command grows complex enough that getting it right on the first try is hard.

## Bundled scripts

Reference with relative paths from the skill root:

```markdown
## Available scripts

- **`scripts/validate.sh`** — Validates configuration files
- **`scripts/process.py`** — Processes input data

## Workflow

1. Run validation:

       bash scripts/validate.sh "$INPUT_FILE"

2. Process the result:

       python3 scripts/process.py --input results.json
```

The agent runs commands from the skill root, so script paths in code blocks resolve correctly.

## Self-contained scripts

Bundle dependencies inline so the agent runs the script with one command — no separate manifest, no install step.

### Python (PEP 723)

```python
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "beautifulsoup4>=4.12,<5",
# ]
# ///

from bs4 import BeautifulSoup
# ...
```

Run:

```bash
uv run scripts/extract.py        # uv (recommended)
pipx run scripts/extract.py      # pipx (alternative)
```

Pin versions with [PEP 508](https://peps.python.org/pep-0508/). Use `uv lock --script` for full reproducibility.

### Deno

```typescript
#!/usr/bin/env -S deno run

import * as cheerio from "npm:cheerio@1.0.0";
// ...
```

Use `npm:` for npm packages, `jsr:` for Deno-native. Cached globally; first run downloads, rest are fast.

### Bun

```typescript
#!/usr/bin/env bun

import * as cheerio from "cheerio@1.0.0";
// ...
```

Auto-installs missing packages at runtime when no `node_modules` exists.

### Ruby (`bundler/inline`)

```ruby
require 'bundler/inline'

gemfile do
  source 'https://rubygems.org'
  gem 'nokogiri', '~> 1.16'
end
```

## Designing for agentic use

The agent reads stdout/stderr to decide what to do next. A few choices make scripts dramatically easier to use.

### Avoid interactive prompts

**Hard requirement.** Agents run in non-TTY shells — they cannot answer prompts, password dialogs, or confirmation menus. A blocking script hangs forever.

```text
# Bad
$ python scripts/deploy.py
Target environment: _

# Good
$ python scripts/deploy.py
Error: --env is required. Options: development, staging, production.
Usage: python scripts/deploy.py --env staging --tag v1.2.3
```

Accept all input via flags, env vars, or stdin.

### Document with `--help`

The agent learns the interface from `--help`. Include description, flags, and at least one example:

```text
Usage: scripts/process.py [OPTIONS] INPUT_FILE

Process input data and produce a summary report.

Options:
  --format FORMAT    Output format: json, csv, table (default: json)
  --output FILE      Write to FILE instead of stdout
  --verbose          Print progress to stderr

Examples:
  scripts/process.py data.csv
  scripts/process.py --format csv --output report.csv data.csv
```

Keep it concise — `--help` output enters the agent's context.

### Helpful error messages

```text
# Bad
Error: invalid input

# Good
Error: --format must be one of: json, csv, table.
       Received: "xml"
```

Say what went wrong, what was expected, what to try.

### Structured output

Prefer JSON / CSV / TSV over free-form text — it's parseable by both the agent and standard tools (`jq`, `cut`, `awk`).

```text
# Whitespace-aligned — hard to parse
NAME          STATUS    CREATED
my-service    running   2025-01-15

# Delimited — unambiguous
{"name": "my-service", "status": "running", "created": "2025-01-15"}
```

**Separate data from diagnostics:** structured data → stdout, progress / warnings → stderr. Lets the agent capture clean output while still seeing diagnostics.

### Other considerations

- **Idempotency.** Agents may retry. "Create if not exists" is safer than "create and fail on duplicate".
- **Input constraints.** Reject ambiguous input with a clear error rather than guessing. Use enums and closed sets.
- **Dry-run support.** For destructive operations, `--dry-run` lets the agent preview.
- **Meaningful exit codes.** Distinct codes for different failure types (not-found, bad-args, auth-fail). Document them in `--help`.
- **Safe defaults.** Destructive operations should require explicit `--confirm` / `--force`.
- **Predictable output size.** Many harnesses truncate tool output beyond ~10–30K chars. If output may be large, default to a summary, support `--offset`/`--limit`, or require `--output <file>`.
