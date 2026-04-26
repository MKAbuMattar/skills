# Optimizing the Description

Distilled from the [official guide](https://agentskills.io/skill-creation/optimizing-descriptions). Load this when the skill triggers too rarely (under-triggers) or too often on irrelevant tasks (over-triggers), or before publishing.

## Why it matters

The `description` carries the **entire triggering burden**. At startup, agents load only `name` + `description` for every available skill. When a user's task matches a description, the agent loads the full `SKILL.md` and follows it.

Under-specified description → skill won't trigger when it should. Over-broad description → triggers on irrelevant tasks, costing tokens and possibly leading the agent astray.

## Writing effective descriptions

Four principles:

1. **Imperative phrasing.** "Use this skill when..." beats "This skill does...". The agent is deciding whether to act, not reading a brochure.
2. **User intent, not implementation.** Describe what the user is trying to achieve, not the skill's internal mechanics.
3. **Be pushy.** Explicitly list contexts where the skill applies, including casual phrasings: "...even if they don't explicitly mention 'CSV' or 'analysis'."
4. **Stay concise.** A few sentences to a short paragraph. Hard limit: 1024 chars.

### Before / after

```yaml
# Before — vague, bare implementation
description: Process CSV files.

# After — specific scope, explicit casual variants
description: >
  Analyze CSV and tabular data files — compute summary statistics,
  add derived columns, generate charts, and clean messy data. Use this
  skill when the user has a CSV, TSV, or Excel file and wants to
  explore, transform, or visualize the data, even if they don't
  explicitly mention "CSV" or "analysis."
```

## The eval loop

### Step 1 — Build a query set

Aim for ~20 queries: 8–10 should-trigger, 8–10 should-not-trigger. Save as `eval_queries.json`:

```json
[
  { "query": "I've got a spreadsheet at ~/q4.xlsx with revenue in C and expenses in D — can you add a profit margin column and highlight anything under 10%?", "should_trigger": true },
  { "query": "whats the quickest way to convert this json file to yaml", "should_trigger": false }
]
```

#### Should-trigger queries

Vary on:

- **Phrasing** — formal, casual, with typos.
- **Explicitness** — some name the domain ("analyze this CSV"), others don't ("my boss wants a chart from this data file").
- **Detail** — terse and context-heavy alongside each other.
- **Complexity** — single-step and multi-step workflows.

The most useful are queries where the skill helps but the connection isn't obvious from the query alone — that's where wording matters.

#### Should-not-trigger queries

The most valuable are **near-misses**: queries that share keywords but need something different.

For a CSV-analysis skill:

- Weak: `"What's the weather today?"` (no overlap, tests nothing).
- Strong: `"I need to update the formulas in my Excel budget spreadsheet"` (shares "spreadsheet" but needs Excel editing).
- Strong: `"can you write a python script that reads a csv and uploads each row to our postgres database"` (involves CSV but is ETL, not analysis).

#### Tips for realism

Real prompts have:

- File paths (`~/Downloads/report_final_v2.xlsx`)
- Personal context (`"my manager asked me to..."`)
- Specific details (column names, values, company names)
- Casual language, abbreviations, occasional typos

### Step 2 — Run each query multiple times

Model behavior is nondeterministic. Run each query 3 times and compute a **trigger rate** — the fraction of runs the skill activated. With 20 queries × 3 runs = 60 invocations, you'll want a script.

Pass criteria:

- `should_trigger: true` and trigger rate ≥ 0.5 → pass
- `should_trigger: false` and trigger rate < 0.5 → pass

### Step 3 — Train / validation split

To avoid overfitting:

- **Train** (~60%) — drives the changes you make.
- **Validation** (~40%) — set aside; only used to check whether changes generalize.

Both sets need a proportional mix of positives and negatives. Shuffle once, keep the split fixed across iterations.

### Step 4 — The optimization loop

1. Evaluate on **both** sets. Train results guide changes; validation results test generalization.
2. Identify failures in the **train** set:
   - Should-trigger failed → description too narrow. Broaden scope; add context.
   - Should-not-trigger triggered → description too broad. Add specificity; clarify boundaries.
3. Revise:
   - **Avoid keyword overfitting** from failed queries. Generalize to the underlying category.
   - If stuck after several iterations, try a structurally different framing — not just incremental tweaks.
   - Stay under 1024 chars (descriptions tend to grow during optimization).
4. Repeat until train passes plateau.
5. Pick the iteration with the best **validation** pass rate — not necessarily the latest one.

Five iterations is usually enough. If results don't improve, the issue is likely the queries (too easy, too hard, mislabeled), not the description.

## When you're done

1. Update `description` in `SKILL.md` frontmatter.
2. Verify ≤ 1024 chars.
3. Run 5–10 fresh queries (never seen during optimization) as a final sanity check.
