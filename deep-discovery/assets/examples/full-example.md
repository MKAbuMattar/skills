# Full example: deep-discovery on a sample proposal

This is a worked example of a deep-discovery run. The topic is a real-shaped proposal (a small in-house tooling idea), the run uses **evaluation mode** with the **business/product pattern**, and the final deliverable shows what the user should actually receive — synthesis only, not the raw 100 Q&A.

For brevity, this example shows the **synthesis output** the run should produce, plus a few representative questions from each phase to demonstrate the build-on-the-last-answer pattern. A real run runs all 100 sequentially.

---

## Setup

```
Topic: Internal "deploy-bot" — a chat-platform bot that lets engineers
       trigger production deploys from a slash command (/deploy <service>).
       The proposal is to build it in-house in ~2 weeks rather than buy a
       vendor deploy tool or use the CI provider's environment-promotion
       feature.
Mode: evaluation
Domain pattern: business/product (the deliverable is a build-vs-buy
       recommendation with a roadmap, not a system design — though
       the architecture pattern would also be a fair pick)
Starting point: 1-page proposal arguing "we should build this in-house
       in ~2 weeks, then expand to other internal tools".
```

---

## Selected questions across phases

The full run is 100 sequential questions. A few representative ones:

### Foundation (Q1-Q10)

- **Q1: What is the goal, and how do we get there?** → Reduce time-to-deploy for engineers; get there by replacing today's manual cluster-CLI flow with a chat-triggered pipeline.
- **Q4: Who is the customer and what pain are we solving?** → ~25 backend engineers. Pain is that deploys are gated on a single SRE who has to be paged.
- **Q7: What is the unfair advantage of building in-house?** → "We know our infra better than a vendor would." (Probe at Q50.)

### Mechanics (Q11-Q30)

- **Q14: What's the cost structure (CAC, ops, support)?** → CAC ~0; ops cost is on-call burden for whoever owns the bot; support cost is "broken bot blocks every deploy".
- **Q22: What does onboarding look like for a new engineer?** → Today: shadow the SRE for a week. With deploy-bot: read a README and run `/deploy stage <service>`. Big improvement _if_ the bot is reliable.

### Stress testing (Q31-Q50)

- **Q34: What if the chat platform is down during a sev-1?** → Currently, the SRE can deploy from a laptop. With the bot as the only path, a chat outage blocks emergency rollback. **Critical flaw — spend Q35-Q39 on this.**
- **Q38: What's the fallback path?** → Must keep the manual cluster-CLI runbook alive. So the bot reduces friction but doesn't eliminate the SRE-page on-call structure.
- **Q47: What if the bot has a bug that auto-deploys broken code to prod?** → Blast radius is "every backend service." Need rollback automation and rate-limiting from day one, not "phase 2".

### Assumption revisit (around Q50)

- **Q50: Re-test Q7 — is the "we know our infra better" advantage real?** → Honestly, no. Off-the-shelf vendor tools handle the same primitives. The real advantage is "chat-native UX" and "no vendor procurement cycle". That's narrower than the original claim.

### Competitive (Q51-Q65)

- **Q53: What does the off-the-shelf vendor cost in time vs money?** → Free tier is feasible; ~3-4 weeks to configure for our setup. Vs ~2 weeks to build deploy-bot.
- **Q57: What's the "do nothing" alternative?** → Keep manual deploys, hire one more SRE. Cost: ~$150k/yr fully loaded vs ~3 engineer-weeks of build cost.
- **Q60: What would a well-funded competitor ship instead?** → They'd buy the off-the-shelf tool and add a thin chat wrapper. They wouldn't build the whole thing.

### Feasibility (Q66-Q80)

- **Q68: Path to first 10 users?** → Day 1 — the team that builds it. Path to 25 users (whole backend org) — depends on stage gate, prod gate, rollback story.
- **Q73: What's the burn rate?** → Build cost ~3 engineer-weeks (~$30k loaded). Ongoing ~10% of one engineer's time for maintenance.

### Refinement (Q81-Q90)

- **Q83: What features can be cut from the MVP?** → "Multi-cluster routing", "auto-rollback on alert spike", "dashboard view" — all phase 2.
- **Q88: What's the smallest version that proves the hypothesis?** → `/deploy stage <service>` only (no prod), no rollback automation, manual kill switch via `/deploy stop`. Two engineers, one week.

### Synthesis (Q91-Q100)

- **Q91-Q100:** Produce the deliverable below.

---

## Deliverable (what the user actually sees)

**Topic:** in-house chat-triggered deploy-bot vs buy/keep-manual.
**Mode:** evaluation.
**Domain pattern:** business/product.
**Questions asked:** 100.

### Top 10 critical issues found

1. **Chat platform as single point of failure.** If chat is down during a sev-1, deploys are blocked. Manual fallback runbook must stay alive — this means deploy-bot reduces SRE friction but does **not** eliminate the SRE on-call page.
2. **Auto-deploy blast radius.** A bot bug that ships broken code to all backend services is catastrophic. Rate limiting, prod gating, and rollback automation must be in MVP, not phase 2.
3. **"We know our infra better" advantage doesn't hold up.** The real edge is "chat-native UX" and "no vendor procurement cycle". Narrower than the proposal claimed.
4. **MVP scope is overstated.** "2 weeks" assumes happy path. Realistic MVP with rollback + prod gating is ~4-5 engineer-weeks, not 2.
5. **Operational ownership is unclear.** No name listed for "owns the bot's on-call". This breaks within 3 months.
6. **Audit trail is missing from the proposal.** Who deployed what, when, with what diff — needed for compliance and post-incident review.
7. **Authn/authz model is undefined.** Who can run `/deploy prod`? Chat handle ≠ SSO ≠ cluster RBAC. This is a footgun.
8. **No plan for parallel deploys.** Two engineers running `/deploy api` at once → race condition on rollout.
9. **No metric for success defined.** "Reduce time-to-deploy" — by how much? From X minutes to Y minutes? This needs to be measurable.
10. **Phase 2 is hand-wavy.** "Expand to other internal tools" was used to justify the build cost. No concrete phase 2 exists. The build cost should be justified by phase 1 alone, or phase 2 needs scoping.

### Top 10 strengths

1. **Chat-native UX is a real win.** Engineers already live in chat; this removes context switching.
2. **No vendor procurement cycle.** Real schedule advantage over the off-the-shelf tool (3-4 weeks of config + procurement).
3. **Reduces SRE-page rate.** Even with manual fallback, most non-emergency deploys move out of the SRE queue.
4. **Onboarding improvement is real.** "Read a README" beats "shadow the SRE for a week".
5. **Cost is small.** ~$30k build + ~10% engineer maintenance is cheap vs hiring another SRE.
6. **Clear MVP path exists.** `/deploy stage <service>` only, no prod, no rollback automation. Provable in 1 week with 2 engineers.
7. **No vendor lock-in.** Owning the code means we can change deploy primitives without vendor approval.
8. **Composability with existing infra.** Plays well with current cluster-CLI flow as fallback.
9. **Team buy-in is high.** Engineers want this; adoption risk is low.
10. **Path to a useful audit trail.** Chat log + bot log + git SHA is a reasonable forensic record once we wire it.

### Recommended changes

1. **Re-scope MVP to ~4-5 weeks**, with prod gating, rate limiting, and manual rollback in scope from day one. The "2 weeks" target was hiding deferred risk.
2. **Define a named owner** for the bot's on-call. If no one will own it, do not build it.
3. **Add explicit authn/authz model**: SSO → bot identity, RBAC for `/deploy prod`, audit log per command.
4. **Add a parallel-deploy lock** (per service) before MVP ships.
5. **Define the success metric**: target time-to-deploy reduction (e.g., from 30 min to 5 min) and measure for 8 weeks post-launch.
6. **Drop the "phase 2 expansion" rationale.** Justify the build on phase 1 alone — or scope phase 2 concretely with a separate proposal.
7. **Keep the manual cluster-CLI runbook live and tested quarterly.** The bot reduces friction, not the SRE on-call structure.

### Revised proposal

Build deploy-bot, but as a 4-5 week MVP scoped to:

- `/deploy stage <service>` and `/deploy prod <service>` (with prod requiring 2-person approval).
- Per-service deploy lock to prevent races.
- SSO-bound user identity with RBAC for prod access.
- Audit log per command (chat user ID + git SHA + timestamp + service).
- Manual `/deploy rollback <service>` (no auto-rollback in MVP).
- Manual fallback runbook stays alive; SRE on-call structure is not changed.

Phase 2 (separate proposal): auto-rollback on alert spike, multi-cluster routing, dashboard view. Justify on its own merits.

### Honest bottom line

This is a useful build, but the original proposal underscoped it by ~2x and oversold the "in-house knowledge" angle. The real wins are chat-native UX, faster onboarding, and freeing the SRE from low-stakes deploys — those are worth ~4-5 weeks of build. The risk is treating the bot as a _replacement_ for the SRE on-call structure (it isn't) or shipping without prod gating (which would be catastrophic). With the recommended changes, build it. Without them, don't.

---

## Notes on running this in practice

- A real run goes through all 100 questions. The above shows ~12 representative ones.
- The synthesis (Q91-Q100) is what the user sees. The raw Q&A stays internal unless asked for.
- Around Q50, the assumption revisit is what flipped the proposal's framing — that's exactly what the pattern is designed to do.
- The "do nothing" alternative (hire one more SRE) at Q57 is a routinely-skipped check that often kills weak build proposals. Always ask it.
