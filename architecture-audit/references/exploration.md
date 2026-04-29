# Exploration

Load this for step 2 of the workflow — walking the codebase looking for friction. The audit is only as good as the candidates you surface; this is where the work happens.

## Posture

Don't follow a rigid heuristic checklist that you tick through. The codebase will reveal friction in its own shape, and the friction signals interact — a shallow module is often *also* a leaky seam, and a place that's hard to test is often *also* a place where pure-function extraction sold testability without buying locality. Read with feel, then back the feel up with the deletion test.

## Use the harness's exploration mechanism

If the harness offers a sub-agent for read-only codebase walking, use it — that's the cheapest way to scan a wide area without polluting the main context. Different harnesses have different names for this (sub-agent, search agent, exploration tool); use whatever's available.

If no sub-agent mechanism is available, walk the codebase directly with file-listing, grep, and reads. Be selective — read entry points, modules with the most call sites (high coupling), and places the user already flagged.

## Friction signals to look for

### Shallow modules

The interface is nearly as complex as the implementation. Concrete tells:

- A function whose body is one line that calls another function.
- A class whose only methods are pass-through getters / setters.
- A "service" or "manager" whose every method delegates to one collaborator.
- A "helper" file whose functions each have one caller.

Apply the deletion test before proposing.

### Scattered concept

Understanding *one* concept requires bouncing between many small modules. Concrete tells:

- The user-facing concept (e.g., "Order") is implemented across `OrderHandler`, `OrderValidator`, `OrderRepository`, `OrderMapper`, `OrderService`, `OrderFactory`, `OrderEvents`, etc., with each being thin.
- Reading any one of them tells you almost nothing — you have to read all six to understand what an Order *is*.
- A diff that touches "Order" behaviour modifies five files even when the change is conceptually small.

The fix is usually to consolidate around the concept and let the deepened module own the full lifecycle.

### Leak across non-seams

Modules that share state, types, or invariants that should be private to one of them. Concrete tells:

- Module A returns an object that module B mutates.
- Two modules each have a method that takes the same internal value object as a parameter.
- The "interface" between two modules is "module B reads module A's `_internalState`".

A real seam separates concerns; a non-seam pretends to.

### Testability theater

Pure functions extracted "for testability", but the real bugs hide in how they're called. Concrete tells:

- Unit tests on the pure functions exist and pass.
- The actual user-observable bugs are in the orchestrator that calls the pure functions in the wrong order, or with the wrong inputs, or skips the validation step.
- The orchestrator has zero or near-zero test coverage because "the pure functions are unit-tested".

The pure functions had no **locality** — fixes had to land on the call site, not in the extracted function. The deepened module would own the whole flow at one seam.

### Hard-to-test interfaces

The current interface forces tests to either reach past the seam or set up extensive scaffolding to verify simple things. Concrete tells:

- Tests have to instantiate 7 collaborators to exercise one behaviour.
- Tests can't verify behaviour without injecting a private dependency.
- The "happy path" test takes 50 lines of setup.

This usually means the seam is in the wrong place — the test surface should match the behaviour boundary.

### Single-adapter "ports"

Code that introduced an interface for inversion-of-control reasons but only one thing ever implements it. Concrete tells:

- An interface called `IOrderService` with one production class implementing it.
- The interface exists "in case we need to swap implementations later".
- No test uses an alternative implementation either.

This is indirection masquerading as a seam. One-adapter = hypothetical seam.

## Anti-signals (things that look like friction but are not)

- **Long files.** Length alone isn't shallowness. A 2,000-line file with one tight interface is fine. A 50-line file that pass-through-delegates is not.
- **Repeated code.** Three similar lines beat a premature abstraction. Don't propose deepening just because two functions look alike — they may belong to different concepts.
- **Tests that take a while to run.** Slow tests aren't an architecture problem; they're a tooling problem.
- **"This file is named badly."** Renaming alone is not deepening.

## Sequencing

When you have a list of candidates, sort by:

1. **Friction-now over theoretical-improvement** — how much active pain is this causing?
2. **Reversibility** — is the refactor reversible? Reversible ones go first.
3. **Dependency category** — see `deepening.md`. In-process candidates are easiest; true-external are hardest.
4. **User priorities** — if the user said "we have a sprint to fix the order subsystem", that bias is correct.

Don't propose a 12-month refactor as candidate #1 unless the user asked for one.

## Stop conditions

Stop exploring when you have ~5-10 strong candidates that survive the deletion test. Beyond that, you're padding the list and the user will lose the signal. If you find one massive candidate that dominates the others, surface it alone and offer to do a follow-up audit after that's resolved.
