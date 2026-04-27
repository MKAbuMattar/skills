# Filler and persuasion patterns (23-29)

These are the smaller, harder-to-spot tells that survive the first pass. Filler phrases, excessive hedging, generic upbeat conclusions, hyphen-pair overuse, persuasive authority tropes, signposting, and fragmented headers. Strip these in the audit pass.

---

## 23. Filler phrases

**Why it reads as AI:** Long phrases that compress to one or two words. They add no information; they pad the sentence to feel substantial.

**Before → After:**

- "In order to achieve this goal" → "To achieve this"
- "Due to the fact that it was raining" → "Because it was raining"
- "At this point in time" → "Now"
- "In the event that you need help" → "If you need help"
- "The system has the ability to process" → "The system can process"
- "It is important to note that the data shows" → "The data shows"
- "It should be noted that" → just delete it
- "Needless to say" → if it's needless, don't say it
- "For the purpose of" → "To"
- "With regard to" → "About"

**Fix recipe:** Memorize the shortlist above. Most are direct mechanical swaps.

---

## 24. Excessive hedging

**Why it reads as AI:** Stacking multiple hedges ("could potentially possibly might") to avoid commitment.

**Before:**
> It could potentially possibly be argued that the policy might have some effect on outcomes.

**After:**
> The policy may affect outcomes.

**Fix recipe:** Pick one hedge. "Could", "might", "may", "possibly" — choose one. Never stack two of them.

---

## 25. Generic positive conclusions

**Why it reads as AI:** Vague upbeat endings that say nothing. "The future looks bright", "exciting times ahead", "step in the right direction" — all interchangeable across topics.

**Before:**
> The future looks bright for the company. Exciting times lie ahead as they continue their journey toward excellence. This represents a major step in the right direction.

**After:**
> The company plans to open two more locations next year.

**Fix recipe:** Replace the upbeat closer with a concrete plan, fact, or open question. If you don't have one, end on the previous sentence — no closer is better than a generic one.

---

## 26. Hyphenated word-pair overuse

**Words to watch:** third-party, cross-functional, client-facing, data-driven, decision-making, well-known, high-quality, real-time, long-term, end-to-end.

**Why it reads as AI:** AI hyphenates common word pairs with perfect consistency. Humans hyphenate inconsistently — sometimes one form, sometimes another, often the open-compound form when the meaning is unambiguous from context.

**Before:**
> The cross-functional team delivered a high-quality, data-driven report on our client-facing tools. Their decision-making process was well-known for being thorough and detail-oriented.

**After:**
> The cross functional team delivered a high quality, data driven report on our client facing tools. Their decision making process was known for being thorough and detail oriented.

**Fix recipe:** When the compound is acting as an adjective before a noun and ambiguity is possible, keep the hyphen ("data-driven approach"). When the meaning is clear without it, drop the hyphen. Don't hyphenate every single instance — that's the tell.

---

## 27. Persuasive authority tropes

**Phrases to watch:** the real question is, at its core, in reality, what really matters, fundamentally, the deeper issue, the heart of the matter, what's actually going on here.

**Why it reads as AI:** LLMs use these phrases to pretend they're cutting through noise to a deeper truth. The sentence that follows usually just restates an ordinary point with extra ceremony.

**Before:**
> The real question is whether teams can adapt. At its core, what really matters is organizational readiness.

**After:**
> The question is whether teams can adapt. That mostly depends on whether the organization is ready to change its habits.

**Fix recipe:** Cut the trope phrase. State the point. If the point sounds banal once stripped of the framing, the framing was hiding the banality, and you should rewrite to add real substance.

---

## 28. Signposting and announcements

**Phrases to watch:** Let's dive in, let's explore, let's break this down, here's what you need to know, now let's look at, without further ado, in this section, in the next part.

**Why it reads as AI:** LLMs announce what they're about to do instead of doing it. This meta-commentary slows the writing down and gives it a tutorial-script feel.

**Before:**
> Let's dive into how caching works in Next.js. Here's what you need to know.

**After:**
> Next.js caches data at multiple layers, including request memoization, the data cache, and the router cache.

**Fix recipe:** Delete the announcement and start with the content. If the announcement was carrying a useful transition (rare), turn it into a real subordinating clause.

---

## 29. Fragmented headers

**Why it reads as AI:** A heading followed by a one-line paragraph that simply restates the heading before the real content begins. The one-liner is rhetorical warm-up that adds nothing.

**Before:**
> ## Performance
>
> Speed matters.
>
> When users hit a slow page, they leave.

**After:**
> ## Performance
>
> When users hit a slow page, they leave.

**Fix recipe:** Delete the one-line restatement. Start with the substantive sentence. If the warm-up was actually a thesis statement, expand it into a real opening — but most are filler.
