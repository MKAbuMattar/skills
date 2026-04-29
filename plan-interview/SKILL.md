---
name: plan-interview
description: Interview the user one question at a time, branch-by-branch, until every decision in their plan or design is resolved and shared understanding is reached. Each question gets a recommended answer with rationale; questions answerable from the codebase are resolved by reading the code instead of asking. Use whenever the user wants to stress-test a plan interactively, walk through a design tree, resolve open decisions before implementing, or hits you with phrases like 'grill me on this', 'interview me about this plan', 'walk me through the decisions', 'help me clarify this design', or 'what am I missing'.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Plan Interview

A relentless, interactive interview pattern. One question at a time. Each question resolves a single decision in the plan or design tree. Each question ships with a recommended answer and rationale. Anything answerable from the codebase is answered by reading the code, not by asking. The loop ends when no open branches remain.

## When to use

- The user pasted a plan, design doc, RFC, or PR description and wants it stress-tested before implementation.
- The user said "grill me", "interview me", "walk me through this", "what am I missing", "find the gaps in this plan".
- You are about to implement something non-trivial and the spec has obvious unresolved branches (auth model, error semantics, rollout strategy, etc.).
- The user explicitly asked for shared-understanding alignment before code is written.

Skip this skill for: trivial work where the answer is obvious, batch self-interrogation (use `deep-discovery` for that), or pure code review of an existing diff (use `qa` or a code-review pattern instead).

## How this is different from deep-discovery

- `deep-discovery` is a **self-dialogue**: you ask 100 questions internally and produce a synthesis. The user sees only the result.
- `plan-interview` is **interactive**: you ask the user one question, wait for their answer, then ask the next. The user sees every question.

If the user wants a final stress-test report without round-trips, route to `deep-discovery`. If they want to think through the plan with you, stay here.

## Workflow

1. **Read what they gave you.** Plan, design doc, RFC, code in a branch, whatever. Take inventory of every decision the artifact does _or does not_ answer.
2. **Build a decision tree.** Group open decisions into branches. Identify dependencies — some decisions are blocked by others. Load `references/decision-tree.md` for branch-tracking patterns.
3. **Try the codebase first.** For every candidate question, ask: "Could this be answered by reading the code or running a small command?" If yes, resolve it that way and don't ask. Load `references/codebase-first.md` for the heuristic.
4. **Ask the highest-value open question.** Pick the question that unblocks the most downstream branches. One question per turn, never a multi-question dump. Load `references/question-patterns.md` for question shape and the recommended-answer pattern.
5. **Provide your recommended answer with the question.** Always. Format: `Question: <single question>. My recommendation: <answer>. Why: <one or two sentences>.` This gives the user a starting point to react to instead of generating from scratch.
6. **Wait for the answer. Update the tree.** Their answer may resolve the question, change the tree, or open new branches. Update before asking the next.
7. **Repeat until no open branches remain.** When the tree is fully resolved, stop. Summarize the resolved plan and confirm shared understanding.

## Required output shape per question

```
**Q[n]: <single question>**

**My recommendation:** <concrete answer>

**Why:** <one or two sentences of rationale>

<optional: trade-off note, alternatives, or what this unblocks downstream>
```

After every answer the user gives, update the tree and ask the next question in the same shape. When done:

```
**Plan resolved.** Open decisions: 0. Summary:
- <decision 1> → <chosen answer>
- <decision 2> → <chosen answer>
...
```

## Available resources

- `references/question-patterns.md` — what makes a good interview question, the recommended-answer pattern, how to phrase trade-off questions.
- `references/decision-tree.md` — tracking branches and dependencies, choosing the next-highest-value question, when an answer reshapes the tree.
- `references/codebase-first.md` — heuristic for "could the code answer this?" before asking the user.
- `assets/examples/full-example.md` — full worked interview on a sample plan.

## Top gotchas (always inline — do not skip)

- **One question per turn. Always.** Multi-question dumps lose the user. Even when three questions are tightly related, ask one and let the answer reshape the next two.
- **Always include a recommended answer.** "What should we do about X?" with no recommendation makes the user generate from scratch. "I'd lean toward A because Y — does that fit?" is faster and more honest. The user can always say "no, let's do B".
- **Try the code first.** If a question is "what's the current auth flow", you should read the code, not ask. Asking questions the code can answer wastes the user's time and makes you look lazy.
- **Sequence by dependency, not by checklist order.** If decision B depends on decision A, ask A first. Don't march through the plan top-to-bottom — ask whichever open question unblocks the most.
- **The tree changes as answers come in.** A "definitely needed" question can become moot once the user picks a different approach upstream. Update the tree after every answer; never ask a question whose premise the previous answer killed.
- **Stop when the tree is empty.** Don't invent new questions to keep the interview going. The goal is shared understanding, not maximum question count.
- **Don't accept vague answers.** If the user says "we should probably handle errors gracefully", that's not resolved — push for the concrete behavior. "Graceful how — retry once and surface, or fail closed and alert?"
- **Preserve answered decisions.** Once the user has answered a question, don't re-ask it later in different words. Keep a list of resolved decisions and check against it.
- **Do not re-derive the user's stated facts.** If the user already named the database, framework, or runtime, do not ask "what are we using?" Read what they wrote.
- **Stop interviewing when the user says they're done.** "OK that's enough, let's build" is a hard stop. Summarize what's resolved, flag what's still open, and exit. Don't sneak more questions into the summary.
- **The recommendation has to be a real recommendation.** "It depends" is not a recommendation. Pick one, justify it, and let the user push back.

## What you DO

1. Read every artifact the user gave you (plan, doc, code, prior conversation) before asking anything.
2. Build a decision tree of open branches and their dependencies.
3. For each candidate question, check if the codebase can answer it; if so, resolve from code.
4. Ask one question at a time. Always with a concrete recommendation and short rationale.
5. Pick the question that unblocks the most downstream branches first.
6. Update the tree after every user answer before asking the next question.
7. Push back on vague answers — get to a concrete decision.
8. Track resolved decisions and never re-ask them.
9. Stop when the tree is empty. Summarize the resolved plan.
10. If the user calls "stop", stop immediately and summarize what's resolved + what's still open.

## What you do NOT do

- Do not ask multiple questions in one turn.
- Do not ask questions without offering a recommendation.
- Do not ask the user things that are clearly findable in the code or in the artifact they already gave you.
- Do not accept hedged or vague answers as resolved.
- Do not march the questions in artifact order — sequence by dependency.
- Do not re-ask resolved decisions in different words.
- Do not invent questions to keep the interview running once the tree is empty.
- Do not switch to batch self-interrogation halfway through — that's `deep-discovery`'s job.
- Do not write code or implementation while the interview is open. The interview's deliverable is a resolved plan, not a partial implementation.
- Do not summarize until the interview is actually over (tree empty or user-stopped).
