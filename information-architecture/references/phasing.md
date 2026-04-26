# Phasing the Plan

Phases group tasks so that a builder can ship value incrementally and so that the plan reads as a sequence of increasingly-ambitious milestones — not a flat dump of TODOs.

## The phasing axes

Phase by **impact × effort × risk**, never by area.

- **Impact** — how much user-visible value this task delivers, from `low` to `critical`.
- **Effort** — wall-clock work, from `< 1 day` to `> 1 week`.
- **Risk** — uncertainty: technical unknowns, integration with external systems, dependencies on shared infra, *not* "I haven't done this before".

Two tasks in the same area (say, "auth") can land in different phases if one is a low-effort high-impact tweak and the other is a multi-week rewrite.

## Default phase set

Most plans fit one of these two shapes. Pick whichever matches your scope; don't pad to five phases for a small feature.

### Five-phase (full feature, large scope)

1. **Quick Wins** *(effort: low)* — Things that take less than a day each and have visible impact. Builds momentum and validates the IA against reality early.
2. **Core Feature Upgrades** *(effort: medium)* — The headline work. Most of the planned value lives here.
3. **Advanced Capabilities** *(effort: high)* — Larger initiatives that meaningfully expand the feature's scope. Often net-new.
4. **Code Quality & Maintainability** — Refactoring, internal API cleanup, deprecation removal, type tightening. Non-user-visible but unblocks future phases.
5. **Accessibility & Polish** — A11y pass, mobile responsiveness, animation polish, loading/empty/error state coverage, error messages.

### Three-phase (small feature, focused scope)

1. **Foundation** — Tokens, layout shells, shared components the rest of the feature depends on.
2. **Core UI** — The actual feature pages and the interactions that make them useful.
3. **Polish & A11y** — Responsive behavior, edge states, accessibility.

A two-phase plan (`Foundation` → `Core UI`) is fine for one-page features. A one-phase plan is a smell — the feature probably doesn't need a `PLAN.md`, just a `TASKS.md` (see `assets/templates/TASKS.template.md`).

### Frontend-feature five-phase (a single interactive UI feature)

This is the right shape for a focused frontend feature — one page, one dialog, or one workflow — that has enough interactions and states to warrant separate phases but isn't a whole-app initiative. Most `TASKS.md` files use this exact shape (sections become phases).

1. **Foundation** — Token additions, layout shell or container the feature plugs into, shared components needed before the feature itself can be built.
2. **Core UI** — The structural body of the feature: the pages, panels, or dialogs as static UI.
3. **Interactions & States** — Hover, focus, disabled, loading, empty, error, success states. Form validation. Optimistic UI. Live regions.
4. **Responsive & Polish** — Breakpoint behavior, mobile-first concerns, animation polish, microcopy review.
5. **Review** — One task: walk the brief end-to-end, verify each requirement, file any leftover defects via the `qa` skill (or your equivalent).

The five-phase frontend shape and the lightweight `TASKS.md` template share the same section names — that's deliberate. If a `TASKS.md` outgrows itself, promote it to `PLAN.md` without renaming sections.

## Picking which task goes in which phase

For each task, ask:

1. **Does anything else depend on this?** → Earlier phase.
2. **Is the impact high and the effort low?** → Quick Wins.
3. **Is this the headline work?** → Core.
4. **Is this net-new scope (not part of the original ask)?** → Advanced.
5. **Is this internal-only (refactor, type cleanup)?** → Code Quality.
6. **Is this a polish item (a11y, edge states, mobile)?** → Polish.

## Within a phase, order by

1. **Dependencies first** — if A blocks B, A is earlier in the phase.
2. **Visual priority** — the most prominent UI element early, so the user can validate the aesthetic direction before details accrue.
3. **Risk first among independent items** — surface unknowns early. The hardest piece is the *first* one to attempt, not the last.

These three rules can conflict. Dependencies always win. Between visual priority and risk-first, lean **risk-first** — easier to redirect the design once than to redo nine tasks.

## Phase ordering rules

- A phase contains tasks that are roughly **comparable in effort tier**. Don't put one 30-minute item next to a 2-week item in the same phase — that's two phases.
- Phases are **shippable boundaries**. A reviewer should be able to look at the work after Phase 1 and say "this is shippable on its own" even if more is planned.
- Phases are **honest about progress**. Don't backload the unpleasant tasks into "Phase 5 — Polish" if they're really structural blockers.

## Anti-patterns

- **Phasing by area.** "Phase 1: all auth, Phase 2: all dashboard, Phase 3: all settings." Wrong — high-impact tweaks across all three areas should go in Phase 1, not held hostage to a per-area completion.
- **Five phases for a one-page feature.** If the work fits in two phases, use two. Padding is dishonest about scope.
- **A "set up the project" first phase.** If the repo exists, there's no scaffolding phase. If it doesn't, the scaffolding *is* one task in Foundation, not a whole phase.
- **Polish-only Phase 1.** "Quick Wins" is genuinely high-impact, low-effort. If your Quick Wins are all visual tweaks, you don't have a Quick Wins phase — you have a Polish phase mislabeled.
