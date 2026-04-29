# Full example: plan-interview on a sample plan

This is a worked example of the interview pattern. The user pasted a brief plan; the agent reads the artifact, builds a decision tree, reads the codebase to resolve a few branches without asking, then walks the open decisions one question at a time. Each question ships with a recommended answer.

---

## What the user pasted

> I want to add a `/webhooks/payments` endpoint that ingests webhook events from our payments provider, verifies signatures, and persists each event for downstream processing. Use the existing API service and our relational DB. Should be ready next sprint.

## Agent's first move (no question yet — read and plan)

> I read the plan. Before I start asking, here's what I found by reading the codebase:
>
> - **API service:** web service on the project's HTTP framework. Routes are in `src/routes/`. There's an existing webhook precedent at `src/routes/external-webhooks.ts` that uses raw-body middleware and HMAC verification.
> - **Persistence:** the relational DB via the project's ORM. The current migration pattern is one migration per feature in `db/migrations/`.
> - **Error format:** `{error: {code, message}}` across v2 routes (the new endpoint will be v2).
> - **Logging:** structured logger with a request-scoped child logger; unhandled errors auto-logged by the framework's error middleware.
> - **No existing webhook idempotency table** — we'll need to design one.
>
> **Decision tree (open branches):**
>
> 1. Endpoint shape: path, method, content-type handling.
> 2. Signature verification approach.
> 3. Idempotency (event de-dup).
> 4. Storage schema for events.
> 5. Processing model (sync vs async).
> 6. Failure semantics (when verification fails / DB write fails).
> 7. Replay/retry support.
> 8. Observability (metrics, alerts).
> 9. Rollout (feature flag? staging-only first?).
>
> Some of these have natural blockers — (4) depends on (5), (6) depends on (5). Starting with (5).

---

## Q1

> **Q1: Processing model — sync (verify + persist + run handlers in the request) or async (verify + persist, then enqueue handlers for a background worker)?**
>
> **My recommendation:** Async. **Why:** The payments provider expects a 2xx within ~10s; sync handlers tied to downstream code can blow that budget under load. Async also lets us retry handlers without asking the provider to re-deliver. Trade-off: requires a job queue.

**User answer:** "Async, but use the existing in-process job runner — we don't have a queue yet and I don't want to add one this sprint."

**Tree update:** D5 resolved → async via in-process runner. D4 (storage schema) and D6 (failure semantics) unblocked. New premise: "in-process job runner is the queue."

---

## Q2

> **Q2: Storage schema — single `webhook_events` table with `provider`, `event_id`, `event_type`, `payload jsonb`, `received_at`, `processed_at`, `processing_status`?**
>
> **My recommendation:** Yes, this shape. Add a unique constraint on `(provider, event_id)` to enforce idempotency at the DB level. **Why:** Single-table keeps it simple now; the unique constraint is the cheapest correct way to dedupe — even if the application layer is buggy, the DB won't double-write. We can split per-provider later if volume demands.

**User answer:** "Yes, and add an index on `(processing_status, received_at)` so the worker can pick up pending events efficiently."

**Tree update:** D4 resolved with the additional index. D3 (idempotency) is now resolved-by-implication — the unique constraint handles it. Mark D3 KILLED-via-D4.

---

## Q3

> **Q3: When signature verification fails, do we (a) return 400 and not persist, or (b) persist with `processing_status='invalid_signature'` and return 400?**
>
> **My recommendation:** (a) — 400, no persist. **Why:** Persisting invalid events fills the table with attacker-controlled junk and gives no operational benefit (we can't process them). Trade-off: we lose visibility into how often signature failures happen, which we'd want to track via a metric instead.

**User answer:** "(a). Add a `webhook_signature_failures_total` counter labeled by provider in the metrics system."

**Tree update:** D6a resolved. New open decision D10: metrics labels and naming convention. Check codebase first.

---

## Agent reads the code instead of asking

> I checked `src/metrics.ts` — we use the project's metrics client with a `webhook_*` prefix already (one counter exists for the existing webhook handler). Naming convention is snake_case, labels use camelCase keys. I'll follow that.
>
> D10 resolved-by-code. Continuing.

---

## Q4

> **Q4: Failure semantics for the DB write — if the database is down when an event arrives, do we (a) return 500 and let the provider retry, or (b) buffer to disk and ack with 200?**
>
> **My recommendation:** (a). **Why:** The provider's retry schedule (typically a multi-day exponential backoff) covers transient outages; disk buffering adds complexity and a new failure mode (disk full) for a problem that already has a clean answer. Trade-off: a long DB outage means we tell the provider to keep trying.

**User answer:** "(a)."

**Tree update:** D6b resolved.

---

## Q5

> **Q5: Replay support — admin endpoint to re-enqueue an event by id, or just a SQL update to set `processing_status='pending'` when needed?**
>
> **My recommendation:** SQL update for now, no admin endpoint. **Why:** YAGNI for v1; admin endpoints are easy to add later when we know the actual operational shape. Trade-off: requires DB access for replays, which is fine with current ops.

**User answer:** "SQL for now. Document the query in the runbook."

**Tree update:** D7 resolved with a note to write the runbook entry.

---

## Q6

> **Q6: Rollout — behind a feature flag, or ship to all environments?**
>
> **My recommendation:** Ship straight to staging, then prod after a 24h soak. No feature flag. **Why:** This is a new endpoint with no existing caller; flagging it adds operational overhead with no risk reduction. Trade-off: any bug shows up in prod after the soak window.

**User answer:** "Agreed."

**Tree update:** D9 resolved.

---

## Q7

> **Q7: Observability beyond the signature-failure counter — what else do we want?**
>
> **My recommendation:**
>
> - `webhook_events_received_total{provider, event_type}` counter
> - `webhook_event_processing_duration_seconds{provider, event_type, outcome}` histogram (outcome: success | failed)
> - One alert: "signature failure rate > 1% over 5 min"
>
> **Why:** Counters give baseline volume, histogram catches slow handlers, the alert catches misconfigured / stolen signing secrets quickly. Trade-off: three new metrics, but they all share existing infra.

**User answer:** "Yes, and add an alert for processing-failure rate > 5% too."

**Tree update:** D8 resolved with the additional alert.

---

## Tree state

```
RESOLVED:
- D1: endpoint shape → POST /webhooks/payments, raw body, application/json
       (resolved by code conventions, not asked)
- D2: signature verification → provider SDK + PAYMENTS_WEBHOOK_SECRET env var
       (resolved by code conventions, not asked)
- D3: idempotency → unique constraint on (provider, event_id) (Q2 implication)
- D4: storage schema → webhook_events table with the shape in Q2 + the index
- D5: processing model → async via in-process job runner (Q1)
- D6a: signature failure → 400, no persist (Q3)
- D6b: DB write failure → 500, let the provider retry (Q4)
- D7: replay → SQL update + runbook entry (Q5)
- D8: observability → 3 metrics + 2 alerts (Q3 + Q7)
- D9: rollout → no flag, staging then prod after 24h soak (Q6)
- D10: metrics naming → existing webhook_* convention (resolved by code)

PREMISES:
- HTTP service on the project framework, relational DB via the project ORM, structured logger, project metrics client.
- v2 error format: {error: {code, message}}.
- Provider expects 2xx within ~10s.
- In-process job runner is the queue (no new dependency this sprint).

OPEN: 0
```

---

## Final summary

> **Plan resolved.** Open decisions: 0.
>
> Resolved decisions:
>
> - Endpoint: `POST /webhooks/payments`, raw body
> - Signature: provider SDK + `PAYMENTS_WEBHOOK_SECRET`
> - Idempotency: DB unique constraint on `(provider, event_id)`
> - Schema: `webhook_events` (provider, event_id, event_type, payload jsonb, received_at, processed_at, processing_status) + index on `(processing_status, received_at)`
> - Processing: async via in-process job runner
> - Signature failure: 400, no persist, increment `webhook_signature_failures_total`
> - DB failure: 500, let the provider retry
> - Replay: SQL update; runbook entry to be written
> - Observability: received counter, duration histogram, alerts on signature-failure-rate > 1% and processing-failure-rate > 5% (both 5-min windows)
> - Rollout: no flag, staging → 24h soak → prod
>
> Premises (already given):
>
> - Existing API service, relational DB via the project ORM, structured logger, project metrics client.
>
> Want me to draft the implementation plan and migration now, or sit on this overnight first?

---

## Notes on what made the interview work

- **Read first.** D1, D2, D10 were resolved without asking — they were code conventions already in the repo.
- **Dependency order.** Q1 (processing model) was first because everything downstream depended on async vs sync.
- **Recommendations every time.** The user mostly said "yes" or "yes, plus X". That's the sign the recommendations were calibrated; the user's job was to confirm or correct, not generate.
- **No multi-question dumps.** Even when D6a and D6b were tightly related, they got separate turns.
- **The tree shrunk fast.** Q1's answer killed D3 (idempotency was free once the constraint was in place). That's the kind of leverage you get from sequencing by dependency.
- **The interview ended.** The agent didn't sneak in "one more thing" after the summary.
