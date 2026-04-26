# Team Knowledge Base — Plan

> Generated: 2025-09-12
> IA: ./INFORMATION_ARCHITECTURE.md

## Overview

A three-phase plan to ship a usable v1 of the team knowledge base. **Foundation** lands the layout shell and topic/article reading flow on top of the existing component library; **Core UI** adds search and the personal Library; **Polish & A11y** delivers responsive behaviour, the saved-indicator, and the keyboard-shortcuts pass. The drafting/editor experience is intentionally deferred — the IA reserves the routes for it but the v1 ships read-mostly.

---

## Phase 1 — Foundation  _(estimated effort: medium)_

_End of phase: any team member can land on the home page, click a topic, and read an article on desktop and mobile._

### TODO

- [ ] **AppShell drives every route**: Header (Browse / Search / Recent / Library), main content area, mobile drawer. _Reuses: existing `AppShell` component._
- [ ] **Home lists featured topics and recent activity**: Two sections, each backed by the existing topic / article queries. _Reuses: `TopicCard`, `ArticleCard`._
- [ ] **Topic page renders an article list sorted by recency**: Sub-topics appear when present; otherwise hidden. _Modifies: `TopicCard` to render an article-count pill._
- [ ] **Article page renders body + related articles + breadcrumb**: Editing affordances are absent in this phase. _New page; reuses `ArticleCard` for related._

---

## Phase 2 — Core UI  _(estimated effort: medium)_

_End of phase: users can search across the corpus and save articles to a personal Library._

### TODO

- [ ] **Search route returns ranked results with tag filters**: `/search?q=<query>&tag=<tag>`. _Reuses: `SearchInput`. New: results list._
  - [ ] Empty-results state with suggested topics
  - [ ] Tag filter chips bound to URL
- [ ] **Library landing shows Saved and Drafts tabs**: Drafts tab is visually present but disabled (deferred). _New page._
- [ ] **Save / unsave action on `ArticleCard`**: Persists per-user; surfaces a saved-indicator. _Modifies: `ArticleCard`._

---

## Phase 3 — Polish & A11y  _(estimated effort: low)_

_End of phase: keyboard navigation works end-to-end; the layout adapts cleanly down to a 360px viewport; common error states have copy._

### TODO

- [ ] **Keyboard-shortcut overlay**: `?` toggles a help dialog listing the navigation shortcuts. _New component._
- [ ] **Mobile bottom-tab bar replaces hamburger primary nav** for Browse / Search / Library. _Modifies: `AppShell.MobileNav`._
- [ ] **Empty / loading / error states** for every list view (Home, Topic, Search, Library). _Modifies: list-rendering hooks; copy review with content team._

---

## Detailed Task Breakdown

### AppShell drives every route

**Why:** Every page needs the same header / drawer / footer chrome. Without a stable shell, navigation is inconsistent and mobile breaks.
**How:**
- Mount `AppShell` at the root layout
- Wire Primary nav items (`Browse` / `Search` / `Recent` / `Library`)
- Connect mobile drawer toggle
- Confirm `useNavigation()` hook integration with the existing router

**Impact:** Critical
**Effort:** ~4h
**Depends on:** None — can start immediately

### Home lists featured topics and recent activity

**Why:** First impression. Without curated landings, new visitors bounce.
**How:**
- Topic carousel using existing `TopicCard`
- Recent-activity strip using `ArticleCard`
- Both data sources already exist; thin layer

**Impact:** High
**Effort:** ~6h
**Depends on:** AppShell drives every route

### Topic page renders an article list sorted by recency

**Why:** This is the core read-flow entry point. Browsing must work before search does.
**How:**
- New route `/browse/<topic-slug>`
- Sorted query (existing endpoint) with pagination
- Sub-topic chips when the topic has children, hidden otherwise
- Modify `TopicCard` to surface an article-count pill (small change in the card; gated behind a prop)

**Impact:** Critical
**Effort:** ~1d
**Depends on:** Home lists featured topics (so the link target exists)

### Article page renders body + related articles + breadcrumb

**Why:** Reading is the headline use-case. Everything else is in service of getting here.
**How:**
- New route `/browse/<topic-slug>/<article-slug>`
- Render markdown body via existing renderer
- "Related articles" strip (recency + tag overlap)
- Breadcrumb component using path segments

**Impact:** Critical
**Effort:** ~1d
**Depends on:** Topic page renders an article list

### Search route returns ranked results with tag filters

**Why:** Once the corpus exceeds a topic-tree's worth of content, browse alone won't surface what users want.
**How:**
- `/search` page with `q` and `tag` URL params
- Reuse existing `SearchInput` (header + page)
- Tag filter chips bound to URL — add or remove tags, URL updates, results refetch
- Empty-results state suggests topics to browse

**Impact:** High
**Effort:** ~1.5d
**Depends on:** AppShell drives every route

### Library landing shows Saved and Drafts tabs

**Why:** Personal collection is the second-most-common return visit reason after search.
**How:**
- `/library` route with two-tab layout (Saved / Drafts)
- Saved tab lists user-saved articles with the same `ArticleCard`
- Drafts tab is rendered disabled with a "coming soon" affordance — IA reserves the slot

**Impact:** Medium
**Effort:** ~1d
**Depends on:** None — can start immediately

### Save / unsave action on `ArticleCard`

**Why:** The Library is empty without a way to add to it.
**How:**
- New "saved" indicator + toggle on `ArticleCard`
- Per-user persistence via the existing user-prefs store
- Optimistic UI

**Impact:** High
**Effort:** ~6h
**Depends on:** Library landing (verifiable destination)

### Keyboard-shortcut overlay

**Why:** Power users navigate faster with shortcuts; documenting them surfaces the affordance.
**How:**
- `?` toggles a modal listing all shortcuts
- Shortcuts: `g h` home, `g b` browse, `/` focus search, `s` save current article, `j/k` next/previous in lists
- Wire into the existing key-handling layer

**Impact:** Medium
**Effort:** ~6h
**Depends on:** Phase 1 + Phase 2 complete (most shortcuts target features they ship)

### Mobile bottom-tab bar replaces hamburger primary nav

**Why:** Hamburger is a discoverability tax on mobile. Bottom tabs are reachable with the thumb.
**How:**
- Modify `AppShell.MobileNav` to render bottom tabs at `< 768px`
- Tabs: Browse / Search / Library
- Hamburger drawer remains for utility (Profile, Sign out) only

**Impact:** Medium
**Effort:** ~6h
**Depends on:** AppShell drives every route

### Empty / loading / error states

**Why:** Most pages have list views; today they render blank or spin forever on the slow path.
**How:**
- Standard `<EmptyState>`, `<LoadingState>`, `<ErrorState>` components reused everywhere
- Copy review with content team to keep tone consistent
- One audit pass across Home, Topic, Search, Library

**Impact:** Medium
**Effort:** ~1d
**Depends on:** Phases 1 and 2 complete (so there are list views to audit)

---

## Top 5 highest-impact items

1. **AppShell drives every route** — gates every other page; can't ship without it.
2. **Article page renders body + related articles + breadcrumb** — the headline read flow.
3. **Topic page renders an article list sorted by recency** — the entry point into the read flow.
4. **Search route returns ranked results with tag filters** — once the corpus grows, the only way users find content.
5. **Save / unsave action on `ArticleCard`** — unlocks the entire Library pillar.
