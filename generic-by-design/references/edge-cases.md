# Edge cases

Patterns that look like leaks but are not, plus patterns that look fine but are.

## Concept-author attributions (DROP)

**Shape:** `"<author>'s <concept>"` — book-author surnames paired with the concepts they originated.

**Treatment:** drop the author, keep the concept name. The concept is industry-standard terminology; the author attribution is personal credit that adds nothing for readers who already know the concept and reads as exclusionary for readers who don't.

| Pattern shape                           | Drop / Keep                                           |
| --------------------------------------- | ----------------------------------------------------- |
| `"<Author>'s <concept-name>"`           | Drop `<Author>`; keep `<concept-name>`                |
| `"As <Author> predicts"`                | Drop or rephrase as `"as the heuristic predicts"`     |
| `"<Author>'s pattern"` (named pattern)  | Keep the named pattern; drop `<Author>'s`             |
| `<group-name>` for a pattern collection | Drop the group acronym; keep individual pattern names |

**Exception — genuine citation:** `"See <Author>'s book on X for the full treatment"` is a real cite-this-source line. Treat case-by-case; usually keep when it points to a specific book / paper / RFC.

The wordlist of concrete author surnames lives in `scripts/data/concept-authors.txt`. Edit to add the authors whose names you want the scanner to flag in your repo.

## Industry-standard names (KEEP)

Names that are public knowledge and don't anchor to any user / org. Categories:

- **Spec / standard names** — internet protocols (transport, security, identity), RFC numbers, format specs (data interchange, schema), API styles (REST / GraphQL / gRPC).
- **Architectural patterns** — naming patterns for code organization (MVC family), programming principles (acronyms like SOLID / DRY / YAGNI), branching strategies, application methodologies.
- **Open-source language / runtime / format names** — programming languages, runtimes, serialization formats, schema languages.
- **Public reference sites** — Wikipedia / RFC repository / IETF when cited as sources.

**Why kept:** these are knowledge, not stack assertions. They don't anchor on any author's choice; they're shared vocabulary.

## Open-source tools (case-by-case)

Open-source tool names sit between "industry-standard" and "vendor SaaS". The rule depends on context:

- **As a class member in a list** ("e.g., `<X>`, `<Y>`, `<Z>`") → **KEEP**.
- **As the topic of the artifact** (a `<X>`-config skill) → **KEEP**.
- **As the user's specific stack assertion** ("we use `<X>`") → **MASK**.

The same name can be either, depending on phrasing.

## Tool names that ARE the subject (KEEP)

If the artifact is _about_ a specific tool, the tool's name has to appear everywhere — that's not a leak.

Examples (using synthetic vendor names):

- `<X>-config` in an `<X>`-configuration skill that wires up `<X>`.
- `<X>` in a webhook-handler skill specifically for `<X>`.
- `<Y>` in a `<Y>`-fundamentals deck.
- A spec name in a setup skill _for that spec_.

The test: would removing the term make the artifact about a different topic? If yes, keep.

## Self-referential identifiers (KEEP)

A skill named `<skill-name>` mentions `<skill-name>` in its description, paths, and frontmatter. That's not a leak — it's the artifact's own name.

A skill that references its sibling skills (e.g., one CD skill says "pairs with the matching CI skill") is not a leak either; those are sibling references in a known repo.

## Trigger phrases in skill descriptions (KEEP, with judgment)

A skill description lists phrases the user might say to invoke it. Those are _trigger words_, not stack assertions:

```markdown
> Use whenever the user says "deploy our <X> ingress" or "scale our
> <Y> webhook handler" or any phrasing about ...
```

Generally **KEEP**. But if the trigger list is suspiciously specific to one stack (only one vendor / only one product / only one region), broaden it for inclusivity. Use the multi-option list pattern in the trigger phrases:

```markdown
> Use whenever the user says "deploy our ingress" / "deploy our
> ingress (e.g., <X> / <Y> / <Z>)" or "scale our payments-webhook
> handler" or ...
```

## Hardcoded numbers — when to mask

Not every hardcoded number is a fingerprint:

| Number type                           | Treatment        | Reason                                                          |
| ------------------------------------- | ---------------- | --------------------------------------------------------------- |
| Standard ports (`8080`, `3000`)       | KEEP             | Standard ports for HTTP-alt / dev servers; not org-specific     |
| Standard timeouts (`30s`)             | KEEP             | Standard-ish defaults                                           |
| Generic version numbers               | KEEP             | Generic semver / API versions                                   |
| Specific cluster sizes                | MASK             | Reveals user's actual cluster shape                             |
| Cluster names (`prod`, `staging`)     | KEEP if generic  | "prod" is generic; specific internal names mask                 |
| Replica counts                        | MASK if uncommon | Round numbers (3, 5, 10) are fine; unusual specifics suspicious |
| Specific public IPs                   | MASK             | Use RFC-5737 reserved range                                     |
| Generic app names (`myapp`, `webapp`) | KEEP             | Generic stand-in                                                |
| Specific internal service names       | MASK             | Reveals real internal service                                   |

## Region names — the canonical anti-pattern asymmetry

The universally-recognized "don't hardcode this" example region — the one most teams use as the textbook anti-pattern — can **stay** in pedagogical contexts ("don't hardcode this region"). It's so widely-known that using it in teaching is genericness, not leak.

A region matching the **user's actual cloud** is the OPPOSITE — even in anti-pattern teaching, it anchors on the user. Mask or rotate to a different cloud's region.

The asymmetry exists because the canonical example is everyone's first deploy; the user's region is specific to their environment.

## Comments and docstrings

Code comments and docstrings can leak too:

```python
# Author: <name>
# Internal use only — see <internal-link>
# Originally by <upstream-author> on <date>
```

All three are leaks. Drop the author / link / attribution lines.

## Git commit history (out of scope)

This skill scrubs the _content_ of files. It does NOT scrub git commit history (author names, commit messages, co-authored-by lines). For history scrubbing, the user needs `git filter-repo` or BFG-Repo-Cleaner — that's a different task.

When publishing a forked skill, the right move is usually to start fresh: `rm -rf .git && git init`. That avoids history-scrubbing entirely.

## Configuration values that look generic but aren't

```yaml
api_url: https://api.example.com
api_key: ${API_KEY} # generic, fine
team_id: 7301 # specific to one org — leak
project_id: prod-platform-2024 # internal codename — leak
```

Even when YAML uses placeholders for secrets, hardcoded IDs / names that aren't placeholders can leak.

## Test fixtures

Test fixtures often contain real-looking data:

```javascript
const fixtures = [
  { id: 1, email: "<real-name>@<actual-company>.com", role: "admin" },
];
```

Replace email domains with `example.com`, names with generic ("alice", "bob"), and IDs with sequential / round numbers.

## Visual assets

Screenshots, diagrams, and slide images can leak more than text — internal cluster names, dashboard URLs visible in browser bars, real customer names in test data, employee names in chat screenshots.

The text scanner can't catch these. When scrubbing an artifact with images, ask the user to verify each visual asset is generic.
