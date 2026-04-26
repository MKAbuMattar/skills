# Evaluating Output Quality

Distilled from the [official guide](https://agentskills.io/skill-creation/evaluating-skills). Load this when measuring whether the skill's *outputs* are good (not just whether it triggers — see `description-optimization.md` for that).

## Test cases

Each test case has three parts:

- **Prompt** — a realistic user message.
- **Expected output** — a human-readable description of what success looks like.
- **Input files** (optional) — files the skill works with.

Store at `evals/evals.json`:

```json
{
  "skill_name": "csv-analyzer",
  "evals": [
    {
      "id": 1,
      "prompt": "I have a CSV of monthly sales data in data/sales_2025.csv. Can you find the top 3 months by revenue and make a bar chart?",
      "expected_output": "A bar chart image showing the top 3 months by revenue, with labeled axes and values.",
      "files": ["evals/files/sales_2025.csv"]
    }
  ]
}
```

Tips:

- **Start with 2–3 cases.** Don't over-invest before seeing first results.
- **Vary phrasing**, levels of detail, formality.
- **Cover an edge case** — a malformed input, an unusual request.
- **Use realistic context** — file paths, column names, casual language.

## Run with skill / without skill

The core pattern: run each test case **twice** — once with the skill, once without (or with a previous version). The without-skill run is the baseline.

### Workspace layout

```
csv-analyzer-workspace/
└── iteration-1/
    ├── eval-top-months-chart/
    │   ├── with_skill/
    │   │   ├── outputs/
    │   │   ├── timing.json
    │   │   └── grading.json
    │   └── without_skill/
    │       ├── outputs/
    │       ├── timing.json
    │       └── grading.json
    └── benchmark.json
```

### Each run starts fresh

In environments with subagents (Claude Code), each child task starts with no leftover state. Without subagents, use a separate session per run.

### Capture timing

```json
{ "total_tokens": 84852, "duration_ms": 23332 }
```

A skill that improves quality but triples token usage is a different trade-off than one that's better and cheaper.

## Assertions

Add **after** seeing first outputs — you often don't know what "good" looks like up front.

Good:

- `"The output file is valid JSON"` — programmatically checkable.
- `"The bar chart has labeled axes"` — specific and observable.
- `"The report includes at least 3 recommendations"` — countable.

Weak:

- `"The output is good"` — too vague.
- `"The output uses exactly the phrase 'Total Revenue: $X'"` — too brittle.

Not everything needs an assertion. Style, visual design, and "feels right" qualities are better caught during human review.

## Grading

Evaluate each assertion as PASS / FAIL with concrete evidence:

```json
{
  "assertion_results": [
    {
      "text": "The output includes a bar chart image file",
      "passed": true,
      "evidence": "Found chart.png (45KB) in outputs directory"
    },
    {
      "text": "Both axes are labeled",
      "passed": false,
      "evidence": "Y-axis labeled 'Revenue ($)' but X-axis has no label"
    }
  ],
  "summary": { "passed": 1, "failed": 1, "total": 2, "pass_rate": 0.5 }
}
```

Principles:

- **Require concrete evidence for a PASS.** "Has a Summary section" with one vague sentence is FAIL — the label is there but the substance isn't.
- **Review the assertions themselves.** Drop assertions that always pass (uninformative). Investigate ones that always fail (broken).

For comparing two skill versions, try **blind comparison**: present both outputs to an LLM judge without revealing which came from which version, and have it score holistic qualities (organization, polish, usability) on its own rubric.

## Aggregate

Compute summary stats per configuration:

```json
{
  "run_summary": {
    "with_skill":    { "pass_rate": { "mean": 0.83 }, "tokens": { "mean": 3800 } },
    "without_skill": { "pass_rate": { "mean": 0.33 }, "tokens": { "mean": 2100 } },
    "delta":         { "pass_rate": 0.50,             "tokens": 1700 }
  }
}
```

The **delta** is what the skill costs vs. what it buys. +13s and +50pp pass rate is probably worth it. 2x tokens for +2pp is probably not.

## Patterns to look for

- **Always-pass assertions in both configs** → uninformative, drop them.
- **Always-fail in both configs** → broken assertion or too-hard test case, fix it.
- **Pass-with / fail-without** → this is where the skill is adding value. Understand *why*.
- **High variance** (passes some runs, fails others) → ambiguous instructions or flaky eval. Tighten or accept.
- **Time/token outliers** → read the transcript to find the bottleneck.

## Human review

Assertions only check what you thought to write. A human reviewer catches:

- Issues you didn't anticipate.
- Output that's technically correct but misses the point.
- Problems hard to express as pass/fail.

Record specific feedback:

```json
{
  "eval-top-months-chart": "Chart is missing axis labels and months are alphabetical instead of chronological.",
  "eval-clean-emails": ""
}
```

"Missing axis labels" is actionable. "Looks bad" is not. Empty feedback = passed review.

## Iterate

Three signal sources:

- **Failed assertions** → specific gaps (missing step, unclear instruction).
- **Human feedback** → broader quality issues (wrong approach, poor structure).
- **Execution transcripts** → reveal *why* (ignored instruction = too ambiguous; wasted steps = needs simplification).

Give all three plus the current `SKILL.md` to an LLM and ask for proposed changes. Guide it with:

- **Generalize from feedback** — fixes should address underlying issues, not patch specific examples.
- **Keep the skill lean** — fewer better instructions beat exhaustive rules.
- **Explain *why*** — reasoning instructions ("Do X because Y tends to cause Z") work better than rigid directives.
- **Bundle repeated work** — if every run reinvents the same helper script, write it once and bundle in `scripts/`.

The loop:

1. Propose improvements from the eval signals.
2. Apply.
3. Re-run all test cases in `iteration-<N+1>/`.
4. Grade and aggregate.
5. Human review. Repeat.

Stop when feedback is consistently empty, or improvements plateau.
