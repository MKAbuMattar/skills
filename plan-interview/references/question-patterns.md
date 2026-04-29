# Question patterns

Load this when shaping the next interview question. Bad questions waste turns; good questions resolve a decision and unblock downstream work.

## What makes a good interview question

A good question has all of these:

1. **Single decision.** Asks about one branch of the tree, not three.
2. **Concrete.** Names the actual thing (file, component, behavior, value), not an abstraction.
3. **Has a recommended answer.** You always pair the question with what you'd choose and why.
4. **Forces a choice.** "Should we use A or B?" beats "How should we handle this?" Open-ended invites vague answers.
5. **Cites the trade-off when there is one.** If A and B both have merit, name what each gives up.

A bad question has any of these:

- Multiple sub-questions in one turn.
- Abstract phrasing ("how should we think about scaling?").
- No recommendation, leaving the user to generate from scratch.
- Re-asks something already answered, or asks something the code can answer.
- Yes/no questions where neither answer changes the plan.

## The recommended-answer pattern

Every question follows this shape:

```
**Q[n]: <single question, framed as a choice or a concrete decision>**

**My recommendation:** <one specific answer>

**Why:** <one or two sentences — what this gives, what it gives up, and what it unblocks>

<optional one-line note about the alternative or what this changes downstream>
```

### Why the recommendation is mandatory

If you ask "what should we do about authentication?" with no recommendation, the user has to generate options from scratch. That is the cognitive load you are supposed to be removing. A recommended answer:

- Anchors the conversation. The user reacts ("yes" / "no, let's do X instead") instead of generating.
- Surfaces your reasoning so the user can correct your priors before they propagate.
- Makes pushback cheap — "I'd lean A; does that fit?" is easy to disagree with.

If you genuinely don't have a recommendation, that's a signal the question is too abstract. Drill down until you have something concrete enough to recommend.

## Question shapes that work

### Choice-between-N

> **Q3: Should the API return a 404 or a 200 with `result: null` when the user is not found?**
>
> **My recommendation:** 404. **Why:** Matches REST conventions; clients can distinguish "not found" from "empty result" without reading the body. Trade-off: SDK callers need to handle the error class instead of a null check.

### Concrete-value

> **Q5: What's the maximum payload size we accept?**
>
> **My recommendation:** 1 MB. **Why:** Existing endpoints use 1 MB; matching that avoids an inconsistent gateway config. Larger blobs should go through the upload-URL flow instead.

### Trade-off-named

> **Q7: Background job queue: Redis-backed or database-backed?**
>
> **My recommendation:** Redis-backed. **Why:** Job throughput will exceed 100/sec within 6 months, which the database approach won't sustain. Trade-off: adds an operational dependency you don't currently run.

### Boundary-clarifying

> **Q9: When the webhook handler fails mid-batch, do we mark the whole batch failed or only the failed events?**
>
> **My recommendation:** Only the failed events, with per-event retry state. **Why:** Whole-batch failure means re-delivering successful events, which the spec forbids. Trade-off: per-event state is more code but matches the contract.

## Question shapes to avoid

### The kitchen-sink question

> Bad: "What's our auth model, and how do we handle errors, and where do we store secrets?"
>
> Better: ask one. The answer to the auth question often constrains the secrets question.

### The vague prompt

> Bad: "How should we think about performance?"
>
> Better: "What's the p99 latency budget — 100ms, 500ms, or whatever the load test shows?"

### The "thoughts?" question

> Bad: "Any thoughts on the database schema?"
>
> Better: "Should the `events` table have a single JSONB `payload` column or normalized columns per event type?"

### The recommendation-less question

> Bad: "What error format should the API use?"
>
> Better: "I'd lean toward `{error: {code, message}}` because it matches our existing endpoints. Does that fit, or do you want RFC 7807 problem-details?"

## Pushing back on vague answers

When the user answers vaguely, the question is not resolved. Common vague answers and how to push:

- "Probably handle it gracefully" → "Graceful how — retry once and surface the error, or fail closed and alert?"
- "Let's keep it simple" → "Simple meaning the in-process queue, or the SQS-with-one-worker setup?"
- "Whatever's easiest" → "Easiest right now is A, easiest to operate later is B. Which trade-off do you want?"
- "Both, depending on context" → "OK — what's the rule that picks A vs B? We need that before we can build either path."
- "I'm not sure, you decide" → make the call, state it as a recommendation, and ask them to confirm.

## When to drop the recommendation

Rare cases. Examples:

- The user has a strong context you don't (regulatory, organizational, historical) and your recommendation would just be guessing. State the question, name what you'd need to recommend, and let them answer.
- The decision is irreducibly a values call (team preference, brand voice, risk appetite). Present the trade-off cleanly and let them pick.

In both cases, you still ship the question with structured options, not "what do you think?"
