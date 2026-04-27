# Voice calibration

Load this when the user provides a writing sample and wants the rewrite to match their voice.

## Why this matters

Generic humanizing produces a generic human voice — usually a "punchy, varied, opinionated" register that doesn't match a long-flowing-academic writer or a dry technical writer. If the user gives you a sample, the goal is not "human", it's "this human".

## What to extract from the sample

Read the sample once before touching the target text. Note:

1. **Sentence length pattern.** Short and punchy? Long and flowing? Mixed with deliberate rhythm? Average sentence length tells you a lot.
2. **Word level.** Casual ("stuff", "things", "kind of"), academic ("constitutes", "demonstrates"), or technical (domain-specific jargon used unselfconsciously)?
3. **Paragraph openings.** Do they jump straight into the point? Set context first? Open with a question? An anecdote?
4. **Punctuation habits.** Frequent dashes? Parenthetical asides? Semicolons? Lots of short fragments. Like this. Or none of that?
5. **Recurring phrases or verbal tics.** "I keep thinking about", "the thing is", "honestly", specific sentence-starters that show up more than once.
6. **Transitions.** Explicit connectors (however, therefore, in addition) or do they just start the next point and let the reader follow?
7. **Use of "I".** First-person throughout? Avoided? Mixed?
8. **Hedging style.** Confident assertions? Lots of "might", "seems"? Or owned uncertainty ("I don't really know")?
9. **Edge.** Do they have opinions? Do they push back on things? Are they polite? Are they grumpy?

## How to apply it

When you rewrite the target text:

- **Match length distribution.** If the sample averages 12-word sentences, don't produce 25-word ones. If the sample mixes short and long, mix them.
- **Match word level exactly.** If they say "stuff", you say "stuff" — don't upgrade to "elements". If they say "constitutes", don't downgrade to "is".
- **Reuse their tics.** If the sample opens paragraphs with "Honestly," or "The thing is," it's fine to do that once or twice in the rewrite. (Don't overdo it.)
- **Match their opinion volume.** If they don't editorialize, don't add opinions during humanizing. If they do, add some — but as their kind of opinions, not yours.
- **Match their punctuation density.** Em-dash lover? Keep some em-dashes (within reason). Semicolon person? Use a semicolon. Comma-only writer? Stay there.

## When the sample contradicts the AI-pattern advice

The sample wins. If the user's actual writing uses lots of "however" and "additionally", don't strip those — they're the user's voice. If their actual writing has em-dashes everywhere, that's their style. The 29 patterns are defaults; the sample is data.

The exceptions: chatbot artifacts ("I hope this helps!"), curly quotes in code contexts, and obvious copy-paste contamination get stripped regardless of sample.

## How the user provides a sample

- **Inline:** "Humanize this. Here's a sample of my writing for voice matching: [sample]"
- **File:** "Humanize this. Use my writing style from [file path] as a reference."
- **Implicit:** If you've worked with the user before in the conversation and they've been writing in their own voice, that earlier writing is the sample. You don't need them to repaste it.

## Checklist before final output

- Does the rewrite read like the sample?
- Did I keep their specific phrases / tics / sentence openings?
- Did I avoid "upgrading" their casual words?
- Is the punctuation density similar?
- Would the user, reading it cold, recognize it as their own?
