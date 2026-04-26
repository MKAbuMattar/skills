# Build Tasks: <Feature / Page Name>

> Generated: <YYYY-MM-DD>
> IA: <relative path to INFORMATION_ARCHITECTURE.md, or "captured ad-hoc">

A flat, vertical-slice task list for a small or focused feature. Each task is independently buildable and verifiable in a single session. Use this format when the feature is small enough that a full phased `PLAN.md` would be overkill — typically a single page, a single dialog, a focused refactor, or a tightly-scoped UI feature.

## Foundation

- [ ] **<Outcome-shaped task name>**: <one sentence describing what to build and what "done" looks like>. _Reuses: <component / token>._
- [ ] **<Task name>**: <description>. _New component._

## Core UI

- [ ] **<Task name>**: <description>. _Depends on: <task name from Foundation, or "None — can start immediately">._
- [ ] **<Task name>**: <description>. _Modifies: <component>._

## Interactions & States

- [ ] **<Task name>**: <description>. Covers: <hover, focus, disabled, loading, empty, error states applicable here>.
- [ ] **<Task name>**: <description>.

## Responsive & Polish

- [ ] **<Task name>**: <description>. Breakpoints: <mobile / tablet / desktop / specific values>.
- [ ] **<Task name>**: Accessibility pass — <specific checks: keyboard nav, screen-reader labels, focus indicators, color contrast>.

## Review

- [ ] **Final review**: walk through the brief and confirm every requirement landed. Verify with the user; capture any leftover defects via the `qa` skill.

---

## Rules for this file

- Every task is a **vertical slice**: structure + style + interaction in one shippable piece.
- Every task carries a **reuse tag** — `_Reuses: ..._`, `_Modifies: ..._`, or `_New component._` — so the link back to discovery is explicit.
- **No layer-only tasks** ("add CSS", "wire JS"). One task = one user-visible outcome.
- **No "scaffold the project" tasks.** The first vertical slice that needs a tool installs the tool.
- **Flat list, single nesting level max.** If you need two levels, the parent task is too big — split it.
- **Use the detected package manager** in any commands or tool references (see `references/discovery.md` and `references/task-slicing.md`). Never assume `pip` / `npm` if the repo uses `uv` / `poetry` / `pnpm` / `bun`.

---

## When to graduate to PLAN.md

Switch from this template to `PLAN.template.md` when **any** of the following are true:

- The feature spans more than ~10 tasks.
- Multiple phases are genuinely different in effort tier (a one-day phase next to a two-week phase).
- The user wants estimates and a Detailed Task Breakdown (Why · How · Impact · Effort) for each task.
- Multiple people / agents will work on the plan in parallel and need explicit dependency tracking and a top-N priority list.

If you're not sure, start with `TASKS.md`. It's cheap to graduate to `PLAN.md` later.
