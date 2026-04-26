# Slicing Tasks

Each task in `PLAN.md` is a **vertical slice** — one shippable piece of UI or behavior, structure + styling + interaction in one piece. The rules below define what a slice is, when to add a sub-task, and how to mark dependencies honestly.

## The vertical-slice rule

A task qualifies as a vertical slice when **all four** are true:

1. **Independently buildable.** It doesn't have to be coordinated with anyone else's task in the same phase to make progress (modulo declared blockers).
2. **Independently verifiable.** When done, you can look at the result and check it against the brief without other tasks being finished.
3. **Single-session-completable.** A focused engineer or agent can finish it in one sitting. If it can't, slice it smaller.
4. **Vertically integrated.** Structure, styling, and interaction all in one piece — not "build the markup", "add styles", "wire events" as three tasks.

If a "task" fails any of these, restructure it.

## Anti-patterns

- **Layer-only tasks.** "Add the CSS for the dashboard." Wrong — that has no verifiable outcome by itself.
- **Setup tasks.** "Initialize the project." "Configure the linter." These aren't vertical slices. The first vertical slice that needs the linter installs the linter.
- **"Backend then frontend" splits.** A single feature needing both gets one task that touches both layers. Two tasks only when the backend has multiple consumers.
- **Tasks named after a verb only.** "Refactor the user component." Refactor *to what*? Slice it as the *destination*, not the verb: "User component supports avatar uploads."
- **Tasks named after a file.** "Update `Sidebar.tsx`." Files aren't user-visible outcomes. "Sidebar collapses on mobile" is the slice; the file is the implementation detail.

## When to add sub-tasks

**Default: don't.** Most tasks are atomic. Add sub-tasks only when a task has clearly-separable interior steps that:

- Map to distinct integration points (three independent endpoints in one feature),
- Or have distinct verification criteria (the form has three states each independently checkable),
- Or share a single code change but have separable rollouts (feature flag → unflag → cleanup).

Sub-tasks are **flat**. One level deep, never two. If you find yourself wanting two levels, the parent task is too big — split it into two parent tasks instead.

## Dependency marking

Mark dependencies in the task's `Blocked by:` line. Be honest:

- **Mark a dependency** only when task B genuinely cannot be **built or verified** until A is done. Most tasks aren't actually blocked.
- **Do not mark** "logical ordering" preferences as dependencies. If you'd *prefer* to do A first but B is technically possible without it, leave B unblocked so a parallel worker can pick it up.
- **Reference real task identifiers** — task names within `PLAN.md`, or issue numbers if these tasks correspond to filed GitHub issues.
- **Independent items get an explicit "None — can start immediately"** so a reader knows it's parallel-safe.

The goal: **maximize parallelism**. Inflated dependency chains throw away most of the value of phasing.

## Ordering inside a phase

Within each phase the task order is:

1. **Dependencies first.** If A blocks B, A appears above B.
2. **Foundation before specifics.** Layout shells, shared components, and tokens come before page-specific tasks that consume them.
3. **Highest visual priority next.** The most-prominent UI element first so the user can validate aesthetic direction before details pile up.
4. **Risk first among independents.** The hardest or most-uncertain task goes early so problems surface before everything else is built around them.

These rules can conflict. **Dependencies always win.** Among non-dependent items, prefer risk-first — it's easier to redirect once than to redo nine downstream tasks.

## Use the project's package manager in task commands

Tasks frequently reference install or run commands ("add the X library", "run the Y migration", "install the linter"). Those commands **must** match the package manager the project actually uses — `uv` / `poetry` / `pdm` / `pipenv` for Python, `pnpm` / `bun` / `yarn` / `npm` for Node, etc. Detection rules and the full lookup table live in `references/discovery.md` under "Package manager detection".

Rules:

- **Detect once, use everywhere.** Pick the manager during discovery (step 2 in the workflow) and use the same commands across every task in `PLAN.md` / `TASKS.md`.
- **Lockfile wins.** If a project has both `requirements.txt` and a `uv.lock`, write tasks against `uv` — the lockfile is the source of truth.
- **Don't sprinkle `pip` / `npm` defaults.** A task that says "install the linter via `pip install ruff`" is wrong if the repo uses `uv`. Write it as `uv add --dev ruff`.
- **For greenfield projects, ask once.** If no lockfile or manifest yet exists, ask the user which manager to assume before generating any install-command-shaped task. Don't guess.
- **Carry the choice into the breakdown.** The Detailed Task Breakdown's **How** bullets contain the actual commands a builder will run. Use the detected manager there too.

Example — same task, different ecosystems:

```markdown
- [ ] **Project lints on every commit**: Run `<manager-aware lint command>` via the configured pre-commit hook. _New tooling._
```

How (in Detailed Task Breakdown):

```markdown
**How:**
- (uv project)        Add ruff:    `uv add --dev ruff`        ; configure in pyproject.toml; wire `uv run ruff check` into the pre-commit hook
- (poetry project)    Add ruff:    `poetry add --group dev ruff` ; same hook wiring
- (pnpm project)      Add eslint:  `pnpm add -D eslint`       ; pnpm exec eslint . in pre-commit
- (bun project)       Add eslint:  `bun add -d eslint`        ; bunx eslint . in pre-commit
```

Pick **one** of those — whichever matches the project — and write that one in the actual `PLAN.md`. The example above is for illustration only.

## Naming tasks

Task names go on the same line as the checkbox. The format is:

```markdown
- [ ] **<Verb-phrased outcome>**: <one sentence on what to build and what "done" looks like>. _Reuses: <components or tokens this leans on>._
```

Rules:

- **Outcome-shaped, not verb-shaped.** ✅ `Subnet calculator accepts CIDR input` — ❌ `Add CIDR input`.
- **One sentence.** If you need a paragraph, the task is too big.
- **End with a "Reuses" / "Modifies" / "New component" tag.** Each task explicitly says whether it reuses existing code, modifies it, or creates something new. This is the link back to discovery.

## The Detailed Task Breakdown section

Every TODO listed in a phase must have a corresponding section under `## Detailed Task Breakdown` in `PLAN.md`:

```markdown
### <Task name>
**Why:** one sentence on the user-visible problem this solves
**How:** 2–4 bullet points on the implementation approach
**Impact:** Critical | High | Medium | Low
**Effort:** Hours estimate (rough — 2h, 1d, 3d) — be honest
```

If you can't write the **Why** and **Impact**, the task isn't ready to plan. Either you don't understand the problem or it isn't a real task. Send it back to the user.
