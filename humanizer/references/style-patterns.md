# Style patterns (14-19)

These are formatting and typographic tells. Even when the prose is solid, AI formatting habits — em-dash overuse, mechanical boldface, inline-header lists, title case in headings, decorative emojis, curly quotes — give the source away.

---

## 14. Em-dash overuse

**Why it reads as AI:** LLMs use em dashes (—) more than humans, mimicking "punchy" sales writing. A single em-dash in a piece is fine. Three in a paragraph, or one per sentence, is the tell.

**Before:**
> The term is primarily promoted by Dutch institutions—not by the people themselves. You don't say "Netherlands, Europe" as an address—yet this mislabeling continues—even in official documents.

**After:**
> The term is primarily promoted by Dutch institutions, not by the people themselves. You don't say "Netherlands, Europe" as an address, yet this mislabeling continues in official documents.

**Fix recipe:** Replace most em-dashes with commas, periods, or parentheses. Keep at most one per few paragraphs. Don't strip them all — that's its own kind of robotic.

---

## 15. Overuse of boldface

**Why it reads as AI:** AI chatbots emphasize phrases in boldface mechanically — every acronym, every technical term, every "key" concept. Human writing uses bold sparingly, for genuinely important callouts or single-word emphasis.

**Before:**
> It blends **OKRs (Objectives and Key Results)**, **KPIs (Key Performance Indicators)**, and visual strategy tools such as the **Business Model Canvas (BMC)** and **Balanced Scorecard (BSC)**.

**After:**
> It blends OKRs, KPIs, and visual strategy tools like the Business Model Canvas and Balanced Scorecard.

**Fix recipe:** Strip all bold from inline acronyms, technical terms, and "key concepts" in the middle of sentences. Keep bold only for genuine UI/document callouts (Note:, Warning:, etc.) or for one-word emphasis where italics would be the alternative.

---

## 16. Inline-header vertical lists

**Why it reads as AI:** AI outputs lists where each item starts with a bolded header followed by a colon, then a sentence that mostly restates the header. The shape is unmistakable.

**Before:**
> - **User Experience:** The user experience has been significantly improved with a new interface.
> - **Performance:** Performance has been enhanced through optimized algorithms.
> - **Security:** Security has been strengthened with end-to-end encryption.

**After:**
> The update improves the interface, speeds up load times through optimized algorithms, and adds end-to-end encryption.

**Fix recipe:** Collapse the bullet structure into a single sentence or a short paragraph when the items are tightly related. If a list is genuinely the right shape, drop the bolded headers and just write the content.

---

## 17. Title case in headings

**Why it reads as AI:** AI chatbots capitalize all main words in headings ("Strategic Negotiations And Global Partnerships"). Most modern style (web, technical writing, journalism) uses sentence case for headings.

**Before:**
> ## Strategic Negotiations And Global Partnerships

**After:**
> ## Strategic negotiations and global partnerships

**Fix recipe:** Sentence case for h2/h3/h4. Title case is fine only when the document is using it consistently elsewhere (legal documents, formal academic prose).

---

## 18. Emojis

**Why it reads as AI:** AI chatbots decorate headings or bullet points with emojis (🚀, 💡, ✅) as visual scaffolding. Real writing uses emojis sparingly and contextually, not as bullet replacements.

**Before:**
> 🚀 **Launch Phase:** The product launches in Q3
> 💡 **Key Insight:** Users prefer simplicity
> ✅ **Next Steps:** Schedule follow-up meeting

**After:**
> The product launches in Q3. User research showed a preference for simplicity. Next step: schedule a follow-up meeting.

**Fix recipe:** Strip all decorative emojis from headings, bullets, and structural markers. Keep emojis only when the user genuinely uses them in their voice (chat, social posts, casual context).

---

## 19. Curly quotation marks

**Why it reads as AI:** ChatGPT defaults to curly quotes (" ") instead of straight quotes (" "). For Markdown, code, plain-text, and most web contexts, straight quotes are correct.

**Before:**
> He said "the project is on track" but others disagreed.

**After:**
> He said "the project is on track" but others disagreed.

**Fix recipe:** Convert curly to straight in Markdown, code, terminal output, and plain-text contexts. Print-style prose (books, formal essays) can keep curly. The default for tech writing is straight.
