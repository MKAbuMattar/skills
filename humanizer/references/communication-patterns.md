# Communication patterns (20-22)

These are chatbot-conversation artifacts that leak into pasted content. They're the easiest tells to spot and the easiest to remove — if the user pasted ChatGPT output without editing, you'll see one of these in the first or last paragraph.

---

## 20. Collaborative communication artifacts

**Words to watch:** I hope this helps, Of course!, Certainly!, You're absolutely right!, Would you like…, Let me know if…, Here is a…, Here's a quick rundown of…, Feel free to…

**Why it reads as AI:** Text written as chatbot correspondence gets pasted as if it were content. These openings and closers are conversational glue, not prose.

**Before:**
> Here is an overview of the French Revolution. I hope this helps! Let me know if you'd like me to expand on any section.

**After:**
> The French Revolution began in 1789 when financial crisis and food shortages led to widespread unrest.

**Fix recipe:** Delete the first sentence if it announces the topic ("Here is an overview of X"). Delete the last sentence if it offers help ("Let me know if…", "Hope this helps!"). The middle is usually fine.

---

## 21. Knowledge-cutoff disclaimers

**Words to watch:** as of [date], up to my last training update, while specific details are limited/scarce…, based on available information…, I don't have access to real-time data, sources may vary.

**Why it reads as AI:** AI hedging about its own incomplete information gets left in the text. Real writers either know the date and state it, or admit they don't know without invoking "training data".

**Before:**
> While specific details about the company's founding are not extensively documented in readily available sources, it appears to have been established sometime in the 1990s.

**After:**
> The company was founded in 1994, according to its registration documents.

**Fix recipe:** If the user has the real fact, use it. If not, write "I'm not sure when X was founded" or omit the claim entirely. Never reference "training data", "available information", or "as of my last update".

---

## 22. Sycophantic / servile tone

**Words to watch:** Great question!, You're absolutely right!, That's an excellent point, What a thoughtful observation, I appreciate your insight.

**Why it reads as AI:** Overly positive, people-pleasing language at the start of a response. Reads as flattery, not engagement.

**Before:**
> Great question! You're absolutely right that this is a complex topic. That's an excellent point about the economic factors.

**After:**
> The economic factors you mentioned are relevant here.

**Fix recipe:** Strip the entire flattering preamble. Start with the actual content. If the writer wants to acknowledge the question, "That's true" or "Fair point" is enough — and only if it's genuinely conceding something.
