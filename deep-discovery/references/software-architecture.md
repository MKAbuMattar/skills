# Software architecture pattern

Use this pattern when stress-testing a system design, service architecture, API, data model, infrastructure plan, or technical migration. Deliverable shape: revised architecture, top 3 risks, build order, honest assessment.

## Foundation (Q1-Q10)

- What is the goal, and how do we get there?
- What problem does this solve that is not already solved?
- Who are the users and what are their actual workflows?
- What are the hard constraints (budget, timeline, team size, tech stack)?
- What are the non-negotiable requirements vs nice-to-haves?
- What does success look like in 1 month? 6 months? 1 year?
- What is the simplest version that would be useful?
- What existing systems does this interact with?
- What data flows through this system?
- What are the trust boundaries?

## Mechanics (Q11-Q30)

- Component responsibilities and boundaries
- Data storage and retrieval patterns
- API contracts between components
- Authentication and authorization model
- Error handling and recovery
- Deployment and infrastructure
- Monitoring and observability
- State management
- Concurrency and race conditions
- Configuration and environment management
- Caching layers and invalidation
- Idempotency and retry semantics
- Schema evolution and backward compatibility
- Background jobs, queues, and scheduling
- Logging volume, sampling, and retention
- Secrets management and rotation
- Multi-tenancy boundaries (if applicable)
- Network topology and ingress/egress
- Cross-region or cross-cloud assumptions
- Data residency and compliance posture

## Stress testing (Q31-Q50)

- What happens when component X fails?
- What is the blast radius of a specific failure?
- How does this behave under 10x load? 100x?
- What are the single points of failure?
- What happens during partial network partitions?
- What does the worst-case latency look like?
- What happens when disk fills up?
- How does this handle clock skew?
- What happens when a dependency changes its API?
- What data can be lost and what is the recovery path?
- What happens during a thundering herd?
- What happens when the queue backlog grows past capacity?
- What happens when a poison message arrives?
- What happens during a region-level outage?
- What happens when a deploy is half-rolled-out?
- What happens when secrets rotate but a node has a stale cache?
- What happens to in-flight transactions during a graceful shutdown?
- What happens when a feature flag is toggled mid-request?
- What happens when traffic spikes faster than autoscaling can react?
- What happens when an upstream rate-limits us?

## Competitive / alternative analysis (Q51-Q65)

- What existing solutions address this problem?
- Why not use the obvious alternative?
- What would a team 10x our size build differently?
- What would a team with no budget build?
- What patterns from other domains apply here?
- What open-source tools cover part of this?
- What did we reject and why?
- What does the "boring" solution look like and why isn't that enough?
- What's the simplest off-the-shelf service that covers 80%?
- What would the platform team recommend?

## Feasibility (Q66-Q80)

- Can the team actually build this?
- What skills are missing?
- What is the riskiest technical component?
- What should be prototyped first?
- What third-party dependencies could block us?
- What is the migration path from current state?
- What is the testing strategy and what's the cost to set it up?
- What's the operational runbook for this system?
- What does on-call look like once it ships?
- What does the rollback plan look like?
- What does cold-start cost (first deploy, fresh cluster) look like?

## Refinement (Q81-Q90)

- What can be simplified?
- What is over-engineered for the current stage?
- What implicit assumptions are baked in?
- What would break if we scaled 100x?
- What operational burden does this create?
- What can be deferred to a later phase?
- What can be replaced by an existing service?
- What's the smallest set of components that still delivers the value?

## Synthesis (Q91-Q100)

- What is the revised architecture?
- What are the top 3 risks?
- What is the build order?
- What is the honest assessment?
- What is the prototyping plan for the riskiest component?
- What is the deferred-work list?
- What's the explicit "we are not solving this" list?
