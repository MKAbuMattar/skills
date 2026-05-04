---
name: generic-by-design
description: Scrub a skill, template, README, or code repo for organization-specific fingerprints — internal cloud regions, branded SaaS products asserted as the user's stack, proprietary cloud-service abbreviations, hardcoded vendor URLs, source-skill author attributions, concept-author attributions, org / company names, internal filesystem paths, stack-specific assertions ('our setup uses X'), and hardcoded scale fingerprints — and replace each with a generic placeholder, role name, or multi-option illustrative list. Use whenever the user says 'generic-by-design okay', 'scrub the proprietary refs', 'mask the org leaks', 'make this generic', 'check for fingerprints', 'anonymize this template', or any phrasing about turning org-specific content into reusable artifacts. Ships a configurable fingerprint scanner (wordlists in scripts/data/), a pattern catalog, a decision matrix, placeholder conventions, and synthetic worked examples.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Generic by Design

Scan an artifact for organization-specific fingerprints, decide which are leaks vs. legitimate references, then mask the leaks with generic placeholders or multi-option illustrative lists. The goal: anyone can install / fork / read the artifact without learning the original author's stack, history, or environment.

## When to use

- The user says "generic-by-design okay" — the canonical trigger.
- The user pasted content (skill, template, README, blog post, code) lifted from a private repo and wants it sharable.
- The user is publishing a skill or library and asks to "make sure no internal stuff leaks".
- A scaffolded template has hardcoded values from the original cloud / vendor / org.
- A new skill was built by adapting an existing one and the source author's name appears in the credits.

Skip this skill for: code that genuinely needs the proprietary references (internal-only docs, runbooks for a specific environment), or for tool-name lists that are inclusive-by-design (a multi-provider list is intentional, not a leak).

## How this skill is itself generic-by-design

The skill **content** (SKILL.md, references/, examples/) describes patterns abstractly — using placeholder shapes (`<vendor-saas>`, `<cloud-region>`, `<source-author>`) and synthetic worked-example names (Acme, FrontEdge, Cumulus, PayLink) — never concrete real vendor or author names that would anchor on the author's history.

The scanner's **wordlists** of concrete patterns live in [`scripts/data/*.txt`](scripts/data/) — tool data, separated from skill content, the way a spell checker has a dictionary file. Users edit those wordlists to add their own org-specific patterns; the markdown content stays abstract.

If you run the scanner against this skill itself, it reports ~27 hits in markdown — **all are teaching content**: the literal phrases the catalog *describes* (e.g., `"we use X"` quoted as an example of a stack-assertion shape), synthetic placeholder examples (`ab-north-4`, `Bastion`, `Acme`), RFC-reserved IP ranges in placeholder docs, and the regex patterns in the scanner script. The triage rule: **keep** every hit whose surrounding context is "here is an example of what to look for" rather than "this is what we use". A grep for any real cloud / vendor / author / region name across the skill markdown returns zero hits.

## Fingerprint categories

The patterns the scanner catches and the agent reasons about. See `references/pattern-catalog.md` for shapes and canonical replacements.

| Category                          | Example shape                                          | Generic replacement                              |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| Internal cloud region             | `<two-letter>-<direction>-<digit>` hardcoded           | `<region>` or rotate to a non-author region      |
| Vendor SaaS as user's stack       | `"We use <vendor-saas>"`, `"runs on <vendor-cdn>"`     | role name + multi-option list                    |
| Cloud-vendor service abbreviation | 2-3-letter cloud-specific abbreviation in user's stack | generic role (`container registry`, `K8s`, …)    |
| Hardcoded vendor URL              | `<host>.<vendor-domain>.<tld>/<your-org>/...`          | `registry.example.com/<your-org>/...`            |
| Source-skill author attribution   | `"the <author>'s recipe"`, `<author>/<repo>` upstream  | drop entirely or use a descriptive label         |
| Concept-author attribution        | `"<author>'s <concept>"`                               | drop the author; keep the concept name           |
| Org / company name                | unique word identifying the user's org                 | `<your-org>` / `acme`                            |
| Internal filesystem path          | `/home/<user>/Work/<repo>/...`                         | drop, or use relative path                       |
| Stack-specific assertion          | `"Our setup — <vendor-cloud> X + Y + Z"`               | role names + `<Cloud Provider>` placeholder      |
| Hardcoded scale / fingerprint     | unusual specific numbers (`92 pods`, `7 replicas`)     | drop, use `<N>`, or rotate to round numbers      |

## Workflow

1. **Confirm the target.** A single file, a skill directory, or a whole repo. Get an explicit path.
2. **Scan.** `bash scripts/scan-fingerprints.sh <path>`. The script loads its wordlists from `scripts/data/` and reports hits by category with line numbers. Load `references/pattern-catalog.md` for shape descriptions if a hit category is unfamiliar.
3. **Triage.** For every hit, decide: **leak** (mask) or **legitimate** (keep). Load `references/decision-matrix.md` for the keep-vs-mask rules. Common keepers: tool names in inclusive lists, tool names in illustrative `e.g.` examples, industry-standard concept names, and tool names that are the actual subject of the artifact.
4. **Replace.** Apply the canonical replacement from the pattern catalog. Load `references/replacement-conventions.md` for placeholder shapes (`<placeholder>`, `example.com`, `<your-org>`). Where many sites share the same leak, prefer a global replace; where context varies, do targeted edits.
5. **Re-scan.** Aim for zero unintentional hits.
6. **Re-validate the artifact.** If it has its own validator (skill, module, script), re-run it. Replacements often touch variable names, regex patterns, file paths — make sure nothing broke.
7. **Report.** Tell the user: how many hits, which categories, what was kept (and why), what was masked.

## Customizing the scanner

Each wordlist in `scripts/data/` is a plain-text file, one pattern per line, `#` for comments. Add or remove entries to fit your repo:

- `scripts/data/vendor-saas.txt` — branded SaaS products (payments, SMS, CDN, ingress, observability, …).
- `scripts/data/cloud-abbreviations.txt` — 2-3-letter cloud service codes that are vendor-specific.
- `scripts/data/source-authors.txt` — usernames / handles you've forked from. Initially empty; fill in your own.
- `scripts/data/concept-authors.txt` — book-author surnames whose work you cite.
- `scripts/data/org-names.txt` — your org / internal codenames. Initially empty; fill in your own.

The scanner also uses structural regexes (region-shape, URL-shape, internal-path-shape) that don't need any wordlist.

## Available resources

- `references/pattern-catalog.md` — fingerprint pattern shapes with synthetic example values and canonical replacements. Use during triage when a category needs deeper guidance.
- `references/decision-matrix.md` — keep-vs-mask decision tree with synthetic Acme-themed worked examples covering the four contexts (inclusive list / illustrative example / stack assertion / subject of the artifact).
- `references/replacement-conventions.md` — placeholder naming (`<cloud-provider>`, `registry.example.com`, `<your-org>`, `<region>`), RFC-2606 reserved domains, RFC-5737 reserved IPs, generic role names, multi-option list format.
- `references/edge-cases.md` — concept-author attribution rule, industry-standard names that stay, self-referential cases, hardcoded-numbers nuance, region-name asymmetry, comments / docstrings, git history (out of scope), test fixtures, visual assets (scanner can't catch).
- `assets/examples/before-after.md` — synthetic worked examples (Acme + fictional vendor names) demonstrating each leak shape and its fix.
- `scripts/scan-fingerprints.sh` — wordlist + structural regex scanner with line-numbered output, color, and exit code 1 when leaks are found.
- `scripts/data/*.txt` — tool-data wordlists; edit to fit your repo's history and stack.

## Top gotchas (always inline — do not skip)

- **Inclusive lists are not leaks.** A multi-provider listing of supported targets is generic-by-design — the leak shape is picking *one* and asserting "we use X". Same for "ingress controllers (e.g., A, B, C)" as illustrative examples.
- **The scanner is a starting point, not a verdict.** It will flag legitimate uses. The triage step is where the judgment lives.
- **Variable / identifier renames must be consistent across files.** Renaming a JS variable in one file but not the matching CSS / HTML / config breaks the artifact. Use the artifact's validator to catch breakage.
- **Industry-standard concept names usually stay.** Spec names, RFC numbers, architectural patterns are public knowledge, not org leaks. The exception is **concept-author attributions** ("`<author>`'s `<concept>`") — drop the author, keep the concept.
- **Source-skill author attributions always go.** "Adapted from `<upstream>`/`<repo>`" in a forked artifact is unearned credit once the artifact is under the current author's name.
- **Hardcoded test data leaks scale.** Specific cluster numbers (`<N> namespaces, <M> pods`) reveal the user's actual environment shape. Drop, replace with `<N>`-style placeholders, or rotate to round numbers (10 / 100) that are obviously synthetic.
- **Region names get an asymmetry rule.** Canonical anti-pattern examples (the most-known cloud region) can stay in pedagogical "don't hardcode this" contexts. User-stack regions (the region matching the author's actual cloud) leak even in anti-pattern context — replace.
- **`example.com` and `<placeholder>` are the canonical shapes.** Don't invent your own. RFC-2606 reserves `example.com` / `example.org` / `example.net` for documentation; RFC-5737 reserves IP ranges. Use them.
- **Don't strip mentions in skill descriptions of triggers.** A skill description that lists trigger phrases the user might say is fine — those are *trigger words for relevance*, not stack assertions.
- **The `<` and `>` in placeholders need HTML-escaping in HTML files.** `<placeholder>` in markdown / code = literal angle brackets. In HTML, `&lt;placeholder&gt;` so the browser renders the brackets instead of treating them as a tag.
- **Re-running the artifact's validator after the cleanup is non-negotiable.** Replacements often touch variable names, regex patterns, file paths. Confirm the artifact still validates / runs / passes tests before declaring done.

## What you DO

1. Run `scripts/scan-fingerprints.sh <path>` first; do not start editing blind.
2. Triage every hit — keep or mask, with a one-line reason for each kept hit.
3. Apply replacements from `references/pattern-catalog.md`; do not invent ad-hoc replacements when a canonical one exists.
4. Use a global replace for safe substitutions (e.g., one URL appearing in many files); use targeted edits where context varies.
5. Rename identifiers consistently across all files in the artifact (HTML, JS, CSS, configs).
6. Re-scan after editing; the goal is zero unintentional hits.
7. Re-run the artifact's own validator (skill validator, terraform validate, eslint, tests) after the scrub.
8. Report the count + categories + kept-with-reason at the end.

## What you do NOT do

- Mask tool names that appear in inclusive listings — those are intentional.
- Mask concept names that the artifact is explicitly about (the subject's name has to appear).
- Strip legitimate trigger phrases from skill descriptions.
- Replace canonical anti-pattern region examples in pedagogical "don't hardcode this" contexts.
- Replace hardcoded numbers with placeholders if the numbers are illustrative defaults (port 8080, timeout 30s); only mask numbers that fingerprint the user's actual scale.
- Invent new placeholder shapes; use the conventions in `replacement-conventions.md`.
- Touch the artifact's logic without re-running its validator.
- Forget to rename identifiers in every file (renaming a JS variable but missing a CSS class will break the artifact).
- Add inline ignore comments to the scanner; the triage step lives in the conversation, not in markup.
- Add concrete vendor / author names to the skill's own markdown — that's the recursion this skill is meant to prevent. Concrete patterns belong in `scripts/data/*.txt`.
