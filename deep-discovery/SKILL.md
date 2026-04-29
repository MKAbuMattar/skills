---
name: deep-discovery
description: Run a rigorous 100-question self-interrogation that exhaustively stress-tests an idea, design, architecture, plan, strategy, product, business idea, trading system, patch, or skill/plugin proposal before committing. Use whenever the user asks for deep discovery, idea interrogation, brainstorming, hole-poking, weakness finding, pre-commitment review, architecture stress-test, plan vetting, 100-question dive, or hits you with phrases like 'poke holes in this', 'stress test this design', 'find the weaknesses', 'is this idea any good', 'before I commit, vet this', or 'do a deep audit'.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Deep Discovery

A self-dialogue framework. 100 sequential questions, each building on the last answer, that exhaustively explores a topic before any commitment. Output is a synthesis: top issues, top strengths, recommended changes, honest bottom line.

## When to use

- Before committing to a design, architecture, plan, or migration.
- Before approving a non-trivial patch, branch, or pull request.
- Before publishing a product, business plan, go-to-market motion, or pricing model.
- Before deploying a trading strategy, financial system, or anything with money at risk.
- Before publishing a skill, plugin, MCP server, or agent integration.
- During debugging when you need to exhaustively explore root causes.
- Whenever the user asks to "poke holes", "stress test", "find weaknesses", or "vet" something.

Skip this skill for: trivial fixes, well-understood routine work, anything where the answer fits in one sentence.

## Required structure

Every run produces a deliverable in this shape:

```
Topic: [what we're exploring]
Mode: [evaluation | exploration | comparison]
Domain pattern: [software architecture | code review | skill/plugin creation | business/product | trading/financial | general]
Questions asked: 100

Top 10 critical issues found
Top 10 strengths
Recommended changes (with rationale)
Revised proposal (if the original needs significant changes)
Honest bottom line: one paragraph, no sugar-coating
```

## Workflow

1. **Preflight.** Identify topic, available context, focus, and starting point. If any are too ambiguous to run a useful interrogation, ask at most three clarifying questions before starting.
2. **Pick the mode:**
   - **Evaluation** — an existing design, architecture, strategy, or plan exists; interrogate that specific proposal.
   - **Exploration** — starting from scratch; the questions build toward a complete proposal.
   - **Comparison** — choosing between 2-3 options; run a full pass per option, then compare.
3. **Pick the domain pattern.** Open `references/question-patterns.md` (the index), then load only the closest matching pattern file:
   - Software architecture / system design → `references/software-architecture.md`
   - Patch / branch / pull request review → `references/code-review.md`
   - Agent skill / plugin / MCP server / integration → `references/skill-and-plugin-creation.md`
   - Business / product / go-to-market → `references/business-product.md`
   - Trading / financial / market strategy → `references/trading-financial.md`
   - Doesn't fit cleanly or spans multiple → `references/general-pattern.md`
4. **Run the 100 questions.** Q1 is always: "What is the goal, and how do we get there?" Each subsequent question MUST build on the previous answer. Progression:

   | Phase                      | Questions | Focus                                                    |
   | -------------------------- | --------- | -------------------------------------------------------- |
   | Foundation                 | Q1-Q10    | Goal, constraints, assumptions, what makes this unique   |
   | Mechanics                  | Q11-Q30   | How it works, components, data flow, dependencies        |
   | Stress testing             | Q31-Q50   | Edge cases, failure modes, what breaks first             |
   | Competitive / alternatives | Q51-Q65   | What exists, what's different, what's the real edge      |
   | Feasibility                | Q66-Q80   | Can this actually be built/done, what are the blockers   |
   | Refinement                 | Q81-Q90   | Improvements, optimizations, what was missed             |
   | Synthesis                  | Q91-Q100  | Final architecture, honest assessment, actionable output |

5. **Synthesize.** The final 10 questions must produce the deliverable structure above. Do NOT dump the full 100 Q&A unless the user explicitly asks — summarize the insights.
6. **Present the deliverable.** Top issues, top strengths, recommended changes, revised proposal (if needed), honest bottom line.

See `assets/examples/full-example.md` for a complete worked run.

## Available resources

- `references/question-patterns.md` — domain router; read first to choose the right pattern file.
- `references/software-architecture.md` — system / API / data / infra design.
- `references/code-review.md` — patch / branch / pull request review.
- `references/skill-and-plugin-creation.md` — agent skill / plugin / MCP server / integration audit.
- `references/business-product.md` — business strategy, product, go-to-market, pricing.
- `references/trading-financial.md` — trading systems, financial strategies, market edges.
- `references/general-pattern.md` — universal fallback when no domain pattern fits cleanly.
- `assets/examples/full-example.md` — full worked run on a sample proposal.

## Top gotchas (always inline — do not skip)

- **Do not skip questions to "save time".** A 30-question pass is not a deep discovery — it's a regular review. The value comes from sustained pressure past Q50, where the obvious problems have been surfaced and you have to dig for the non-obvious ones. Run all 100.
- **Each question must build on the previous answer.** No random jumps. If Q23 reveals a critical flaw, Q24 should explore that flaw, not pivot to a different topic. Track the thread.
- **Be brutally honest.** Surface problems instead of hiding them. "This actually looks fine" at Q50 means you are not pushing hard enough. There is always something at Q50.
- **Challenge assumptions explicitly.** Around Q50, circle back to Q1-Q10 assumptions and ask "Is that actually true?" The early answers were guesses; the middle questions tested them; the late questions verify them.
- **Go concrete, not abstract.** "How does authentication work?" beats "What about security?" "How much latency under 100x load?" beats "Is latency a concern?" Vague questions get vague answers.
- **Follow the pain.** When an answer reveals a problem, spend 3-5 questions digging into it before moving on. The first crack in a design is usually the surface of a deeper issue.
- **Do not dump the 100 Q&A in the final response.** The user wants the synthesis. Keep the raw questions internal unless the user asks for them.
- **Match the deliverable to the domain.** A code-review run produces approve/request-changes verdicts with file references. A trading run produces P&L projections and risk assessment. A business run produces a revised go-to-market and existential risks. Don't deliver the wrong shape.
- **Comparison mode runs a full 100-question pass per option.** Not 50 each, not 33-each-and-shared. Each option deserves the full interrogation, then compare findings.
- **Stop after Q100.** The final 10 are synthesis, not "let's keep going". If the run wants to extend past 100, that means earlier questions were not focused enough — start a fresh discovery on the new sub-topic instead.
- **Generic fallback is for genuine cross-domain cases.** Do not default to `general-pattern.md` because you can't decide. Re-read the index in `question-patterns.md` and pick the closest deliverable shape.

## What you DO

1. Read the user's topic carefully and ask at most 3 clarifying questions if needed.
2. Pick mode (evaluation / exploration / comparison) and the closest domain pattern.
3. Open `references/question-patterns.md` first to route, then load only the matching pattern file.
4. Start with Q1: "What is the goal, and how do we get there?"
5. Make each subsequent question build on the previous answer.
6. Spend 3-5 questions on every revealed problem before moving on.
7. Around Q50, circle back and re-test the Q1-Q10 assumptions.
8. Use concrete numbers, scenarios, and named components — not abstractions.
9. Run all 100 questions. No shortcuts.
10. Produce the deliverable in the required structure: top issues, top strengths, recommended changes, revised proposal (if needed), honest bottom line.
11. Keep the raw 100 Q&A internal; surface only the synthesis unless the user asks for the full transcript.

## What you do NOT do

- Do not abbreviate the run below 100 questions unless the user explicitly asks for a shorter version.
- Do not jump randomly between topics. Each question builds on the last answer.
- Do not soften findings to be diplomatic. The value of this skill is brutal honesty.
- Do not dump the full 100 Q&A into the user's chat by default.
- Do not invent constraints or facts. If you don't know, ask in preflight or flag the gap in the synthesis.
- Do not skip the assumption-revisit pass around Q50. That is where most missed flaws hide.
- Do not preload all reference files. Pick the closest pattern via the router and load only that one.
- Do not deliver a generic shape. A code-review deliverable should look like a code review, a business-strategy deliverable should look like a business strategy.
- Do not extend past Q100 to keep the run going. If new sub-questions need exploring, propose a fresh discovery on that sub-topic.
- Do not run discovery on trivial tasks. Reserve it for pre-commitment, high-cost, or hard-to-reverse decisions.
