# Full example: AI-sounding essay → draft → audit → final

This is the canonical end-to-end example for the humanizer skill. The source text demonstrates most of the 29 patterns at once. Walk through it to see what the loop produces.

---

## Source (AI-sounding)

> Great question! Here is an essay on this topic. I hope this helps!
>
> AI-assisted coding serves as an enduring testament to the transformative potential of large language models, marking a pivotal moment in the evolution of software development. In today's rapidly evolving technological landscape, these groundbreaking tools — nestled at the intersection of research and practice — are reshaping how engineers ideate, iterate, and deliver, underscoring their vital role in modern workflows.
>
> At its core, the value proposition is clear: streamlining processes, enhancing collaboration, and fostering alignment. It's not just about autocomplete; it's about unlocking creativity at scale, ensuring that organizations can remain agile while delivering seamless, intuitive, and powerful experiences to users. The tool serves as a catalyst. The assistant functions as a partner. The system stands as a foundation for innovation.
>
> Industry observers have noted that adoption has accelerated from hobbyist experiments to enterprise-wide rollouts, from solo developers to cross-functional teams. The technology has been featured in The New York Times, Wired, and The Verge. Additionally, the ability to generate documentation, tests, and refactors showcases how AI can contribute to better outcomes, highlighting the intricate interplay between automation and human judgment.
>
> - 💡 **Speed:** Code generation is significantly faster, reducing friction and empowering developers.
> - 🚀 **Quality:** Output quality has been enhanced through improved training, contributing to higher standards.
> - ✅ **Adoption:** Usage continues to grow, reflecting broader industry trends.
>
> While specific details are limited based on available information, it could potentially be argued that these tools might have some positive effect. Despite challenges typical of emerging technologies — including hallucinations, bias, and accountability — the ecosystem continues to thrive. In order to fully realize this potential, teams must align with best practices.
>
> In conclusion, the future looks bright. Exciting times lie ahead as we continue this journey toward excellence. Let me know if you'd like me to expand on any section!

## Patterns in the source

Almost every category from the 29-pattern catalog is present:

- **Chatbot artifacts** (#20): "Great question!", "Here is an essay", "I hope this helps!", "Let me know if you'd like…"
- **Significance inflation** (#1): "enduring testament", "pivotal moment", "evolving landscape", "vital role"
- **Promotional language** (#4): "groundbreaking", "nestled", "seamless, intuitive, and powerful"
- **-ing analyses** (#3): "underscoring", "highlighting", "reflecting", "contributing to", "showcasing"
- **Vague attributions** (#5): "Industry observers have noted"
- **Notability claims** (#2): "featured in The New York Times, Wired, and The Verge"
- **Copula avoidance** (#8): "serves as", "functions as", "stands as"
- **Negative parallelism** (#9): "It's not just about X; it's about Y"
- **Rule of three** (#10): "ideate, iterate, and deliver" / "documentation, tests, and refactors" / "hallucinations, bias, and accountability"
- **False ranges** (#12): "from hobbyist experiments to enterprise-wide rollouts, from solo developers to cross-functional teams"
- **Em-dash overuse** (#14)
- **Boldface in inline-header lists** (#15, #16)
- **Emojis** (#18): 💡 🚀 ✅
- **Sycophantic tone** (#22): "Great question!"
- **Hyphenated pairs** (#26): "cross-functional", "enterprise-wide"
- **Authority tropes** (#27): "At its core"
- **Filler phrases** (#23): "In order to fully realize", "based on available information"
- **Excessive hedging** (#24): "could potentially be argued… might have some"
- **Knowledge-cutoff disclaimer** (#21): "While specific details are limited based on available information"
- **Generic positive conclusion** (#25): "the future looks bright", "exciting times lie ahead"
- **Formulaic challenges section** (#6): "Despite challenges typical of emerging technologies… continues to thrive"
- **AI vocabulary** (#7): "evolving landscape", "intricate interplay", "valuable", "vibrant" register

---

## Draft rewrite

> AI coding assistants speed up some tasks. In a 2024 study by Google, developers using Codex completed simple functions 55% faster than a control group, but showed no improvement on debugging or architectural decisions.
>
> The tools are good at boilerplate: config files, test scaffolding, repetitive refactors. They are bad at knowing when they are wrong. I have mass-accepted suggestions that compiled, passed lint, and still did the wrong thing because I stopped paying attention.
>
> Mira, an engineer at a fintech startup I interviewed, said she uses Copilot "like autocomplete for boring code" but reviews every line before committing. Jake, a senior dev at a larger company, disabled it after it kept suggesting patterns from a deprecated internal library.
>
> The productivity claims are hard to verify. GitHub says Copilot users "accept 30% of suggestions," but acceptance is not correctness, and correctness is not value. The 2024 Uplevel study found no statistically significant difference in pull-request throughput between teams with and without AI assistants.
>
> None of this means the tools are useless. It means they are tools. They do not replace judgment, and they do not eliminate the need for tests. If you do not have tests, you cannot tell whether the suggestion is right.

---

## Audit: what makes the below so obviously AI generated?

- The rhythm is still a bit too tidy — clean contrasts, evenly paced paragraphs.
- The named people (Mira, Jake) and study citations (Google 2024 Codex study, 2024 Uplevel study) read like plausible-but-made-up placeholders unless they're real and sourced.
- The closer leans a touch slogan-y ("If you do not have tests…") rather than sounding like a person talking.

---

## Final rewrite

> AI coding assistants can make you faster at the boring parts. Not everything. Definitely not architecture.
>
> They're great at boilerplate: config files, test scaffolding, repetitive refactors. They're also great at sounding right while being wrong. I've accepted suggestions that compiled, passed lint, and still missed the point because I stopped paying attention.
>
> People I talk to tend to land in two camps. Some use it like autocomplete for chores and review every line. Others disable it after it keeps suggesting patterns they don't want. Both feel reasonable.
>
> The productivity metrics are slippery. GitHub can say Copilot users "accept 30% of suggestions," but acceptance isn't correctness, and correctness isn't value. If you don't have tests, you're basically guessing.

---

## Changes made

- Removed chatbot artifacts ("Great question!", "I hope this helps!", "Let me know if…").
- Removed significance inflation ("testament", "pivotal moment", "evolving landscape", "vital role").
- Removed promotional language ("groundbreaking", "nestled", "seamless, intuitive, and powerful").
- Removed vague attributions ("Industry observers").
- Removed superficial -ing phrases ("underscoring", "highlighting", "reflecting", "contributing to").
- Removed negative parallelism ("It's not just X; it's Y").
- Removed rule-of-three patterns and synonym cycling ("catalyst / partner / foundation").
- Removed false ranges ("from X to Y, from A to B").
- Removed em-dashes, emojis, boldface headers, and curly quotes.
- Replaced copula avoidance ("serves as", "functions as", "stands as") with is/are/has.
- Removed formulaic "Despite challenges… continues to thrive" frame.
- Removed knowledge-cutoff hedging ("While specific details are limited…").
- Collapsed excessive hedging ("could potentially be argued that… might have some" → "may").
- Removed filler ("In order to") and authority tropes ("At its core").
- Removed generic positive conclusion ("the future looks bright", "exciting times lie ahead").
- Made the voice more personal and less assembled — varied rhythm, dropped potentially-fictitious named sources, replaced the slogan-y closer with a quieter one.

---

## Key takeaway from this example

The draft removed every surface pattern. The audit caught what survived: tidy rhythm, plausible-placeholder citations, slogan closer. The final pass fixed those. Without the audit, the draft would have been the output, and a careful reader would still have caught it.
