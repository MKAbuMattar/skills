# The audit loop

Load this for the "what makes this so obviously AI" pass. This is the step that catches second-order tells the first rewrite missed.

## Why the loop exists

The first rewrite removes the surface patterns (AI vocabulary, em-dashes, copula avoidance). What survives is subtler: rhythm that's still too tidy, named sources that read like plausible placeholders, closers that lean slogan-y, "balanced" takes that sound algorithmic. The audit pass catches those.

If you skip the audit, your rewrite will pass a casual read but fail a careful one. The user will paste it back and say "it still sounds like ChatGPT" — and they'll be right.

## How to run the loop

After the draft rewrite, ask yourself, in voice:

> What makes the below so obviously AI generated?

Then answer honestly. Be specific. The honest answer is rarely "nothing". Common answers:

- The rhythm is still too even — every paragraph is roughly the same length and structure.
- The opinions feel like balanced both-sides takes when a real person would lean one way.
- A closer (last sentence or paragraph) lands with slogan energy instead of the writer's actual voice.
- A named source / quote / statistic reads plausible-but-made-up.
- The transitions are too clean — a real piece would have a rougher seam somewhere.
- The piece doesn't take a position when the genre demands one.
- The piece feels surveyed rather than lived-in — no specific lived detail, no "I noticed this", just summaries of what's known.
- Casual phrases were replaced by their slightly-formal cousins ("kind of" → "somewhat", "stuff" → "things").

Aim for **2-4 specific bullets**. "Looks fine to me" is not an audit. If you genuinely can't find anything, push harder for one minute before giving up.

Then ask:

> Now make it not obviously AI generated.

And revise to kill those tells.

## What "good audit findings" look like

**Bad audit:**
- Nothing major, the writing is clean.

**Good audit:**
- Three of the four paragraphs are 3 sentences long. Real writers vary more.
- The "Mira, an engineer at a fintech startup" feels like a stock placeholder unless that person is real.
- The closing line ("If you don't have tests, you can't tell whether the suggestion is right") lands like a Twitter quote, not like the rest of the piece.

The good audit names specific paragraphs / sentences and explains *why* they read AI.

## What to do with the findings

For each finding, do one of:

- **Cut it.** The sentence was scaffolding; remove it.
- **Ground it.** Replace plausible-sounding placeholders with real specifics — or with honest "in my experience" framing instead of false attribution.
- **Roughen it.** Even out the rhythm by inserting a short sentence into a long-paragraph block, or a long one into a short-paragraph block.
- **Pick a side.** If the piece is balanced when it should lean, lean.
- **Cool the closer.** If the last sentence is slogan-y, replace with something quieter.

## When NOT to revise

If the audit finding conflicts with the user's voice sample, the sample wins. Example: if you note "the rhythm is too tidy" but the user's sample is also tidy-rhythmed, that's their style, not an AI tell. Leave it.

## Output format after the loop

```
[Draft rewrite]

What makes the below so obviously AI generated?
- [bullet 1]
- [bullet 2]
- [bullet 3]

[Final rewrite]

Changes made (optional):
- [terse list]
```

The user sees the draft, the audit findings, and the final. The audit bullets are useful to the user too — they teach the user which patterns to watch for in their own writing.
