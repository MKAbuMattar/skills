# Interface design

Load this when the user wants to explore alternative interfaces for a chosen deepening candidate. Based on the **"Design It Twice"** heuristic — your first interface idea is unlikely to be the best, so produce several candidates in parallel and compare them before committing. Uses the vocabulary in `language.md` — Module, Interface, Seam, Adapter, Leverage.

## When to fan out

Run this only when:

- The user has picked a candidate from the audit.
- The deepened module is non-trivial — small enough that "obviously the right shape" interfaces are not yet clear, large enough that getting the interface wrong is expensive.
- The user has time to read three to four interface proposals.

For trivial deepenings (merge two pass-through helpers), skip the fanout — propose the obvious interface and move on.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy.
- The dependencies it would rely on, and which dependency category they fall into (see `deepening.md`).
- A rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete.

Show this to the user, then immediately proceed to step 2. The user reads and thinks while the sub-agents work in parallel.

### 2. Spawn sub-agents in parallel

Use whatever parallel-agent mechanism the harness provides. Spawn 3-4 agents in a single batch (single message, multiple tool calls) — sequential spawning misses the whole point of "Design It Twice".

Each agent must produce a **radically different** interface for the deepened module. To force divergence, give each a different design constraint:

- **Agent 1: Minimize the interface.** Aim for 1-3 entry points max. Maximize leverage per entry point. The smallest interface that delivers all the required behaviour.
- **Agent 2: Maximize flexibility.** Support many use cases and extension points. Optimize for "what could grow on top of this?"
- **Agent 3: Optimize for the most common caller.** Make the default case trivial; rare cases can require more work. The 80% path is the design center.
- **Agent 4 (if applicable): Ports & adapters.** Design around explicit ports for cross-seam dependencies. Useful when the dependency category from `deepening.md` is "remote but owned" or "true external".

### 3. Brief each sub-agent

Include in each brief:

- File paths and current modules being deepened.
- Coupling details — who calls what, what state is shared, where the leaks are today.
- Dependency category (from `deepening.md`).
- What sits behind the seam (logic? state? side effects? all three?).
- The project's domain vocabulary (from `CONTEXT.md` / glossary if it exists) so the proposal names things consistently.
- This skill's vocabulary (`language.md`) so the proposal names architectural shapes consistently.
- The specific design constraint for that agent (minimize / maximize-flexibility / common-case / ports).

The brief is *independent* of the user-facing problem-space explanation in step 1. Sub-agents don't need the prose framing — they need the technical specifics.

### 4. Each sub-agent outputs

1. **Interface** — types, methods, params *plus* invariants, ordering, error modes, configuration. Not just the type signature.
2. **Usage example** — short, concrete example showing how callers use it.
3. **Behind the seam** — what the implementation hides. What's in scope of the deep module, what's out.
4. **Dependency strategy** — which dependency category, and the adapter strategy (in-memory test adapter, production adapter, etc.). See `deepening.md`.
5. **Trade-offs** — where the leverage is high, where it's thin, what kinds of changes are easy under this design and what kinds are awkward.

### 5. Present and compare

Present the designs sequentially so the user can absorb each one without comparison clutter. Then compare them in prose. Contrast by:

- **Depth** — leverage at the interface. How much behaviour per unit of interface to learn?
- **Locality** — where change concentrates. If the spec changes, how many files have to move?
- **Seam placement** — does the seam land somewhere meaningful, or somewhere arbitrary?
- **Common-case ergonomics** — how short is the most-frequent caller?
- **Extension cost** — what does adding the next requirement cost under this design?

After comparing, give your own recommendation — which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu.

## Anti-patterns

- **Three almost-identical proposals.** If the three sub-agents come back with three variants of the same idea, the briefs were too similar — re-spawn with sharper constraints.
- **Sequential spawning.** Defeats the parallelism. Spawn in a single batch.
- **Letting sub-agents see each other's output.** Each must design independently. Cross-pollination collapses the comparison.
- **No recommendation at the end.** "Here are three good designs" is not a deliverable. Pick one, justify it, name where it loses.
- **Ignoring the dependency category.** A "minimize the interface" agent that ignores that the dependency is "true external" will propose a design that requires hitting a third-party API in tests. Constrain by the category.

## When to skip the fanout entirely

Sometimes the right interface is obvious enough that running three parallel sub-agents is overkill:

- The deepening is "merge these two pass-through helpers" — there's only one shape.
- The user has already specified the interface ("I want a `Repository` with `find`/`save`/`delete`").
- The dependency category and the test strategy uniquely determine the interface shape.

In those cases, propose the obvious interface inline, name the trade-offs you considered, and move on. The fanout is for cases where the design space is genuinely open.
