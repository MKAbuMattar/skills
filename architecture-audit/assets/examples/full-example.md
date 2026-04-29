# Full example: architecture-audit on a sample codebase

This is a worked example of an audit run end-to-end. The codebase is a typical CRUD service with the kind of organic-growth friction that triggers the skill. The example shows the explore step, the candidate list, the picked candidate's grilling, and the optional interface fanout.

---

## Setup

The user said:

> Audit my backend repo. It's grown a lot in the last year and I feel like the order intake flow is messy. There are too many files involved.

Workspace: `~/Work/orders-api`. The team has a `CONTEXT.md` defining `Order`, `Invoice`, `Tenant`, `LineItem`. Two ADRs exist (`docs/adr/`):

- ADR-0007: "Use repository pattern for persistence"
- ADR-0014: "Keep validators separate from handlers (SRP)"

---

## Step 1: Read context

Read `CONTEXT.md` and the two ADRs. Note:

- Domain vocab: `Order`, `Invoice`, `Tenant`, `LineItem`. Use these in candidate names.
- ADR-0014 might come up — flag if a candidate contradicts it.

---

## Step 2: Explore

Walk the codebase via the harness's exploration mechanism. Friction signals found:

| Area                    | Signal                                            |
| ----------------------- | ------------------------------------------------- |
| `src/handlers/orders/`  | 5 files for the Order intake flow, each shallow   |
| `src/validators/`       | Single-method classes; one caller each            |
| `src/services/`         | "Service" classes that delegate to one repo each  |
| `src/repositories/`     | Repos with `IXxxRepository` interfaces, one impl  |
| `src/mappers/`          | One-line conversions between near-identical types |
| `src/utils/retry.ts`    | Retry helper called from 3 places, each different |
| `src/queue/consumer.ts` | Re-implements parts of the order intake flow      |

---

## Step 3: Apply the deletion test

For each suspected-shallow module:

| Module                        | Delete it → ?                          | Verdict      |
| ----------------------------- | -------------------------------------- | ------------ |
| `OrderValidator`              | Validation moves into handler. No reappearance — pass-through. | Shallow |
| `OrderMapper`                 | Mapping moves into handler. No reappearance. | Shallow |
| `OrderService`                | Orchestration reappears across 4 callers (HTTP, queue, admin, migration). | Deep — keep, but rename to "intake" |
| `IOrderRepository` interface  | Only one impl (`SqlOrderRepository`). The interface is a one-adapter port. | Shallow seam |
| `RetryHelper`                 | Each caller has different retry semantics; deletion concentrates the differences (already concentrated, badly). | Mixed — drop the helper, push retry into the modules that need it differently |

---

## Step 4: Present candidates

Numbered list. Five candidates:

### Candidate 1: Order intake module

**Files / modules**: `src/handlers/orders.ts`, `src/validators/orders.ts`, `src/services/orderService.ts`, `src/mappers/orderMapper.ts`.

**Problem**: The Order intake flow is scattered across 4 thin modules. Each module is shallow. Bugs in the intake flow consistently land in the orchestration (wrong order of validate / normalize / persist), but the unit tests on the validator pass. Testability theater.

**Deletion test**: Validator and mapper vanish (pass-through). Service orchestration reappears across 4 callers, so the deep module is real — it's the "intake" module, not the "service".

**Solution sketch**: One Order intake module owning the full intake flow. Callers see one method (`intake(order)`). Repository stays separate.

**Dependency category**: Local-substitutable (relational DB via the project's ORM, with an embedded SQL test fixture).

**Benefits**: change-locality goes from 3 files to 1. Tests at the intake interface catch the orchestration bugs that today hide in the handler.

**Risks**: admin tool currently does a partial intake (skip persist). Queue consumer has its own retry. Both need to be considered in the design.

**ADR conflict**: Contradicts ADR-0014 (validators separate from handlers). Worth reopening because the SRP framing was about class-level responsibility, but the actual responsibility (intaking an Order) is the deepened module's. Today's pain is real (3 production bugs in the last quarter landed in orchestration).

---

### Candidate 2: Drop the `IOrderRepository` interface (one-adapter port)

**Files / modules**: `src/repositories/IOrderRepository.ts`, `src/repositories/SqlOrderRepository.ts`.

**Problem**: One-adapter "port". The interface exists "for testability" but no test uses an alternative — tests use the real repo against the embedded SQL fixture. Indirection without a seam.

**Deletion test**: Delete the interface. Callers refer to `SqlOrderRepository` directly. No complexity reappears because there's only one implementation.

**Solution sketch**: Delete the interface; rename `SqlOrderRepository` to `OrderRepository`. Tests continue to use the embedded SQL fixture.

**Dependency category**: Local-substitutable (no change).

**Benefits**: less indirection; one less file to navigate per Order change.

**Risks**: minor — if a non-SQL adapter is ever needed, the port can come back. One-adapter = hypothetical seam, so it's fine to drop now.

**ADR conflict**: Contradicts ADR-0007 (repository pattern). Worth reopening because the pattern was about the *separation*, not the *interface*. Keeping the repository module while dropping the interface preserves the spirit of ADR-0007.

---

### Candidate 3: Tenant context module

(Same template, abbreviated for this example.)

---

### Candidate 4: Retry policy ownership

**Problem**: `RetryHelper` is called from 3 places with subtly different semantics — each caller passes different retry config and uses the result differently. The helper isn't really shared.

**Solution sketch**: Inline retry into each calling module. Each module owns its own retry policy at its own seam. This is *un-deepening* the helper but *deepening* the modules around it.

(This is a useful pattern: sometimes the deepening move is to *remove* a fake shared abstraction.)

---

### Candidate 5: Queue consumer alignment with intake

(Skipped for example brevity.)

---

**Asked the user:** "Which of these would you like to explore?"

**User picked:** Candidate 1.

---

## Step 5: Grilling loop on Candidate 1

(Walk through using the `plan-interview` skill's pattern — one question at a time, recommendations included.)

### Q1

> **Q1: Does the deepened intake module own the persistence call, or does the caller pass in a persistence callback?**
>
> **My recommendation:** It owns persistence. The persistence is part of "intake" — calling intake means the order is intaked.
>
> **Why:** Otherwise every caller has to remember to call `persist` after `intake`, which is exactly the orchestration bug we're trying to remove.

**User:** "It owns it."

### Q2

> **Q2: The admin tool today does a 'partial intake' that skips persist. Does the deepened module support a `dryRun` option, or does the admin tool use a separate validate-only path?**
>
> **My recommendation:** Separate `validate(order)` method. **Why:** A `dryRun` flag makes the main method's behaviour conditional, which is the kind of mental load the deepening is supposed to remove. A separate `validate` method is two surfaces, but each is simple.

**User:** "Yeah, separate validate. Don't overload intake."

### Q3

> **Q3: The queue consumer has its own retry logic. After the deepening, where does retry live?**
>
> **My recommendation:** Retry stays at the queue consumer — it's a property of "consuming events from a queue", not of "intaking an order". The intake module returns idempotent success/failure; the consumer wraps with retry if needed.

**User:** "Agreed."

### Q4

> **Q4: Today there's an `OrderEvents` module that emits a `order.intaked` event. Does the deepened intake module emit that, or does the caller emit it after?**
>
> **My recommendation:** Intake emits it. Same reason as Q1 — emitting the event is part of "intake is complete".

**User:** "Yeah, intake emits."

(... continue for ~6 more questions ...)

---

## Step 6 (optional): Interface fanout

The user said the design space feels open and asked for the fanout. Frame the problem space:

> Constraints: takes a raw `OrderInput`, validates, normalizes, persists, emits `order.intaked`. Returns `Order` (the persisted shape) or fails. Must support a `validate(input)` companion for the admin tool's partial-intake. Dependency: relational DB via project ORM (local-substitutable).

Spawn 4 sub-agents in parallel:

- **Minimize the interface** — single `intake(input)` entry point, separate `validate(input)` for the admin path.
- **Maximize flexibility** — entry points for each step (`validate`, `normalize`, `persist`, `emit`) for advanced callers, plus a default `intake` that does all four.
- **Optimize for the most common caller** — `intake(input)` returns just the persisted Order, no metadata; advanced callers can inspect the events log.
- **Ports & adapters** — explicit ports for persistence and event emission, in-memory adapters for tests.

Each returns its proposal.

After comparing:

> The minimize-the-interface design (Agent 1) is the strongest. Two methods (`intake`, `validate`), no flexibility hatches, single return type. Locality: change-locality is one file; admin tool's partial-intake works via the separate `validate` method. Leverage: callers learn two methods. Trade-off: doesn't support "advanced" multi-step orchestration, but no caller today actually wants that — it was supplied "just in case".
>
> Take the persistence-port idea from Agent 4 only if a second persistence adapter (e.g., a sandbox / testing variant) becomes likely in the next 6 months. Today, the embedded SQL fixture is enough — no port needed (one-adapter trap).

---

## Step 7: Side effects

During the grilling, the term "intake" emerged as a load-bearing concept distinct from "create" / "submit". Add it to `CONTEXT.md`:

```markdown
- **Intake**: the act of accepting an Order from an external source — validates, normalizes, persists, emits `order.intaked`. Distinct from `create` (which is just persistence) and `submit` (which is the customer-facing UI action).
```

The user pushed back on Candidate 4 (retry policy) — they prefer keeping `RetryHelper` because two consumers will share semantics in the next quarter. That's a load-bearing rejection. Offer:

> Want me to record this as ADR-0021 ("Keep RetryHelper despite single-current-caller — second consumer planned Q2")? That way future audits won't re-suggest dropping it.

User: "Yes."

Draft and write `docs/adr/0021-retry-helper.md`.

---

## Outcome

Final deliverable to the user:

- 5 candidates surfaced; user picked 1.
- Candidate 1 (Order intake module) walked through with 7 grilling questions; design landed on Agent-1's minimize-the-interface shape.
- ADR-0014 marked for revisit.
- New term "Intake" added to `CONTEXT.md`.
- ADR-0021 recorded for the rejected Candidate 4.
- The user has a refactor-ready plan: shape, dependencies, test strategy, files to delete, files to add.

The audit is done. The user can now implement Candidate 1 (or schedule it) and revisit Candidates 2-5 in a future session.

---

## Notes on what made the audit work

- **Read context first.** Knowing `CONTEXT.md` and the two ADRs meant Candidate 1 could name "Intake" in domain language and could correctly flag ADR-0014 as worth reopening.
- **Deletion test for every suspect.** Saved Candidate 5 from being proposed at all (it didn't survive the test).
- **Dependency category in every candidate.** Determined that Candidate 1 didn't need a port (local-substitutable + one production target = no port).
- **One question at a time during grilling.** Q2 reshaped Q3 (separate validate path eliminated a downstream complication).
- **Minimize-the-interface won.** Consistent with the "Design It Twice" heuristic — your first idea is rarely the best, and the minimize constraint usually produces the strongest design when it's feasible.
- **Side effects landed inline.** New domain term went into the glossary as it crystallized; ADR-0021 was offered when the rejection had a load-bearing reason.
- **The audit ended.** Five candidates is enough for one session. The agent didn't try to find a sixth.
