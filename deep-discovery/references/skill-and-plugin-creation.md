# Agent skill / plugin / integration pattern

Use this pattern when planning, auditing, repairing, or packaging an agent skill, plugin, MCP server, hook, or harness extension. Works across Claude Code, Cursor, Codex, Copilot, Gemini CLI, OpenCode, and any other Agent Skills client. Focus on whether future agent runs will discover the right capability, load only the right context, follow the intended workflow, and have clear validation evidence after installation.

Deliverable shape: final plan or audit verdict, files to create/edit/split/remove, trigger prompts that should and should not activate the skill, validation commands and expected evidence, install/cache/restart notes, top remaining risks, honest readiness assessment.

## Foundation (Q1-Q10)

- What is the goal, and how do we get there?
- Is this a standalone skill, a multi-skill plugin, an MCP server, a hook, a slash-command bundle, or a marketplace entry?
- Who should invoke it, and what exact user prompts should trigger it?
- What problem does it solve that existing system skills do not already solve?
- What artifacts are required: `SKILL.md`, `references/`, `assets/`, `scripts/`, plugin manifest, hooks, MCP config, marketplace metadata?
- What should be invoked implicitly through metadata vs explicitly by name?
- What dependencies, network access, credentials, permissions, or external services are required?
- What must live in source vs plugin cache vs marketplace vs user config?
- What validation evidence proves the agent can discover and use it?
- What is intentionally out of scope for this skill?

## Mechanics (Q11-Q30)

- Plugin manifest fields, folder name, and normalized identity
- Marketplace entry path, policy, category, install state, and product gating (if applicable)
- User config enablement and marketplace registration
- Source-to-cache sync or install workflow
- Skill frontmatter `name`, trigger description, and keyword coverage
- Plugin interface display name, short description, brand color, default prompts
- Progressive disclosure: what stays in `SKILL.md` (≤ 200 lines) vs reference files
- Reference file routing, one-level layout, and when each file should be read
- Scripts, assets, hooks, MCP servers, apps — and whether each is actually needed
- Cross-platform path handling, shell assumptions, and command examples (Linux / macOS / Windows / WSL)
- Versioning, update workflow, and stale cache behavior
- Conflict handling with existing skills, plugins, aliases, and user instructions
- Security boundaries for secrets, filesystem access, network access, and command execution
- Failure mode when the plugin is disabled, missing, malformed, or partially installed
- What the user sees in the agent UI vs what future agents see in skill metadata

## Stress testing (Q31-Q50)

- What happens if the plugin manifest is invalid JSON or the folder name does not match the plugin name?
- What happens if the skill frontmatter is invalid YAML, overlong, vague, or uses the wrong name?
- What happens if the marketplace path points to the wrong root or stale source?
- What happens if the source plugin is updated but the cache copy is stale?
- What happens if the agent loads the plugin but not the intended skill?
- What happens if the trigger description is too narrow and the skill is missed?
- What happens if the trigger is too broad and the skill loads in unrelated conversations?
- What happens if another skill has a similar name, similar description, or overlapping instructions?
- What happens if a reference file is not linked from `SKILL.md` or the routing index?
- What happens if `SKILL.md` becomes large enough to defeat progressive disclosure?
- What happens if a future agent follows old monolithic documentation instead of the split files?
- What happens if the plugin assumes a tool, app, MCP server, sub-agent, or browser capability that is unavailable?
- What happens if the plugin contains secrets, user-specific paths, or machine-specific state?
- What happens if installation succeeds but the agent must be restarted or cache refreshed before it is visible?
- What user-facing behavior would reveal the plugin is half-installed?

## Alternatives / prior art (Q51-Q65)

- Is a plugin required, or would a standalone skill be simpler?
- Is a new skill required, or should an existing skill be updated?
- Should this be project-local instructions (CLAUDE.md / AGENTS.md) instead of a reusable skill?
- Should this be an MCP / app integration instead of process documentation?
- Should references be split by domain, provider, workflow phase, or artifact type?
- Can an existing scaffold script, validation script, or packaged example be reused?
- Which parts duplicate built-in agent guidance and should be removed?
- Which parts need deterministic scripts instead of prose?
- What would a minimal plugin contain if all nice-to-have pieces were removed?
- What would make this easier to publish, install, or audit later?

## Feasibility (Q66-Q80)

- Can basic skill validation run on source and cache copies?
- Can the manifest and marketplace metadata parse as JSON?
- Can a debug-prompt-input style command show the skill metadata for realistic trigger prompts?
- Can the cache copy be synced without deleting unrelated user changes?
- Can marketplace registration and plugin enablement be verified from user config?
- Can future maintainers understand which files are source of truth?
- Can updates be applied without requiring network access or private credentials?
- Can the plugin work when the workspace is not a git repository?
- Can the plugin work on Windows paths with spaces?
- Can the validation commands fail loudly when the plugin is not discoverable?

## Refinement (Q81-Q90)

- Which trigger words should be added or removed from the description?
- Which instructions can be moved out of `SKILL.md` into references?
- Which reference files are too small, too large, overlapping, or hard to route to?
- Which examples are concrete enough to guide future agent runs?
- Which scripts or assets are unused and should be removed?
- Which validation commands belong in the plugin's maintenance notes vs the final response?
- Which installation or restart caveats should be made explicit?
- Which user-specific paths should be generalized or documented as local-only?
- Which names, categories, and UI labels need to be clearer?
- What is the smallest change that makes the plugin easier to use correctly?

## Synthesis (Q91-Q100)

- Final plugin or skill plan
- Final plugin or skill audit verdict
- Files to create, edit, split, or remove
- Trigger prompts that should and should not activate the skill
- Validation commands and expected evidence
- Installation, cache sync, and restart notes
- Top risks that remain after the changes
- Concrete follow-up work, if any
- Honest assessment of whether the plugin is ready to publish
