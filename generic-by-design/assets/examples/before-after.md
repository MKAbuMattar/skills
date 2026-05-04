# Worked examples: before → after

Seven worked examples demonstrating each leak shape. The "before" half uses **synthetic vendor names** (Acme, FrontEdge, Cumulus, PayLink, Bastion) — no real vendors, no real authors, no real cloud regions. The patterns and replacements are real; only the names are fictional.

---

## Example 1: hardcoded vendor registry URL

### Before

```javascript
// demo.js (kubectl simulator)
{
  run: "kubectl set image deploy/api api=registry.ab-north-4.cumulus.example/acme/api:v1.4.3 -n backend"
},
```

The host `registry.ab-north-4.cumulus.example` reveals the vendor (`cumulus.example`), the region (`ab-north-4`), and the org (`acme`).

### Verdict

MASK. The hostname tells anyone reading the code which cloud, which region, and which organization.

### After

```javascript
{
  run: "kubectl set image deploy/api api=registry.example.com/<your-org>/api:v1.4.3 -n backend"
},
```

### Pattern

Replace any cloud-vendor registry hostname with `registry.example.com`. RFC-2606 reserves `example.com` for documentation, so it can never accidentally route to a real registry. Keep `<your-org>` as a literal placeholder for the consumer to fill in.

---

## Example 2: source-skill author attribution

### Before

```markdown
## Heavyweight variant (the original Frodo's recipe)

If the user opted into the original Frodo's recipe (typecheck + test on commit), use:

\`\`\`bash
npx lint-staged
npm run typecheck
npm run test
\`\`\`
```

`Frodo` here is a synthetic stand-in for "the source-skill author whose work was forked".

### Verdict

MASK. Source-skill author names are unearned credit once the artifact is under the current author's name.

### After

```markdown
## Heavyweight variant

If the user opted into the heavyweight variant (typecheck + test on commit), use:

\`\`\`bash
npx lint-staged
npm run typecheck
npm run test
\`\`\`
```

### Pattern

Drop the attribution entirely. Replace with a descriptive label ("the heavyweight variant") if the original wording referred to the recipe by author.

---

## Example 3: stack-assertion in HTML slide

### Before

```html
<strong>Our setup</strong> — Cumulus Compute + CCK + Acme Container Registry
```

Where `Cumulus` is the synthetic cloud vendor, `CCK` is its synthetic Kubernetes-service abbreviation, and `Acme Container Registry` is the synthetic registry product.

### Verdict

MASK. "Our setup" + specific cloud + specific service abbreviations is a textbook stack assertion. The reader learns the user's exact cloud, compute service, K8s offering, and registry.

### After

```html
<strong>Our setup</strong> — &lt;Cloud Provider&gt; compute + managed Kubernetes
+ container registry
```

### Pattern

Replace branded service names with their generic role. `&lt;Cloud Provider&gt;` because HTML interprets `<...>` as a tag — escape with HTML entities. Service abbreviations become role names (compute, managed Kubernetes, container registry).

---

## Example 4: code-level identifier rename across files

### Before

`scenes.js`:

```javascript
const STAGES = [
  { name: "internet", x: -10.5, color: 0xffffff },
  { name: "frontedge", x: -7.0, color: 0xf38020 },
  { name: "cumulus", x: -3.5, color: 0xc7000b },
  { name: "bastion", x: 0.0, color: 0x002fa7 },
  { name: "service", x: 3.5, color: 0x22d3ee },
  { name: "pods", x: 7.5, color: 0x60a5fa },
];

// ... later in the same file ...
counters.cumulus += 1;
ud.target = stations.bastion.group.position;
```

`presentation.js`:

```javascript
toast.textContent = `Round-trip path: in via Bastion, out via Bastion`;
const stats = { bastion: "many pods", ... };
```

`index.html`:

```html
<button class="ns-btn" data-ns="bastion">bastion · 7</button>
```

`FrontEdge` (synthetic CDN), `Cumulus` (synthetic cloud), and `Bastion` (synthetic ingress) all stand in for the user's real branded stack.

### Verdict

MASK. Variable names anchor on a specific edge stack. Renaming requires consistency across `scenes.js`, `presentation.js`, and `index.html` — every reference to the variable / data attribute / DOM key has to update together.

### After

All three files, after coordinated rename:

`scenes.js`:

```javascript
const STAGES = [
  { name: "internet", x: -10.5, color: 0xffffff },
  { name: "cdn", x: -7.0, color: 0xf38020 },
  { name: "cloud", x: -3.5, color: 0xc7000b },
  { name: "ingress", x: 0.0, color: 0x002fa7 },
  { name: "service", x: 3.5, color: 0x22d3ee },
  { name: "pods", x: 7.5, color: 0x60a5fa },
];

counters.cloud += 1;
ud.target = stations.ingress.group.position;
```

`presentation.js`:

```javascript
toast.textContent = `Round-trip path: in via ingress, out via ingress`;
const stats = { ingress: "many pods", ... };
```

`index.html`:

```html
<button class="ns-btn" data-ns="ingress">ingress · many</button>
```

### Pattern

Coordinated rename across files. Use a global replace per file with the exact identifier. Re-run any validators / linters after the rename to catch missed call sites.

---

## Example 5: concept-author attribution (drop the author, keep the concept)

### Before

```markdown
Surface architectural friction in a codebase and propose **deepening
opportunities** — refactors that turn shallow modules into deep ones
(<Author-A>) by relocating their seams (<Author-B>).
```

Where `<Author-A>` and `<Author-B>` stand in for two book authors whose names the writer felt obliged to credit for the concepts they originated.

### Verdict

MASK both author attributions. The concepts ("deep modules", "seams") are industry-standard terms — keep them. The author attributions are personal credits — drop them.

### After

```markdown
Surface architectural friction in a codebase and propose **deepening
opportunities** — refactors that turn shallow modules into deep ones
by relocating their seams.
```

### Pattern

Drop the author parenthetical. The concept name carries the meaning; the author name only works for readers who already know the source — and those readers don't need the credit either.

---

## Example 6 (KEEP): provider list in a Terraform skill

### Source

```markdown
Works with any Terraform provider — `<Cloud-A>`, `<Cloud-B>`, `<Cloud-C>`,
`<Cloud-D>`, `<Cloud-E>`, `<Cloud-F>`, `<Cloud-G>`, and community providers.
```

### Verdict

**KEEP.** This is an inclusive list of 7+ providers, presented as options for the consumer. No single one is featured. The listing is the whole point — a multi-provider skill needs to name the providers it supports.

In the real artifact this would be replaced with actual provider names — those are public and listing all of them inclusively is the generic-by-design pattern.

### Lesson

Inclusive lists are not leaks. The leak shape is "we use `<X>`" (singular, declarative). The keep shape is "supports `<A>` / `<B>` / `<C>` / ..." (plural, inclusive).

---

## Example 7 (KEEP): trigger phrase in a skill description

### Source

```markdown
description: Use this skill whenever the user says "deploy our `<X>` ingress",
"scale our `<Y>` webhook handler", or any phrasing about infrastructure changes.
```

### Verdict

**KEEP** (with judgment). These are user _trigger phrases_ — phrases the user might say to invoke the skill — not the skill claiming `<X>` / `<Y>` are the user's stack.

### When to mask anyway

If the trigger list is suspiciously specific to one stack (only one ingress vendor / only one payments product), broaden it for inclusivity:

```markdown
description: Use this skill whenever the user says "deploy our ingress"
(any ingress controller — `<X>` / `<Y>` / `<Z>`), "scale our webhook
handler", or any phrasing about infrastructure changes.
```

The first form anchors on a specific stack as if it's THE stack. The broadened form lists alternatives, signaling generic relevance.

---

## Summary table

| Example | Pattern shape                              | Verdict                                      |
| ------- | ------------------------------------------ | -------------------------------------------- |
| 1       | `<host>.<region>.<vendor>.<tld>/<org>/...` | MASK → `registry.example.com/<your-org>/...` |
| 2       | `"the original <author>'s recipe"`         | MASK → drop attribution                      |
| 3       | `Our setup — <Cloud> X + Y + Z`            | MASK → generic role names                    |
| 4       | Cross-file vendor-named variables          | MASK → coordinated rename to role names      |
| 5       | `(<Author>)` next to a concept name        | MASK → drop authors, keep concepts           |
| 6       | `<A>`, `<B>`, `<C>`, ... inclusive list    | KEEP → multi-provider listing                |
| 7       | trigger phrases naming `<X>` / `<Y>`       | KEEP (with judgment)                         |

The synthetic names (Acme, FrontEdge, Cumulus, PayLink, Bastion, Frodo, Author-A/B) demonstrate the patterns without anchoring this skill to any specific real fork history or author bookshelf.
