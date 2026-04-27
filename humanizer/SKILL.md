---
name: humanizer
description: Edit or review text to remove signs of AI-generated writing — inflated significance ('pivotal moment', 'evolving landscape'), promotional language ('nestled', 'breathtaking'), superficial -ing analyses ('highlighting', 'underscoring'), vague attributions ('industry experts'), em-dash overuse, rule-of-three patterns, AI vocabulary ('delve', 'tapestry', 'testament'), copula avoidance ('serves as', 'functions as'), passive voice, negative parallelisms ('not just X, but Y'), filler phrases, sycophantic openings ('Great question!'), and the rest of the 29-pattern catalog from Wikipedia's 'Signs of AI writing' guide. Use this skill whenever the user wants to humanize text, remove AI tells, edit AI-sounding writing, make text sound less like ChatGPT, do a final 'does this read like a person wrote it' pass, or hits you with phrases like 'humanize this', 'make this sound less AI', 'remove the AI slop', 'edit this draft', or 'why does this read like an LLM'.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Humanizer

Edit text to remove the 29 most common AI-writing tells, then audit and revise until a human voice survives.

## When to use

- The user pastes text and asks you to "humanize this", "make it sound less AI", "remove the AI slop", or "edit this draft".
- The user wants a final "does this read like a person wrote it" pass before publishing a post, README, email, or essay.
- The user wants you to review someone else's text and explain why it reads like an LLM.
- You yourself just generated a long-form piece (essay, blog post, announcement) and the user wants the polished version.

Skip this skill for: code comments, commit messages, log lines, structured data (JSON/YAML), tables, and short factual answers — they don't need a humanizing pass.

## The loop in one paragraph

Read the source. Strip the 29 patterns (categories below). Read the result aloud in your head. Audit it by asking yourself "what makes the below so obviously AI generated?" — answer in 2-4 honest bullets. Revise to kill those remaining tells. Add soul (opinions, varied rhythm, specific details, "I" when it fits) so the result has a pulse instead of being merely clean. Output draft → audit → final.

## Workflow

1. **Read the source.** If the user provided a writing sample for voice matching, read that first — note sentence length, word level, punctuation habits, recurring phrases. Load `references/voice-calibration.md`.
2. **Identify patterns.** Scan for all 29 tells. Load the reference file for each category you hit:
   - Patterns 1-6 (significance inflation, promotional language, -ing analyses, vague attributions, formulaic "Challenges" sections) → `references/content-patterns.md`
   - Patterns 7-13 (AI vocabulary, copula avoidance, negative parallelisms, rule of three, false ranges, passive voice) → `references/language-patterns.md`
   - Patterns 14-19 (em-dash overuse, boldface, inline-header lists, title case, emojis, curly quotes) → `references/style-patterns.md`
   - Patterns 20-22 (chatbot artifacts, knowledge-cutoff disclaimers, sycophantic tone) → `references/communication-patterns.md`
   - Patterns 23-29 (filler phrases, hedging, generic conclusions, hyphen pairs, authority tropes, signposting, fragmented headers) → `references/filler-and-persuasion.md`
3. **Draft a rewrite.** Replace each tell with a natural alternative. Keep the meaning; cut the puffery. Default to is/are/has over "serves as / functions as / stands as".
4. **Add soul.** A clean rewrite without voice still reads like an LLM. Load `references/adding-soul.md` and inject opinions, rhythm variation, specific details, and a first-person take where it fits.
5. **Audit.** Load `references/audit-loop.md`. Ask: "what makes the below so obviously AI generated?" Answer in 2-4 honest bullets — be ruthless, this is the step that catches the second-pass slop.
6. **Final revision.** Rewrite based on the audit. Output: draft → audit bullets → final → optional change-log of what you removed.

See `assets/examples/full-example.md` for an end-to-end worked example (AI-sounding essay → draft → audit → final).

## Available resources

- `references/content-patterns.md` — patterns 1-6 (significance, notability, -ing analyses, promotional, vague attributions, "Challenges" sections).
- `references/language-patterns.md` — patterns 7-13 (AI vocabulary, copula avoidance, negative parallelisms, rule of three, elegant variation, false ranges, passive voice).
- `references/style-patterns.md` — patterns 14-19 (em-dash, boldface, inline-header lists, title case, emojis, curly quotes).
- `references/communication-patterns.md` — patterns 20-22 (chatbot artifacts, knowledge-cutoff disclaimers, sycophantic tone).
- `references/filler-and-persuasion.md` — patterns 23-29 (filler, hedging, generic conclusions, hyphen pairs, authority tropes, signposting, fragmented headers).
- `references/voice-calibration.md` — load when the user provides a writing sample to match.
- `references/adding-soul.md` — load when the rewrite reads clean but flat.
- `references/audit-loop.md` — load to run the "what makes this so obviously AI" pass.
- `assets/examples/full-example.md` — end-to-end worked example.

## Top gotchas (always inline — do not skip)

- **Cleaning is not enough.** A rewrite that strips every pattern but adds no voice still reads like an LLM. Always do step 4 (add soul) and step 5 (audit). If you stop at "I removed the AI words", the user will paste it back.
- **Don't upgrade casual words.** If the user writes "stuff" and "things", don't replace with "elements" and "components". Match their level.
- **Don't strip em-dashes blindly.** A few em-dashes are fine. Strip the *overuse* (3+ in a paragraph, or one per sentence). One emphatic em-dash in a piece is human.
- **The audit step has to be honest.** "Looks fine to me" is not an audit. Find at least 2 remaining tells, even if they're small. If you genuinely can't, say so explicitly — but try harder first.
- **Preserve the meaning.** Removing puffery is not the same as removing facts. Keep the dates, names, numbers, claims. Drop only the inflation.
- **Don't add new AI patterns while removing old ones.** A common failure: replace "delve into" with "dive into" (still on the signposting list), or replace "underscores" with "highlights" (both pattern 3).
- **Match the format.** If the source is a tweet, the output is a tweet. If it's a 5-paragraph essay, don't return 2 paragraphs. Length and structure should match the source unless the user asked you to tighten.
- **Hyphenated pairs go both ways.** "Cross-functional" reads AI; "cross functional" can read as a typo. When in doubt, use the form a human writer in that genre would use, not maximum de-hyphenation.
- **Curly quotes vs straight quotes is platform-dependent.** Markdown/code → straight quotes. Print-style prose → curly is fine. Don't auto-convert without thinking.
- **Voice matching beats generic humanizing.** If the user gave you a sample, match *that*. Don't overlay a generic "punchy human" voice on someone whose actual writing is long-flowing-academic.
- **Final pass is for the user, not for you.** If the user wants the rewrite to keep "their" voice (formal, technical, dry), don't smuggle in your own opinions and asides under the banner of "adding soul". Soul ≠ casual.

## What you DO

1. Read the source carefully before writing anything.
2. Load the reference file for each pattern category you actually hit — don't preload all 9.
3. Match the source's length, tone, and format unless the user says otherwise.
4. Replace AI patterns with natural alternatives, not synonyms from the same AI register.
5. Default to is/are/has over copula-avoidance verbs.
6. Vary sentence length on purpose. Short. Then longer ones that take their time.
7. Run the audit step honestly — find remaining tells even when the draft already looks decent.
8. Preserve facts, dates, names, claims. Strip only the inflation.
9. Output draft → audit bullets → final, in that order.
10. Offer a change-log only when the user is likely to learn something from it (a teaching pass), not by default.
11. When the user provides a writing sample, prefer their patterns over the defaults.

## What you do NOT do

- Do not skip the audit step because the draft "already looks fine".
- Do not upgrade casual words to formal ones to look smarter.
- Do not introduce new AI tells while removing old ones (synonym swaps within the same register).
- Do not strip every em-dash mechanically. Strip the overuse pattern.
- Do not replace meaningful detail with vagueness — you're cutting puffery, not facts.
- Do not return shorter or longer than the source unless the user asked you to.
- Do not add your own opinions when humanizing someone else's professional writing — they have their own voice.
- Do not auto-convert curly quotes to straight in contexts where curly is correct (print prose).
- Do not announce what you are about to do ("Let's dive in", "Here's what you need to know") in your own output.
- Do not end with sycophantic offers ("Let me know if you'd like…", "Hope this helps!").
- Do not quote the entire source back to the user unchanged before editing — go straight to the rewrite.
