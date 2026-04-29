---
name: architecture-audit
description: Audit a codebase for shallow modules — places where the interface is nearly as complex as the implementation, where understanding one concept requires bouncing between many small files, where pure functions were extracted just for testability but the real bugs hide in how they're called, or where tightly-coupled modules leak across their seams. Surface them as deepening opportunities (refactors that turn shallow modules into deep ones), apply the deletion test, and walk the design tree with the user. Supports parallel sub-agent fanout for 'Design It Twice'-style interface exploration. Use whenever the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, identify shallow abstractions, make a codebase more testable, or hits you with phrases like 'where can we refactor', 'find architecture friction', 'this code feels over-abstracted', 'help me deepen modules', or 'audit my codebase'.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Architecture audit

Surface architectural friction in a codebase and propose **deepening opportunities** — refactors that turn shallow modules into deep ones by relocating their seams. The aim is testability, locality, and AI/human navigability.

## When to use

- The user asked to audit a codebase, find refactor opportunities, consolidate tightly-coupled modules, or identify shallow abstractions.
- A codebase has grown organically and now feels harder to navigate or change than it should.
- Pure functions were extracted for testability, but bugs still hide in *how* they're called — the unit tests pass and the real behaviour breaks.
- A test suite has 80% coverage but tells you nothing about whether the real flow works.
- The user wants to know where modules leak across seams that aren't real seams.

Skip this skill for: pure code review of a single PR (use `qa` or a code-review pattern), greenfield architecture design (use `deep-discovery` or `information-architecture`), or formatting/linting (use `pre-commit-setup`).

## The vocabulary is the point

Use the terms from `references/language.md` exactly. Do not substitute "component", "service", "API", "boundary". Consistent vocabulary is what makes audits comparable across modules and across sessions.

The seven core terms: **Module**, **Interface**, **Implementation**, **Depth**, **Seam**, **Adapter**, **Leverage**, **Locality**. The three core principles: the **deletion test**, **the interface is the test surface**, and **one adapter = hypothetical seam, two = real**.

## Workflow

1. **Read the optional context.** If the project has a domain glossary (commonly `CONTEXT.md`, `GLOSSARY.md`, or similar) and/or architectural decision records (`docs/adr/`, `architecture/decisions/`), read them first. These name the good seams and record decisions that the audit should not re-litigate. Load `references/optional-context.md` for the heuristic. If no such files exist, continue without them — do not stop the audit.
2. **Explore the codebase.** Walk it with whatever exploration mechanism the harness offers (sub-agent / search tools / direct reads). Don't follow a rigid checklist — feel for friction. Load `references/exploration.md` for the friction signals to look for.
3. **Apply the deletion test.** For every candidate shallow module, imagine deleting it. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep. Load `references/language.md` for the full principle.
4. **Present a numbered list of candidates.** Each candidate ships with: which files / modules are involved, what friction the current architecture is causing, a plain-English description of what would change, and the benefits in terms of locality, leverage, and how tests would improve. Use the project's domain vocabulary for the *what* and `language.md` vocabulary for the *architecture shape*. See `assets/templates/deepening-candidate.md` for the format. **Do NOT propose interfaces yet.** Ask: "Which of these would you like to explore?"
5. **Walk the design tree on the picked candidate.** Drop into an interactive grilling conversation. Constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive. (`plan-interview` skill is the natural complement here.) Load `references/deepening.md` for dependency categories and testing strategy.
6. **Optionally: design the interface twice (or three or four times).** When the user wants to compare alternatives for the deepened module, fan out to parallel sub-agents — each producing a radically different interface. Load `references/interface-design.md`.
7. **Update the project's documentation as decisions crystallize.** If the deepened module is named after a concept missing from the domain glossary, add it. If the user rejects a candidate with a load-bearing reason, offer to record an ADR so future audits don't re-suggest it. See `references/optional-context.md`.

## Available resources

- `references/language.md` — the seven-term vocabulary (Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality), the three core principles (deletion test, interface-as-test-surface, one-adapter-rule), relationships between the terms, and the framings this skill rejects.
- `references/exploration.md` — friction signals to look for when walking a codebase: shallow modules, scattered concepts, leak across seams, untestable interfaces, pure functions extracted-for-testability with no locality.
- `references/deepening.md` — four dependency categories (in-process, local-substitutable, remote-but-owned, true-external), how each gets tested across the seam, seam discipline, and the "replace, don't layer" testing strategy.
- `references/interface-design.md` — the parallel sub-agent fanout pattern for "Design It Twice" interface exploration: how to frame the problem space, how to brief each sub-agent, how to compare and synthesize.
- `references/optional-context.md` — how to use existing domain glossaries (`CONTEXT.md`, etc.) and ADRs if they exist, when to add new terms during a grilling session, when to offer to record an ADR after a rejection.
- `assets/templates/deepening-candidate.md` — copy-paste format for each candidate in the numbered list (Files / Problem / Solution / Benefits / Tests).
- `assets/examples/full-example.md` — full worked audit on a sample codebase: explore → present candidates → grilling → interface fanout → resolved refactor.

## Top gotchas (always inline — do not skip)

- **Vocabulary discipline matters.** Don't drift into "component", "service", "API", "boundary" — those are vague-by-default and invite re-litigation. Use Module / Interface / Seam / Adapter consistently.
- **The deletion test is the load-bearing check.** "This module looks shallow" is a hunch. "If I deleted this module, complexity would reappear at the call sites" is the test. Run the test before proposing anything.
- **Interface is more than the type signature.** It includes invariants, ordering constraints, error modes, required configuration, performance characteristics. A "small" interface that hides a 12-step ordering requirement is not actually small.
- **One adapter = hypothetical seam.** If your proposal introduces a port and only one thing implements it, you've added indirection, not a seam. Real seams have at least two adapters (typically production + test).
- **Don't expose internal seams through the external interface.** A deep module can have internal seams (private to its implementation, used by its own tests). Tests are not callers — internal-seam-for-tests is fine, internal-seam-leaking-into-the-public-interface is not.
- **The interface is the test surface.** If you want to test *past* the interface, the module is probably the wrong shape. Don't propose deepening that requires reaching past the seam to verify behaviour.
- **Replace tests, don't layer them.** When deepening, the old unit tests on the shallow modules become waste. Delete them. Write new tests at the deepened interface. Otherwise you have layers of redundant tests that all change when implementation changes.
- **Don't propose interfaces in step 4.** The candidate list is a *menu*, not a design. Interface design happens after the user picks. Proposing interfaces too early collapses the menu into one branch.
- **Domain vocabulary for the *what*; architecture vocabulary for the *shape*.** "The Order intake module" — not "FooBarHandler" (no domain), and not "the Order service" (the term `service` is on the avoid list). The deliverable should sound like both the project's glossary and this skill's vocabulary.
- **ADR conflicts: only surface when the friction is real.** If a candidate contradicts an existing ADR, only mention it when the current pain is real enough to warrant reopening the decision. Don't enumerate every theoretical refactor an ADR forbids.
- **Pure-function extraction is often an anti-pattern in disguise.** "We extracted the calculation into a pure function so it's testable" sounds good, but if the bugs live in how callers compose the calculations, the unit tests on the pure function don't catch them. Look for this pattern explicitly during exploration.
- **Don't re-suggest something the user already rejected.** If a previous session rejected a candidate, the rejection should be in an ADR. Read those before exploring.

## What you DO

1. Read the project's domain glossary and ADRs first if they exist; carry that vocabulary into the audit.
2. Explore organically — feel for friction, don't march a checklist.
3. Apply the deletion test to every shallow-looking module before proposing.
4. Use `language.md` vocabulary exactly. Use the project's domain vocabulary for *what* the module is.
5. Present a numbered list of candidates with Files / Problem / Solution / Benefits / Tests.
6. Wait for the user to pick before proposing any interface.
7. Walk the picked candidate's design tree interactively, one decision at a time.
8. Use parallel sub-agent fanout for interface design when comparison would help.
9. Recommend "replace, don't layer" testing — delete old shallow-module tests when the deepened tests exist.
10. Update the project's domain glossary inline when new concepts emerge during grilling.
11. Offer to record an ADR when the user rejects a candidate with a load-bearing reason.

## What you do NOT do

- Do not use "component", "service", "API", "boundary" when you mean Module, Interface, Seam.
- Do not propose interfaces in the candidate list — wait for the user to pick.
- Do not propose a port-and-adapter when only one adapter exists.
- Do not propose tests that reach past the interface.
- Do not layer new tests on top of old shallow-module tests — replace them.
- Do not list every refactor a passing ADR would forbid; only surface when the pain warrants reopening.
- Do not march the audit through the codebase in path order; sequence by friction signal.
- Do not invent depth-as-line-count metrics ("long implementation behind short signature" is the popular but wrong framing — use depth-as-leverage instead).
- Do not skip the deletion test because the module "looks" shallow. Run it.
- Do not write code during the audit — the deliverable is a refactor proposal, not a partial implementation.
- Do not invoke this skill for greenfield work — it audits existing code; for new work use `deep-discovery` or `information-architecture`.
