---
name: skill-builder
description: Build a new Agent Skill that follows the agentskills.io specification and best practices — slim `SKILL.md` (≤ 200 lines / 5K tokens), valid kebab-case `name`, imperative `description` under 1024 chars, progressive disclosure via `references/`, bundled `assets/` and `scripts/`, and an MIT `LICENSE`. Use this skill whenever the user asks to create, scaffold, build, write, or author a new Agent Skill — including phrasings like "build a skill for X", "scaffold a new skill", "create an agent skill", "make me a skill that does X", "write a SKILL.md for ...", or "I want to publish a skill on agentskills.io". Also use when reviewing or refactoring an existing oversized `SKILL.md` (a sign that detail should be moved to `references/`).
license: MIT. See LICENSE for full terms.
compatibility: Requires bash 4.0+ and `python3` (used by the validator for line/token counts). Generated skills target the open Agent Skills format (https://agentskills.io/specification).
metadata:
  author: mkabumattar
  version: "1.0.0"
---

# Skill Builder

Create new Agent Skills that follow the [agentskills.io spec](https://agentskills.io/specification) and the [official best practices](https://agentskills.io/skill-creation/best-practices).

## When to use

- The user asks to create, scaffold, build, or write a new Agent Skill.
- The user wants to publish a skill or refactor a bloated `SKILL.md`.
- A task chain ends in "and put it in a skill so I can reuse it across projects".

## Required structure

Every skill is a folder with a `SKILL.md`. Optional directories carry detail loaded on demand:

```
<skill-name>/
├── SKILL.md          # required: frontmatter + slim instructions (≤ 200 lines / 5K tokens)
├── LICENSE           # MIT to match this repo
├── references/       # detailed docs the agent loads only when needed
├── assets/
│   ├── templates/    #   - copy-edit starting points
│   └── examples/     #   - full reference implementations
└── scripts/          # bundled executables (validators, scaffolders, processors)
```

Frontmatter must include `name` (kebab-case ≤ 64 chars, matching folder) and `description` (≤ 1024 chars). See `references/spec.md` for the full field list and naming rules.

## Workflow

1. **Ground the skill in real expertise.** Do not generate from "best practices for X" — the result will be vague boilerplate. Extract from a real task you've completed, real runbooks, or real incident reports. Load `references/best-practices.md` if you want the full rationale.
2. **Pick a kebab-case `name`.** Lowercase letters, digits, and single hyphens only; ≤ 64 chars; no leading/trailing/consecutive hyphens; must match the folder name.
3. **Write the `description` like an instruction**, not a summary. Use imperative phrasing ("Use this skill when..."), focus on user intent, list casual phrasings the user might type. Stay under 1024 chars. See `references/description-optimization.md` for the eval-loop that improves trigger rates.
4. **Scaffold the folder** with one command:
   ```bash
   bash scripts/new-skill.sh <skill-name> "<one-line description>"
   ```
   It creates the directory tree, writes a starter `SKILL.md` with valid frontmatter, copies the MIT `LICENSE`, and prints next steps. To start from scratch instead, copy `assets/templates/SKILL.template.md` (minimal) or `assets/templates/SKILL-full.template.md` (with all the canonical sections).
5. **Write a slim `SKILL.md` body** — under 200 lines / 5,000 tokens. Use the canonical sections in this order:
   - **When to use** — bullet triggers
   - **Required structure** — minimal canonical example
   - **Workflow** — numbered steps with explicit "load `references/<topic>.md` when ..." pointers
   - **Available resources** — full inventory of bundled files
   - **Top gotchas** — non-obvious environment/domain facts inline
   - **What you DO** / **What you do NOT do** — short imperative lists
6. **Move detail into `references/<topic>.md`.** For each file, tell the agent **when** to load it (e.g. "Load `references/<error-handling>.md` if the API returns a non-200"), not just "see `references/`". Use `assets/templates/reference.template.md` for the file shape.
7. **Bundle resources sensibly** — copy-edit starting points in `assets/templates/`, full worked examples in `assets/examples/`, executables (validators, scaffolders, helpers) in `scripts/`. For Python scripts prefer [PEP 723 inline deps](https://peps.python.org/pep-0723/) so they run with `uv run` and need no install step. See `references/scripts-guide.md` for designing scripts for agentic use.
8. **Add `LICENSE`** (the scaffolder does this automatically). Use MIT to match this repo.
9. **Validate** with `bash scripts/validate-skill.sh <skill-dir>` — checks frontmatter shape, name format, name-matches-folder, description length, body length/tokens, license, that every referenced file exists, and that referenced files are mentioned in `SKILL.md`. Aim for 100%.
10. **Optimize the description with eval queries** before publishing — write 8-10 should-trigger and 8-10 should-not-trigger prompts and run them through your agent. See `references/description-optimization.md`.

## Available resources

- `assets/templates/SKILL.template.md` — minimal frontmatter-only starting point.
- `assets/templates/SKILL-full.template.md` — full structure with every canonical section.
- `assets/templates/reference.template.md` — shape for `references/<topic>.md` files.
- `assets/examples/roll-dice/` — tiny worked example skill (matches the official quickstart).
- `scripts/new-skill.sh` — one-shot scaffolder; creates folder tree, `SKILL.md`, `LICENSE`.
- `scripts/validate-skill.sh` — spec-compliance checker; run after writing.
- `references/spec.md` — load when uncertain about a frontmatter field, naming rule, or directory convention.
- `references/best-practices.md` — load when designing a skill from scratch (grounding in real expertise, calibrating control, gotchas-section pattern, validation loops).
- `references/description-optimization.md` — load when the skill triggers too rarely or too often, or before publishing.
- `references/eval.md` — load when measuring whether the skill's *outputs* are good (test cases, assertions, train/val splits).
- `references/scripts-guide.md` — load when bundling executables in `scripts/` (one-off vs self-contained, PEP 723, designing for agentic use).

## Top gotchas (always inline — do not skip)

- **`name` must match the folder name exactly.** `pdf-tools/SKILL.md` with `name: pdf_tools` fails validation. Lowercase, hyphens, no underscores.
- **The description carries the entire triggering burden.** Vague descriptions ("Helps with X") never activate. Use imperative phrasing and explicit casual variants ("...even if the user doesn't say 'CSV'").
- **Body > 5,000 tokens slows every activation.** Move detail to `references/<topic>.md` with explicit load triggers.
- **Generic LLM boilerplate produces useless skills.** "Handle errors appropriately" wastes tokens. Capture concrete project-specific gotchas, schemas, and procedures instead.
- **Tell the agent *when* to load each reference file** — not just "see references/". The agent loads `SKILL.md` once, then loads references on demand based on your instructions. Without explicit triggers, it won't.
- **Bundled scripts must be non-interactive.** Agents run in non-TTY shells; a script that prompts for input hangs forever. Accept everything via flags, env vars, or stdin.
- **Don't add specific keywords from failed eval queries to the description** — that's overfitting. Generalize to the underlying category.
- **A skill is a coherent unit of work.** Too narrow → multiple skills load for one task. Too broad → fails to trigger precisely. "Query database + format results" is one unit; adding "+ admin operations" is too much.

## What you DO

1. Ground every skill in real expertise — actual code, runbooks, conversation traces.
2. Use `bash scripts/new-skill.sh <name> "<desc>"` to scaffold, then edit.
3. Keep `SKILL.md` ≤ 200 lines / 5,000 tokens. Use progressive disclosure.
4. Tell the agent **when** to load each reference file with explicit triggers.
5. Write descriptions imperatively ("Use this skill when..."), with casual phrasing variants the user actually types.
6. Bundle templates in `assets/templates/`, examples in `assets/examples/`, executables in `scripts/`.
7. Add an MIT `LICENSE` to match this repo.
8. Run `bash scripts/validate-skill.sh <skill-dir>` and iterate until 100%.
9. Run an eval pass on the description before publishing (see `references/description-optimization.md`).
10. Keep skills coherent — one skill per coherent unit of work.

## What you do NOT do

- Generate skills from "best practices for X" articles — they produce generic boilerplate.
- Pad `SKILL.md` with definitions ("PDFs are documents that contain text").
- Use vague descriptions ("Helps with X", "This skill does Y").
- Mismatch `name` and folder, use uppercase, underscores, or consecutive hyphens.
- Skip the LICENSE.
- Add features the skill doesn't need (don't over-engineer).
- Bundle interactive scripts that prompt for input — they hang in agent runs.
- Reference files in `SKILL.md` without telling the agent **when** to load them.
- Bury gotchas in `references/` — non-obvious environment facts belong inline so the agent reads them before hitting the issue.
