# Pattern catalog

The fingerprint patterns the scanner detects, described by **shape** rather than by specific brand or author names. The actual concrete names live in `scripts/data/*.txt` wordlists — edit those to fit your repo. The shapes below stay constant.

## Cloud-vendor regions

**Shape:** `<two-or-three-letter-prefix>-<direction-or-zone>-<digit>` — usually 2-3 segments separated by hyphens.

**Example shapes:** `<aa>-<dir>-<n>`, `<bb>-<region>-<n>`.

**Where it leaks:**

- Hardcoded as a default in module variables.
- Embedded in registry / API URLs.
- Listed as the user's primary region.

**Replacement:**

- Placeholder: `<region>`.
- Or rotate to a different cloud's canonical region (a region not matching the author's actual cloud).
- Or `null` (let the provider-level default apply).

**Special case (asymmetry):** the canonical "don't hardcode this" example region — the universally-known one most people use as the textbook anti-pattern — can **stay in pedagogical contexts** (`"don't hardcode this region"`). A region matching the user's actual cloud is a leak **even** in anti-pattern context — replace.

## Vendor SaaS as user's stack

**Shape:** branded SaaS product name appearing as the user's chosen stack — phrased as `"We use <X>"`, `"our <X>"`, `"<X> handles our Y"`, or hardcoded as a default integration.

**Categories of vendor SaaS to scan for:** payments, SMS / messaging, email, CDN / edge, ingress controllers, CD platforms, feature flags, observability / APM, monitoring, on-call rotation, GitOps controllers, CI systems, identity providers, secrets managers.

**Distinguishing rule:**

- If the artifact is _configuring_ one of these (e.g., a payments-provider webhook handler), the brand stays — that's the subject.
- If the artifact is _citing_ one (e.g., "we use `<vendor-saas>` for billing" inside an architecture doc), replace.

**Replacement:**

- Generic role name: `"the payments provider"`, `"the CDN"`, `"the ingress controller"`, `"the observability platform"`.
- Multi-option illustrative list: `"a CDN (e.g., <vendor-A>, <vendor-B>, <vendor-C>)"`.

The wordlist of concrete vendor names lives in `scripts/data/vendor-saas.txt`.

## Cloud-vendor service abbreviations

**Shape:** 2-4 letter all-caps abbreviation that names a specific cloud's service (e.g., a vendor's container registry, managed Kubernetes, object storage, compute).

**Distinguishing rule:**

- An abbreviation paired with its parent cloud in an inclusive list (e.g., a Terraform-providers list) is fine.
- An abbreviation used as if it's the only option ("our images live in `<ABBR>`") is a leak.

**Replacement:**

- Generic role: `"container registry"`, `"managed Kubernetes"`, `"object storage"`, `"compute"`, `"load balancer"`, `"managed SQL database"`.

The wordlist of concrete abbreviations lives in `scripts/data/cloud-abbreviations.txt`.

## Hardcoded vendor URLs

**Shape:** any host pattern naming a specific vendor — `<host>.<vendor-domain>.<tld>/<path>`, vendor-help-doc URLs, internal Git hosts (`gitlab.<company>.com`), Slack / Atlassian workspace URLs.

**Replacement:**

- Use **RFC-2606** reserved domains: `example.com`, `example.org`, `example.net`.
- Container registry: `registry.example.com/<your-org>/<image>:<tag>`.
- Help docs: `https://example.com/docs/<service>`.
- Org workspace: `<your-org>.example.com`.

**Never use realistic-looking fake URLs that match real vendors** — that's just shifting the leak.

## Source-skill author attributions

**Shape:** any reference in a forked / adapted artifact to the upstream skill's author or repo:

- `"the <author>'s recipe"`.
- `"adapted from <author>/<repo>"`.
- `"based on <author>/<repo>"`.
- `upstream: <author>/<repo>` in YAML frontmatter.
- `Co-Authored-By:` lines in commit messages of forked content.
- `"Inspired by <author>'s pattern"`.

**Rule:** always drop. The artifact is now under the current author's name; carrying forward an attribution from a source you forked is unearned credit.

The wordlist of concrete usernames lives in `scripts/data/source-authors.txt` (initially empty — fill in your own fork sources).

## Concept-author attributions

**Shape:** `"<author>'s <concept>"` — book-author surnames paired with the concepts they originated.

**Rule:** drop the author, keep the concept name. The concept is industry-standard terminology; the author name is personal credit that doesn't add information for readers who already know the concept and feels exclusionary to readers who don't.

**Examples of the shape (synthetic):**

- `"<Author>'s deep modules"` → `"deep modules"`.
- `"<Author>'s seam"` → `"seam"`.
- `"<Author>'s pattern X"` → `"pattern X"`.
- `"As <Author> predicted"` → drop or `"as the heuristic predicts"`.

**Exception — genuine citation:** `"See <Author>'s book on X for the full treatment"` is a real cite-this-source line. Treat case-by-case; usually keep when it points to a specific book / paper / RFC.

The wordlist of concrete author surnames lives in `scripts/data/concept-authors.txt`.

## Org / company names

**Shape:** any unique word that identifies the user's org — company name, internal team names, internal project codenames, Slack workspace handle, domain fragment, internal repo slug.

**Replacement:**

- `<your-org>` (placeholder).
- `acme` (the canonical fictional company).
- Drop entirely if the detail isn't load-bearing.

**Note:** Generic role descriptors like "platform team" / "backend team" are _not_ leaks. Specific names are.

The wordlist of concrete org names lives in `scripts/data/org-names.txt` (initially empty — fill in your own).

## Internal filesystem paths

**Shape:** absolute paths revealing the user's machine / username / repo structure.

- `/home/<username>/Work/<repo>/...`
- `/Users/<username>/Documents/...`
- `C:\Users\<username>\...`

**Replacement:**

- Drop entirely (the absolute path was rarely useful to the reader).
- Or convert to relative path (`<repo-root>/...`).

## Stack-specific assertions

**Shape:** sentences that name the user's exact stack — `"Our setup — <Cloud> + <K8s service> + <Registry>"`, `"Internet → <CDN> → <Cloud edge> → <Ingress> → Service"`, `"We run <X> as our Y"`, `"Already running on <A>, <B>, and <C> in our cluster"`.

**Replacement pattern:**

- Replace each branded name with its generic role.
- Wrap the cloud in `<Cloud Provider>` placeholder.
- For traffic-flow descriptions: `"Internet → CDN → cloud edge → ingress controller → Service → Pods"`.

## Hardcoded scale / fingerprint numbers

**Shape:** specific numbers that reveal the user's actual environment shape:

- `"<N> namespaces, <M> pods"` with non-round numbers.
- Specific replica counts of unusual size.
- Real cluster IPs (specific `10.x.y.z` outside the documentation-reserved ranges).
- Real ages / uptimes (`50d`, `26d`).
- Real OS / version / kernel strings from the user's actual machines.

**Replacement:**

- Drop the specifics.
- `<N>`-style placeholders.
- Round / synthetic numbers (10 / 100 / 1000) that are obviously fake.
- For IPs: use **RFC-5737** reserved ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`).

## Common false positives

The scanner will flag these — they are typically **not** leaks:

- **Provider names in inclusive lists** ("supports `<A>` / `<B>` / `<C>` / `<D>`") — keep, intentional.
- **Tool names in alternative-list examples** ("e.g., `<X>`, `<Y>`, `<Z>`") — keep, illustrative.
- **Industry-standard names referenced for what they ARE** — spec names, RFC numbers, architectural patterns. Keep.
- **Trigger words in skill descriptions** — phrases the user might say to invoke the skill, not stack assertions.
- **The subject of the artifact** — if the skill IS about `<X>`, "<X>" everywhere is fine.
- **Standard libraries / open-source tools that aren't org-specific** — language ecosystem libraries are generic, not leaks.

See `decision-matrix.md` for the full triage logic.
