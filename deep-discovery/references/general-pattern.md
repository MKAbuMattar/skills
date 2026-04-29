# General pattern

Use this pattern when no specific domain pattern fits cleanly, or when the topic spans multiple domains and the deliverable is still broad. The deliverable shape is whatever fits the topic — a revised proposal, a decision recommendation, a plan — but always with top issues, top strengths, and an honest bottom line.

## Universal 100-question progression

| Phase          | Questions | Focus                                                         |
| -------------- | --------- | ------------------------------------------------------------- |
| Foundation     | Q1-Q10    | Goal, constraints, assumptions                                |
| Mechanics      | Q11-Q30   | How does it actually work? Moving parts, data flow            |
| Stress testing | Q31-Q50   | What breaks? Failure modes, edge cases, risks                 |
| Alternatives   | Q51-Q65   | What else exists? Competition, prior art, "do nothing" option |
| Feasibility    | Q66-Q80   | Can we actually do this? Blockers, resources, dependencies    |
| Refinement     | Q81-Q90   | Make it better — simplify, optimize, what was missed          |
| Synthesis      | Q91-Q100  | Final proposal, honest assessment, next steps                 |

## Tips for high-quality discovery

- **Go concrete early.** "How does authentication work?" beats "What about security?"
- **Follow the pain.** When an answer reveals a problem, spend 3-5 questions digging into it before moving on. The first crack is usually the surface of a deeper issue.
- **Challenge happy-path thinking.** After "how does it work?", ask "what happens when it does not?"
- **Quantify.** "How much latency?" beats "Is latency a concern?" "How much will this cost at 10x scale?" beats "Is cost a concern?"
- **Compare.** "Why this approach over [specific alternative]?" forces honest evaluation.
- **Revisit assumptions.** Around Q50, circle back to Q1-Q10 assumptions and test whether they still hold.
- **Name names.** "What happens when the database is down?" beats "What happens when a dependency fails?"
- **Force a decision.** Around Q90, ask "If I had to ship this Monday, what's the smallest version that works?"

## When the topic is genuinely cross-domain

Some examples of cross-domain topics that fit this pattern:

- A research project that spans business viability, technical feasibility, and product design at once.
- A "should we build or buy" decision that mixes architecture, vendor risk, cost, and team capability.
- A career or strategic decision (e.g., "should our team take on this initiative") that spans skills, capacity, opportunity cost, and strategic fit.
- A "do nothing" assessment where the goal is to seriously interrogate whether the alternative of inaction is underrated.

In all these cases, do not fabricate a domain pattern. Use this universal progression and let the deliverable shape itself emerge from the synthesis questions.

## Output

The synthesis (Q91-Q100) should produce, at minimum:

- Top 5-10 critical issues found
- Top 5-10 strengths
- Recommended changes with rationale
- A revised proposal if the original needs significant changes
- One paragraph honest bottom line — no sugar-coating, no hedge cluster
