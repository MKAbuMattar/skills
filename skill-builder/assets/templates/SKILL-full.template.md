---
name: {{SKILL_NAME}}
description: {{IMPERATIVE_DESCRIPTION_UNDER_1024_CHARS_LISTING_CASUAL_PHRASINGS}}
license: MIT. See LICENSE for full terms.
compatibility: {{OPTIONAL_RUNTIME_REQUIREMENTS_OR_REMOVE_THIS_LINE}}
metadata:
  author: {{AUTHOR}}
  version: "1.0.0"
---

# {{SKILL_TITLE}}

{{ONE_LINE_TAGLINE_DESCRIBING_THE_DOMAIN}}.

## When to use

- The user asks for {{PRIMARY_TASK}}.
- The user wants to harden, refactor, or review existing {{ARTIFACT_TYPE}}.
- A task chain ends in "and {{TYPICAL_LAST_STEP}}".

## Required structure

The minimal canonical example. Do not omit {{HARD_REQUIREMENTS}}.

```{{LANGUAGE}}
{{MINIMAL_WORKING_EXAMPLE}}
```

## Workflow

1. **{{STEP_1_TITLE}}.** {{DESCRIPTION_AND_EXPLICIT_LOAD_TRIGGER_FOR_REFERENCE_FILE_IF_ANY}}
2. **{{STEP_2_TITLE}}.** {{DESCRIPTION}}
3. **Validate the result.** Run `{{VALIDATOR_COMMAND}}` and aim for ≥ {{TARGET_SCORE}}%.
4. **{{STEP_4_TITLE}}** — load `references/{{TOPIC}}.md` if {{CONDITION}}.
5. **{{STEP_5_TITLE}}.** {{DESCRIPTION}}

## Available resources

- `assets/templates/{{TEMPLATE_FILE}}` — {{PURPOSE}}.
- `assets/examples/{{EXAMPLE_FILE}}` — full reference implementation.
- `scripts/{{SCRIPT_FILE}}` — {{PURPOSE_AND_WHEN_TO_RUN}}.
- `references/{{TOPIC_1}}.md` — load when {{CONDITION_1}}.
- `references/{{TOPIC_2}}.md` — load when {{CONDITION_2}}.

## Top gotchas (always inline — do not skip)

- **{{GOTCHA_1_HEADLINE}}** — {{CONCRETE_EXAMPLE_AND_FIX}}.
- **{{GOTCHA_2_HEADLINE}}** — {{CONCRETE_EXAMPLE_AND_FIX}}.
- **{{GOTCHA_3_HEADLINE}}** — {{CONCRETE_EXAMPLE_AND_FIX}}.

## What you DO

1. {{IMPERATIVE_1}}.
2. {{IMPERATIVE_2}}.
3. {{IMPERATIVE_3}}.
4. Run `{{VALIDATOR_COMMAND}}` on the result; iterate until ≥ {{TARGET_SCORE}}%.
5. Generate {{ARTIFACT_TYPE}} using {{REFERENCE_OR_TEMPLATE}}.

## What you do NOT do

- {{ANTI_PATTERN_1}}.
- {{ANTI_PATTERN_2}}.
- {{ANTI_PATTERN_3}}.
