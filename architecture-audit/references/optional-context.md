# Optional context: domain glossary and ADRs

Load this for step 1 of the workflow — using the project's existing documentation, if any, to inform the audit. Both pieces are *optional*: if the project has them, use them; if not, do the audit anyway.

## Why these matter

A good audit is informed by:

- **Domain language** — the project's vocabulary for what it actually does. Names like "Order", "Invoice", "Tenant", "Campaign" come from the problem domain, not the architecture.
- **Past architectural decisions** — choices the team has already made and committed to. Re-auditing decisions that were already considered and decided is noise.

The skill produces better candidates when it knows the domain (so it can name modules after concepts the team already uses) and the prior decisions (so it doesn't suggest refactors the team already rejected).

## Where these typically live

### Domain glossary

Look for files with names like:

- `CONTEXT.md`
- `GLOSSARY.md`
- `DOMAIN.md`
- `docs/glossary.md`
- A "Domain" section inside `README.md` or `CONTRIBUTING.md`

Read the first one you find. Don't search exhaustively — if the project has a glossary, it's named obviously.

### Architectural Decision Records (ADRs)

Look for directories with names like:

- `docs/adr/`
- `docs/architecture/decisions/`
- `architecture/decisions/`
- `decisions/`

ADR files are typically numbered (`0001-...md`, `0002-...md`) and follow a consistent format (Title, Context, Decision, Consequences).

If the project has ADRs, scan their titles to map the decision space. Read the ones that touch areas your audit will surface — for example, if you're about to suggest deepening the persistence layer, read any ADR about persistence first.

## How to use what you find

### Use the domain language in candidate names

If the glossary defines `Order`, talk about "the Order intake module" — not "the FooBarHandler", and not "the Order service" (the term *service* is on the avoid list).

The deliverable should sound like both the project's glossary (for what the module *is*) and this skill's vocabulary (for what shape it has).

### Don't re-litigate decided ADRs

If an ADR forbids a refactor, don't list every theoretical refactor it forbids. Only surface a contradicting candidate when the present-day friction is severe enough to warrant *reopening* the ADR. Mark it clearly:

> *Candidate 4 contradicts ADR-0007 (chose to keep the per-route validators separate). Worth reopening because: the validators have grown a 12-step ordering requirement that's been broken twice in the last quarter — the original "keep them separate" justification was about deployment risk that no longer applies.*

If the friction isn't that severe, drop the candidate. The ADR is doing its job.

## Side effects: updating the project's docs as decisions crystallize

During the grilling loop (step 5 of the workflow), discoveries happen. When they do, update the project's docs inline:

### Naming a deepened module after a concept not in the glossary

Add the concept to `CONTEXT.md` (or wherever the glossary lives). Same discipline as any glossary update — name, definition, contrast with adjacent concepts.

If the project has no glossary file at all, *create one lazily* — only when the first concept needs to land. A glossary with one good entry beats no glossary; a glossary you create speculatively is noise.

### Sharpening a fuzzy term during the conversation

If during the design walk-through the user says something like "wait, an Order isn't really X, it's more like Y" — that's a glossary update. Make it inline.

### User rejects a candidate with a load-bearing reason

Offer to record the rejection as an ADR, framed as:

> Want me to record this as an ADR so future audits don't re-suggest it?

Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing. Skip ephemeral reasons ("not worth it right now") and self-evident ones ("we'd have to rewrite half the codebase"). The good ADR-worthy rejections are:

- Decisions that depend on context the codebase doesn't reveal (regulatory, organizational, historical).
- Trade-offs the team has consciously chosen and accepts.
- Constraints that aren't visible at the call site.

## ADR format (if the project doesn't already have one)

If the project has no ADR convention, propose a minimal one when the first ADR needs to land:

```markdown
# ADR-NNNN: <Title>

**Status**: Accepted | Superseded by ADR-XXXX | Rejected
**Date**: YYYY-MM-DD

## Context

What's the situation? What's the problem? What constraints apply?

## Decision

What did we decide?

## Consequences

What follows from this decision — both what we gain and what we give up?

## Alternatives considered

What did we consider and reject? Why?
```

Keep ADRs short (1-2 pages). They're not designs — they're records of decisions and the reasoning behind them. Future-you, six months from now, should be able to read one in 90 seconds.

## When the project has neither glossary nor ADRs

Run the audit without them. Use generic architectural vocabulary (`language.md`) for the *shape* and the user's own descriptions of the codebase (file names, type names, method names) for the *what*. Don't make up domain terms — let them emerge from the user's own language.

If the audit surfaces a few solid concepts that deserve naming, mention this at the end:

> A few of the deepened modules (Order intake, Invoice ledger, Tenant registry) are concepts you might want to capture in a glossary going forward. Want me to draft a `CONTEXT.md` with the terms we landed on?

Offer; don't impose. A glossary the team won't read is a glossary that won't be maintained.
