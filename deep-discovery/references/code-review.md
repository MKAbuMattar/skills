# Code review pattern

Use this pattern when pressure-testing a proposed patch, pull request, branch, or implementation before accepting it. Keep the review grounded in observable behavior and concrete file-level evidence. Deliverable shape: verdict (approve / approve-with-nits / request-changes / block), top blocking findings with file references, top non-blocking improvements, missing tests, honest risk assessment.

## Foundation (Q1-Q10)

- What is the goal, and how do we get there?
- What behavior is supposed to change, and what must stay unchanged?
- What files, modules, APIs, schemas, or contracts are touched?
- What user workflows or operational workflows could be affected?
- What requirements, issue text, design notes, or review criteria apply?
- What is the riskiest part of the change?
- What assumptions does the implementation make about inputs, state, timing, or environment?
- What tests or manual verification are claimed?
- What important paths are not covered by the diff?
- What would a correct reviewer need to prove before approving?

## Mechanics (Q11-Q30)

- Control flow through changed code paths
- Data shape, validation, and normalization
- State mutations and lifecycle boundaries
- Error handling and fallback behavior
- Async, concurrency, cancellation, and race conditions
- Resource cleanup, file handles, sockets, timers, and subscriptions
- API compatibility, serialization, migrations, and versioning
- Authentication, authorization, secrets, and trust boundaries
- Configuration, environment variables, feature flags, and defaults
- Logging, metrics, tracing, and debuggability
- Backward compatibility for existing clients / consumers
- Database migration order and reversibility
- Index changes and lock implications
- Dependency version bumps and transitive impact
- Changes to public API surface
- Changes to error contracts (status codes, error shapes)
- Changes to observability (alerting, dashboards, SLOs)
- Code path that runs first vs the code path that runs in production
- Default-value changes that silently affect existing users
- Removed code that may have had implicit consumers

## Stress testing (Q31-Q50)

- What happens when inputs are empty, malformed, huge, duplicated, or reordered?
- What happens when dependencies fail, slow down, or return partial data?
- What breaks under repeated calls, retries, cancellation, or concurrent execution?
- What behavior changes for existing users who do not use the new path?
- What is the blast radius of the most likely regression?
- What security or privacy boundary could be crossed accidentally?
- What data could be lost, corrupted, leaked, or silently ignored?
- What performance path worsens at 10x or 100x scale?
- What cleanup, rollback, or migration failure would leave the system inconsistent?
- What test would catch the worst plausible defect?
- What failure mode is silent (no error, no log, just wrong)?
- What user is impacted in the worst-case rollout?
- What's the fastest path to detect a regression in production?

## Alternatives / prior art (Q51-Q65)

- Is this patch using the established local pattern for this codebase?
- Is there a simpler existing helper, abstraction, or dependency already available?
- Did the change duplicate logic that should stay centralized?
- Did it introduce an abstraction before repeated complexity justified it?
- Is the old behavior intentionally replaced or accidentally bypassed?
- Are there similar bugs or fixes elsewhere that should inform this review?
- Would a smaller patch satisfy the requirement with lower risk?
- Are naming, boundaries, and ownership consistent with neighboring code?
- What did prior PRs in this area try and abandon?
- Is there existing test infrastructure that should be reused?

## Feasibility (Q66-Q80)

- Can the reviewer run or reason through the claimed tests?
- Are the tests meaningful, deterministic, and tied to user-visible behavior?
- Are edge cases and failure paths covered, not just happy paths?
- Is there enough evidence to approve without relying on author confidence?
- What verification command should be run before merge?
- What rollout, feature-flag, migration, or rollback step is missing?
- What documentation or release note is required?
- Does this change create ongoing maintenance or on-call burden?
- Is the diff size justified by the change, or is there scope creep?
- Are there refactors mixed in that should be split out?

## Refinement (Q81-Q90)

- What code can be simplified without losing behavior?
- Which comments, names, or boundaries would make future review easier?
- What test would give the most confidence per line added?
- What finding is important enough to block approval?
- What finding is a non-blocking improvement?
- What should be explicitly left for a follow-up?
- What's the minimum set of changes the author should make before re-review?

## Synthesis (Q91-Q100)

- Final review verdict: approve, approve with nits, request changes, or block
- Top blocking findings with file/line references
- Top non-blocking improvements
- Missing tests or verification commands
- Honest risk assessment for merging as-is
- Suggested split if the diff should be broken up
- What evidence is required for re-approval
