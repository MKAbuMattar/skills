# Decision tree

Load this for tracking branches and dependencies. The interview is only as good as the tree behind it — without a tree you'll re-ask things, miss branches, and march through the plan in the wrong order.

## What the tree is

A simple in-memory model of:

1. **Open decisions** — questions that need to be answered.
2. **Resolved decisions** — answered questions, with the chosen answer.
3. **Dependencies** — which open decisions are blocked by which other decisions.
4. **Premises** — facts the user already stated; you should not re-derive these.

You don't need a fancy data structure. A flat list with annotations is enough:

```
RESOLVED:
- D1: auth model → bearer token in Authorization header (user, Q2)
- D2: token TTL → 15 min access + 7d refresh (user, Q3)

OPEN (no blockers):
- D5: rate limit policy
- D6: error format

OPEN (blocked):
- D7: rate limit storage  [blocked by: D5]
- D8: refresh-token storage  [blocked by: D2 — answered, now unblocked]

PREMISES (do not re-ask):
- Relational DB is the primary store (user said so in plan)
- Service runs on the container platform (from artifact)
```

## How to build the tree

After reading the artifact:

1. **List every concrete decision the artifact already commits to.** These are premises. Mark them resolved-by-artifact.
2. **List every concrete decision the artifact mentions but does not resolve.** These are open.
3. **List every decision the artifact does _not_ mention but should.** These are also open. (Common: error semantics, rollout strategy, observability, rollback path, auth boundaries.)
4. **Mark dependencies.** "Where do we store rate-limit counters?" depends on "Do we even rate-limit?" — resolve the parent first.
5. **Bucket by branch.** Group decisions that belong to the same subsystem (auth, persistence, deploy, error model). It's easier to keep one branch open at a time than to thrash.

## Choosing the next question

Pick the open decision that:

1. Has no unresolved blockers (you can actually answer it now).
2. Unblocks the most downstream decisions when answered.
3. Is most likely to reshape the tree (high-leverage architecture choices first; cosmetic choices last).

Tie-breakers:

- Decisions that, if wrong, are most expensive to reverse.
- Decisions that gate code the user is about to write.

Avoid: marching through the artifact in document order. The artifact's order is rarely the dependency order.

## Updating the tree after each answer

After every user answer:

1. **Move the question from OPEN to RESOLVED.** Note the chosen answer and the question number.
2. **Unblock dependent decisions.** Anything blocked by this one is now eligible.
3. **Kill moot questions.** Some open decisions become irrelevant — the user picked an upstream approach that closes a downstream branch entirely. Mark them KILLED with a note.
4. **Add new open decisions if the answer revealed them.** New branches are normal. Add them to OPEN with their blockers.
5. **Re-prioritize.** The next-highest-value question may have changed.

### Example of a tree update

Before Q4:

```
OPEN:
- D5: rate limit policy
- D6: rate limit storage  [blocked by D5]
- D7: rate limit error response shape  [blocked by D5]
```

User answers Q4 ("rate limit policy") with "no rate limiting in v1". Update:

```
RESOLVED:
- D5: rate limit policy → none in v1 (user, Q4)

KILLED (made moot by D5):
- D6: rate limit storage
- D7: rate limit error response shape

OPEN:
(continue with the next branch)
```

## When the tree gets too big

If you have more than ~15 open decisions, you are interviewing a plan that's too vague. Two options:

1. **Ask the user to pick a slice.** "There are a lot of open branches. Want to fully resolve auth first, then come back for persistence?"
2. **Surface the size.** "I count 22 open decisions. That's a lot for one session. Should we cut scope, or split into separate interviews?"

Don't silently grind through 50 questions in one session. The user will lose context.

## When the tree is empty

Stop. Summarize:

```
**Plan resolved.** Open decisions: 0.

Resolved decisions:
- D1: auth model → ...
- D2: token TTL → ...
...

Premises (taken as given):
- ...

Want me to draft the implementation plan now, or do you want to think on this overnight first?
```

Then exit the interview loop. Don't add a "one more thing" question after the summary — that's how interviews drag.

## When the user calls stop

If the user says "OK that's enough" / "let's just build" / "I get it":

1. Stop asking immediately.
2. Summarize **what's resolved**.
3. Flag **what's still open** (don't pretend it's done).
4. Exit.

Do not sneak in "but before we build, just one more — ".
