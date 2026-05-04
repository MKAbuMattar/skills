# Decision matrix

For every fingerprint hit, decide: **keep** (legitimate use) or **mask** (leak). The answer depends on the _role_ the term plays in the surrounding context, not just the term itself.

## The four contexts

A vendor / region / brand name appears in one of four contexts:

1. **Inclusive list** — listed alongside multiple alternatives.
2. **Illustrative example** — shown as one example of a class.
3. **Stack assertion** — declared as the user's choice.
4. **Subject of the artifact** — what the artifact is about.

The first two are **keep**. The third is **mask**. The fourth is **keep**.

## Decision tree

For each hit:

```
Is this a list of multiple alternatives that the consumer picks from?
├── YES → KEEP. Verify the list is genuinely inclusive (≥ 3 items) and the
│         user's stack isn't first / featured.
└── NO → continue

Is this an illustrative example of a class?
├── YES (phrased as "e.g., X, Y, Z" / "for example X" / "X / Y / Z" inline) → KEEP.
└── NO → continue

Is this the actual subject of the artifact?
├── YES (e.g., a vendor-X-webhooks skill that names vendor X) → KEEP.
└── NO → continue

Does the surrounding text claim, imply, or anchor on the user's stack?
├── YES ("we use X", "our X", "runs on X", region defaults, hardcoded URLs) → MASK.
└── NO → review case-by-case (default to MASK if unsure).
```

## Worked examples (using synthetic Acme-themed scenarios)

The synthetic vendor names below — Acme, FrontEdge, Cumulus, PayLink, Bastion — are fictional. They demonstrate the patterns without anchoring to any real vendor.

### KEEP examples

```markdown
> Works with any cloud provider — <Cloud-A>, <Cloud-B>, <Cloud-C>,
> <Cloud-D>, <Cloud-E>, <Cloud-F>, and community providers.
```

**Verdict:** keep. Inclusive list of 7+ providers; no single one is featured.

```markdown
> The ingress controller (e.g., <Ingress-A>, <Ingress-B>, <Ingress-C>)
> handles external HTTPS routing.
```

**Verdict:** keep. "e.g." marks it as illustrative.

```markdown
> Use this skill when the user mentions payments-provider webhooks,
> SMS-gateway integrations, or other third-party API integrations.
```

**Verdict:** keep. These are trigger phrases, not stack assertions.

```markdown
> # PayLink Webhook Handler
>
> A typed webhook handler for PayLink events.
```

**Verdict:** keep. PayLink (synthetic) is the subject of the skill — by the test "would removing the term make the artifact about a different topic?", yes; so keep.

### MASK examples

```markdown
> Our setup — Cumulus compute + managed Kubernetes + Acme Container Registry.
```

**Verdict:** mask. Stack assertion. → "Our setup — `<Cloud Provider>` compute + managed Kubernetes + container registry."

```markdown
> We run Bastion as our ingress controller; it handles 28 ingresses.
```

**Verdict:** mask. "We run" + brand = stack assertion. → "We run an ingress controller; it handles 28 ingresses."

```hcl
default = "ab-north-4"
```

**Verdict:** mask. Hardcoded user's region. → `default = null` (let the provider win) or `default = "<region>"`.

```javascript
const REGISTRY = "registry.ab-north-4.cumulus.example/acme";
```

**Verdict:** mask. Hardcoded user's registry URL. → `const REGISTRY = "registry.example.com/<your-org>";`

```markdown
> ## Heavyweight variant (the original <Author>'s recipe)
```

**Verdict:** mask. Source-author attribution. → "## Heavyweight variant"

```markdown
> Based on <Author>'s "Design It Twice" heuristic.
```

**Verdict:** mask. Concept-author attribution. → 'Based on the "Design It Twice" heuristic.'

## Edge case: the term IS the leak AND the subject

A skill _about_ PayLink-specific tooling needs PayLink everywhere. That's not a leak — it's the topic. But the skill still shouldn't hardcode the user's specific PayLink account, region, or webhook URLs; those are leaks **within** the topic.

Same rule applies: mask the user-specific details (account ID, region, webhook host) but keep the topic-level mentions.

## Edge case: the team's actual scale

`"22 namespaces, 92 pods, 7 ingress replicas"` reveals the user's actual cluster shape. Even if it's just numbers, it's a fingerprint. Mask:

- Drop the specifics: "many namespaces and pods".
- Use placeholders: "`<N>` namespaces, `<M>` pods".
- Rotate to obviously-synthetic round numbers: "10 namespaces, 100 pods".

Synthetic round numbers (10 / 100 / 1000) are clearly examples, not user's actual data. Real-looking numbers (22 / 92 / 7) feel like data and are fingerprints.

## Edge case: anti-pattern teaching uses real names

```markdown
> Hardcoded defaults like `"<canonical-region>"` leak organizational choices.
```

**Verdict:** keep when `<canonical-region>` is the universally-known "don't hardcode this" example region — the textbook anti-pattern that's recognized across teams.

```markdown
> Hardcoded defaults like `"<author-stack-region>"` leak organizational choices.
```

**Verdict:** mask when the region matches the user's actual cloud — even in anti-pattern teaching, it anchors on the user's environment. Replace with a different cloud's region or use a multi-cloud illustration.

## Edge case: trigger phrases vs stack assertions

A skill description's trigger list is a list of phrases the user might _say_:

```markdown
> Use whenever the user says "stress-test our <Vendor> setup" or
> "make our <X> integration generic".
```

Generally **keep**. These are user _trigger phrases_, not the skill claiming the vendor is the user's stack.

But if the trigger list is suspiciously specific to one stack (only one vendor / only one ingress / only one payments product), broaden it: "stress-test our cloud setup", "make our ingress generic".

## When in doubt

Default to **mask**. The cost of an over-cautious mask is low (a slightly more abstract example). The cost of leaving a leak is high (the artifact is no longer shareable).

But never silently mask the topic of the artifact. If you're about to mask a vendor name in a skill ABOUT that vendor, stop and re-read.
