# Information Architecture: <Product / Feature Name>

> Generated: <YYYY-MM-DD>
> Source: <path to brief or "Captured from user interview">

## Site Map

A hierarchical map of every page or view. Use indentation to show nesting. Include the URL pattern for each.

- Home `/`
  - <Section A> `/section-a`
    - <Sub-page> `/section-a/<slug>`
  - <Section B> `/section-b`
- <Top-level area> `/area`
  - <Sub-area> `/area/sub`

## Navigation Model

| Layer | Items | Notes |
| --- | --- | --- |
| **Primary** | <items in the main nav (max ~7)> | Visible everywhere |
| **Secondary** | <sidebar / tabs / contextual links within sections> | Per-section |
| **Utility** | <account / settings / help / sign-out> | Outside the main hierarchy |
| **Mobile** | <how nav adapts: hamburger, bottom-tabs, off-canvas, ...> | Adaptation rule |

## Content Hierarchy

Per major page/view, list content in priority order with rationale.

### <Page name>

1. **<Highest priority content>** — why it comes first
2. **<Second>** — rationale
3. **<Third>** — rationale
4. <Below the fold / secondary>

(Repeat for each page that has non-trivial content priority.)

## User Flows

Critical paths through the product. Each flow is a sequence of steps with decision points called out.

### <Flow name> (e.g. "New user onboarding", "Create a project")

1. User lands on <page>
2. User sees <content / prompt>
3. User takes action: <action>
   - If <condition A> → <outcome>
   - If <condition B> → <outcome>
4. User arrives at <destination>

(Repeat for each critical flow. Three to five flows for most features.)

## Naming Conventions

A glossary of terms used in the interface. **Pick one word per concept and use it everywhere** — Naming Conventions is the contract.

| Concept | Label in UI | Notes |
| --- | --- | --- |
| <thing> | <what we call it> | <why this word, alternatives we ruled out> |

## Component Reuse Map

Which structural components (layouts, containers, navigation elements) are shared across pages.

| Component | Used on | Reuse mode | Behavior differences |
| --- | --- | --- | --- |
| <Layout / component> | <pages> | reuse-as-is / modify / new | <variations across uses> |

## Content Growth Plan

Which sections will accumulate content over time and how the IA accommodates the growth (pagination, filtering, search, archive patterns, infinite scroll, faceted search).

- <Section that grows> — <growth pattern>
- <Section that grows> — <growth pattern>

## URL Strategy

Rules for URL construction.

- **Pattern:** <e.g. `/<section>/<subsection>/<item-slug>`>
- **Dynamic segments:** <what is parameterized — IDs, slugs, dates>
- **Query parameters:** <filtering, sorting, pagination conventions>
- **Slug rules:** <kebab-case, max length, reserved words>
- **Stability:** <which URLs are permanent vs. allowed to change>

## Open questions

A short list of structural decisions still pending. Resolve before kicking off `PLAN.md`.

- [ ] <question — pending decision>
- [ ] <question — pending decision>
