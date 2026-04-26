---
name: qa
description: Run an interactive QA session — the user describes bugs and issues conversationally, you ask brief clarifying questions, explore the codebase for domain context, decide whether to file one issue or break it down, and create durable user-focused GitHub issues via `gh issue create` — without referencing internal file paths or line numbers. Use this skill whenever the user wants to do QA, report bugs, file issues, walk through a list of problems, or hits you with phrases like "let's do a QA session", "I found a bug", "this is broken", "file this as an issue", "I have a few things to report", or "let's go through these one by one". Also use when the user is reviewing a deployed feature and wants to track defects.
license: MIT. See LICENSE for full terms.
compatibility: Requires `gh` CLI authenticated for the target repo. Designed for Claude Code (or any agent that supports a background `Explore` subagent).
metadata:
  author: mkabumattar
  version: "1.0.0"
---

# QA

Interactive QA: capture bugs into durable, user-focused GitHub issues — fast, parallel-friendly, and free of internal file/line references.

## When to use

- The user wants to report bugs, do a QA pass, or walk through a list of defects.
- The user opens with phrases like "let's do a QA session", "I found a bug", "this is broken", "file this", "a few things to report", or "let's go through these".
- The user is reviewing a deployed feature and wants the issues tracked.

## The session loop

For **each** issue the user raises, run these steps. Each issue is independent — don't batch.

### 1. Listen and lightly clarify

Let the user describe the problem in their own words. Ask **at most 2–3 short clarifying questions**, focused on:

- Expected vs actual behavior
- Steps to reproduce (if not obvious)
- Consistent vs intermittent

If the description is already clear enough to file, **move on without asking**. Don't over-interview.

### 2. Explore the codebase in the background

While talking to the user, spawn a background `Explore` subagent (`subagent_type=Explore`) for the relevant area. The goal is **context for the issue body**, not a fix:

- Learn the domain language used in that area. Read `UBIQUITOUS_LANGUAGE.md` if present.
- Understand what the feature is supposed to do.
- Identify the user-facing behavior boundary.

The issue itself **must not** reference specific files, line numbers, or internal implementation details — that exploration only sharpens your wording.

### 3. Decide: single issue or breakdown

**Break down** when:

- The fix spans multiple independent areas (`form validation is wrong AND success message is missing AND redirect is broken`).
- There are clearly separable concerns different people could work on in parallel.
- The user describes multiple distinct failure modes or symptoms.

**Keep as a single issue** when:

- It's one behavior that's wrong in one place.
- All the symptoms are caused by the same root behavior.

When breaking down: **prefer many thin issues over few thick ones**, mark blocking relationships honestly, create issues in dependency order so `Blocked by #N` can use real numbers, and maximize parallelism.

### 4. File the issue(s) with `gh issue create`

Use the templates verbatim:

- Single issue → fill in `assets/templates/single-issue.template.md`, then `gh issue create --title "..." --body-file <filled.md>`.
- Breakdown → for each slice, fill in `assets/templates/breakdown-subissue.template.md`. Create blockers first so dependent issues can cite real numbers.

**Do not** ask the user to review before filing. File and share the URLs.

### 5. Continue

After filing, print all issue URLs (with blocking relationships summarized) and ask: **"Next issue, or are we done?"** Loop until the user says they're done.

## Available resources

- `assets/templates/single-issue.template.md` — body template for a single issue. Use verbatim, fill placeholders.
- `assets/templates/breakdown-subissue.template.md` — body template for one slice of a broken-down report.

## Top gotchas (always inline — do not skip)

- **No file paths, function names, or line numbers in issue bodies.** Issues outlive refactors. Describe user-facing behavior, not code.
- **Use the project's domain language.** Read `UBIQUITOUS_LANGUAGE.md` if present. "The sync service fails to apply the patch" — not `applyPatch() throws on line 42`.
- **Don't over-interview.** Two or three short questions, then file.
- **Don't ask for approval before filing.** File and share the URL — that's the whole point of "fast QA".
- **Reproduction steps are mandatory.** If you can't derive them from the description, ask one targeted question.
- **Each issue is independent — file as you go.** Don't batch them up at the end.
- **Issue bodies should read in 30 seconds.** A developer should grok the problem fast.
- **Every `Blocked by` must reference a real issue number.** That's why you create blockers first.
- **Don't try to fix the bug.** This skill is for *capturing* defects. The fix is somebody else's (or a follow-up) job.

## What you DO

1. Listen first; ask 2–3 short clarifying questions max; file fast.
2. Spawn an `Explore` subagent in the background to learn domain language while you talk to the user.
3. Read `UBIQUITOUS_LANGUAGE.md` (if it exists) before writing the issue body.
4. Decide single-vs-breakdown based on whether the fix has independent slices.
5. Use the bundled templates verbatim — fill the placeholders with domain-language descriptions.
6. File issues in dependency order so `Blocked by` can cite real numbers.
7. Run `gh issue create --title "..." --body-file <path>` directly. Don't ask for review.
8. After each filing, print URLs + a one-line blocking summary, then ask "Next issue, or are we done?"

## What you do NOT do

- Cite file paths, function names, or line numbers in issue bodies.
- Over-interview the user with more than 2–3 short questions.
- Ask the user to approve the issue body before filing.
- Batch issues — file one at a time as the user reports them.
- Try to fix the bug. Capture, don't repair.
- Use module / internal naming when domain naming exists.
- File without reproduction steps.
- Mix multiple separable problems into one issue.
- Reference your codebase exploration in the issue body — it informs *your wording*, not the issue text.
