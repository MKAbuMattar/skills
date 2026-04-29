# Question patterns by domain

This file is the router. Use it to pick the right domain pattern before starting the 100-question run. The 7-phase progression stays the same across domains:

1. Foundation
2. Mechanics
3. Stress testing
4. Competitive / alternative analysis
5. Feasibility
6. Refinement
7. Synthesis

Read only the closest matching pattern file:

| Domain                     | File                                      | Use when                                                                                                                  |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Software architecture      | `references/software-architecture.md`     | Designing or auditing systems, APIs, services, data flows, deployments, schemas, infrastructure, or technical migrations. |
| Code review                | `references/code-review.md`               | Reviewing a patch, branch, pull request, implementation, or proposed diff before accepting it.                            |
| Agent skill / plugin / MCP | `references/skill-and-plugin-creation.md` | Planning, auditing, repairing, or packaging an agent skill, plugin, MCP server, integration, hook, or harness extension.  |
| Trading / financial        | `references/trading-financial.md`         | Evaluating trading systems, financial strategies, market edges, execution risk, backtests, or operational risk.           |
| Business / product         | `references/business-product.md`          | Evaluating products, go-to-market plans, business models, market strategy, pricing, or startup ideas.                     |
| General                    | `references/general-pattern.md`           | No domain-specific pattern fits cleanly, or the topic spans multiple domains.                                             |

## Disambiguation

If two files seem to fit, choose the one that matches the user's **deliverable**:

- A patch that adds a plugin → **Code Review** (the deliverable is approve/request-changes on the diff).
- A plugin's overall concept, structure, triggering, or installation flow → **Skill/Plugin Creation**.
- A pricing change baked into a payments-provider integration → **Business/Product** (the deliverable is the pricing decision, not the integration).
- The payments-provider integration itself → **Software Architecture**.
- A trading bot's order-router refactor → **Code Review**.
- The trading strategy the bot implements → **Trading/Financial**.

## When to fall back to general

`general-pattern.md` is for genuine cross-domain cases — a research project that spans business strategy, technical infrastructure, and product design at once, for example. Do **not** default to general because you can't decide between two specific patterns. Re-read this index and pick the closest deliverable.
