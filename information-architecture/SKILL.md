---
name: information-architecture
description: Plan the structural and execution architecture of a feature, app, or site — produce both an `INFORMATION_ARCHITECTURE.md` (site map, navigation, content hierarchy, user flows, URL strategy, naming conventions, component reuse map) AND a phased `PLAN.md` (phases by impact/effort/risk, vertical-slice tasks with sub-tasks, dependencies, estimates, and a detailed task breakdown with Why/How/Impact/Effort). Use this skill whenever the user wants to plan a product or feature, design site structure, lay out information architecture, map user flows, organize content, break work into phases, build a roadmap, plan an implementation order, or hits you with phrases like "plan the IA", "map the structure", "break this into tasks", "give me a roadmap", "phase out the work", "create an enhancement plan", or "what should I build first". Also use when reviewing or refactoring an existing IA or project plan.
license: MIT. See LICENSE for full terms.
metadata:
  author: mkabumattar
  version: "1.0.0"
---

# Information Architecture

Plan the structure **and** the execution. Two artifacts: `INFORMATION_ARCHITECTURE.md` (the structural skeleton) and `PLAN.md` (the phased delivery plan with vertical-slice tasks, sub-tasks, dependencies, and estimates).

## When to use

- The user wants to plan a product, feature, app, or site before building.
- The user wants to map navigation, content hierarchy, user flows, or URL strategy.
- The user wants a roadmap, an enhancement plan, or "what should I build first".
- A task chain ends in "and break it into phases / tasks I can pick up one at a time".

## Output paths

By default, save both documents under `<feature-slug>/` at the repo root:

```
<feature-slug>/
├── INFORMATION_ARCHITECTURE.md    # structure: sitemap, nav, flows, conventions
└── PLAN.md                         # execution: phases → tasks → sub-tasks
```

If the repo already uses a convention (`.design/<slug>/`, `.plan/<slug>/`, `docs/specs/<slug>/`, etc.) **use that instead** — never invent a parallel one.

### `TASKS.md` instead of `PLAN.md` (lightweight mode)

For a small, focused feature — single page, single dialog, focused refactor — produce a flat `TASKS.md` instead of a phased `PLAN.md`. Use `assets/templates/TASKS.template.md`. Same vertical-slice rules and reuse tags (`Reuses` / `Modifies` / `New component`); same five sections (Foundation · Core UI · Interactions & States · Responsive & Polish · Review); no phase numbering, no Detailed Task Breakdown. Promote to `PLAN.md` only when scope grows past ~10 tasks or estimates / dependency tracking become useful.

## Workflow

1. **Locate or gather context.** Look for an existing brief (`*BRIEF*.md`, `*SPEC*.md`, `README` of the feature folder). If none, ask the user one short paragraph: what is being built, for whom, and what success looks like. Don't conduct a long interview at this step.
2. **Discover the existing codebase.** Spawn a background `Explore` subagent to learn what's already there — routing, navigation components, layout shells, existing pages, file-naming conventions, content models, dependencies. **Do not propose an architecture that ignores what's already built.** Load `references/discovery.md` for the full checklist of what to look for.
3. **Interview lightly, with recommendations.** Ask 4–6 short questions about structure (primary user goals ranked by frequency, max nav depth, growing vs. fixed content, distinct user types, the "80% page", URL conventions). For each question, **propose your recommended answer** so the user can accept by default or push back. Don't ask without recommending.
4. **Produce `INFORMATION_ARCHITECTURE.md`.** Copy `assets/templates/INFORMATION_ARCHITECTURE.template.md` and fill in: Site Map · Navigation Model (primary, secondary, utility, mobile) · Content Hierarchy (per major page) · User Flows · Naming Conventions · Component Reuse Map · Content Growth Plan · URL Strategy. Use the project's existing domain language consistently — pick one word per concept and use it everywhere.
5. **Phase the work.** Group tasks into phases by **impact × effort × risk**, not by area. The default phase set: *Quick Wins* → *Core Feature Upgrades* → *Advanced Capabilities* → *Code Quality & Maintainability* → *Accessibility & Polish*. For small features two or three phases is enough — don't pad. Load `references/phasing.md` for the rationale and how to choose.
6. **Slice tasks (and sub-tasks where needed).** Each task is a **vertical slice**: structure + styling + interaction in one shippable piece, independently buildable, independently verifiable, completable in a single session. Add sub-tasks only when a task has clearly separable interior steps (an integration with three independent endpoints, for example). Mark dependencies honestly. Order within each phase by: dependencies first → highest visual priority → highest risk first. Load `references/task-slicing.md` for the slicing rules.
7. **Produce `PLAN.md`.** Copy `assets/templates/PLAN.template.md`. Fill in: Overview (one paragraph) · the phases with their `### TODO` checklists · the **Detailed Task Breakdown** (one section per TODO with Why · How · Impact · Effort).
8. **Print a top-5 summary.** After writing both files, list the five most-impactful items in the plan and ask: *"Want me to start on the first one, or revise the plan?"*

## Available resources

- `assets/templates/INFORMATION_ARCHITECTURE.template.md` — IA doc skeleton.
- `assets/templates/PLAN.template.md` — phased plan skeleton (phases, TODOs, task breakdown).
- `assets/templates/TASKS.template.md` — flat lightweight alt for small features (no phase numbering, no Detailed Task Breakdown).
- `assets/examples/team-knowledge-base/` — fully-worked pair (medium feature → IA + PLAN).
- `assets/examples/small-dialog/` — fully-worked TASKS.md (small focused feature → flat list).
- `references/discovery.md` — load when starting step 2 (codebase exploration checklist + package-manager detection).
- `references/phasing.md` — load when designing step 5 (how to phase by impact × effort × risk; small / frontend / full feature shapes).
- `references/task-slicing.md` — load when slicing step 6 (vertical-slice rules, dependency ordering, package-manager-aware commands).

## Top gotchas (always inline — do not skip)

- **Don't propose an architecture that ignores existing code.** Discovery comes before design. If the project already has a routing layout / nav component / content model, the IA *extends* it.
- **Vertical slices, not layers.** Never split a task into "build HTML", then "add CSS", then "wire JS". One task = one shippable piece of UI / behavior.
- **Don't create "set up the project" tasks.** That's not a vertical slice. Foundational *components* (a layout shell, a tokens file) are fine; "init the repo" is not.
- **Flat task lists.** No nesting deeper than one level of sub-tasks. Two levels of nesting is fine; three is unreadable.
- **Phase by impact × effort × risk, not by area.** "All the auth stuff in Phase 1" is wrong if half of it is high-risk and half is quick-win — split them across phases.
- **One word per concept, used everywhere.** "Project" and "Workspace" can't be the same thing in the IA — pick one. The Naming Conventions table is the contract.
- **Recommend answers when interviewing.** Don't ask "what depth of navigation do you want?" — ask "I'd recommend max two levels of nav depth — sound right?". The user's job is to accept or push back, not to design.
- **Mark `Blocked by` honestly.** If task B genuinely needs A done first, say so. If they're independent, say so. Inflated dependency chains kill parallelism.
- **Detailed Task Breakdown is mandatory.** Every TODO gets a Why · How · Impact · Effort section. If you can't articulate Why and Impact, the task isn't ready to plan. (Only required in `PLAN.md`; `TASKS.md` skips it.)
- **Use the project's package manager in every command.** Detect by lockfile (`uv.lock` / `poetry.lock` / `pdm.lock` / `Pipfile.lock` / `pnpm-lock.yaml` / `bun.lock` / `yarn.lock` / `package-lock.json` / `Cargo.lock` / `go.sum` / `Gemfile.lock` / `composer.lock`). Never write `pip install ...` if the repo uses `uv` or `poetry`; never write `npm install ...` if it uses `pnpm` or `bun`. Lockfile wins over manifest. See `references/discovery.md` "Package manager detection" for the full table.

## What you DO

1. Look for existing brief/spec first; if none, take one paragraph from the user — no long interview.
2. Run discovery against the codebase before designing the IA.
3. Use the project's existing domain language consistently.
4. Interview with **recommended answers** (4–6 short questions max).
5. Save both documents under `<feature-slug>/` at the repo root, or honor an existing `.design/`, `.plan/`, or `docs/specs/` convention.
6. Phase by impact × effort × risk; small features get 2–3 phases, not 5.
7. Slice tasks as vertical slices; mark dependencies; order by deps → visual priority → risk.
8. Add sub-tasks only when a task has separable interior steps.
9. Fill the Detailed Task Breakdown for *every* TODO (Why · How · Impact · Effort).
10. Print a top-5 summary and offer to start on the first item.

## What you do NOT do

- Propose a brand-new architecture when the codebase already has structure to extend.
- Split tasks by layer (HTML / CSS / JS).
- Create "scaffold the repo" / "set up tooling" tasks — they're not vertical slices.
- Nest task lists more than one level deep.
- Phase by area instead of by impact × effort × risk.
- Use multiple words for the same concept ("project" *and* "workspace" *and* "deck").
- Ask interview questions without giving a recommendation alongside.
- Inflate `Blocked by` chains — independent tasks should be marked as such so they can be picked up in parallel.
- Skip the Detailed Task Breakdown.
- Save plans into a parallel directory when an existing convention exists.
