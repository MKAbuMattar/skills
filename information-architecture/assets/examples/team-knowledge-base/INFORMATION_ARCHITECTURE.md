# Information Architecture: Team Knowledge Base

> Generated: 2025-09-12
> Source: docs/specs/team-kb/BRIEF.md

## Site Map

- Home `/`
  - Browse `/browse`
    - Topic `/browse/<topic-slug>`
    - Article `/browse/<topic-slug>/<article-slug>`
  - Search `/search?q=<query>`
  - Recent `/recent`
- My Library `/library`
  - Saved `/library/saved`
  - Drafts `/library/drafts`
- Settings `/settings`
  - Profile `/settings/profile`
  - Notifications `/settings/notifications`

## Navigation Model

| Layer | Items | Notes |
| --- | --- | --- |
| **Primary** | Browse · Search · Recent · My Library | Always visible in header |
| **Secondary** | Topic sidebar inside Browse; tag filter inside Search | Per-section |
| **Utility** | Profile menu (Settings, Sign out) | Top-right |
| **Mobile** | Hamburger drawer for Primary; bottom-tab bar for Browse / Search / Library | Hamburger collapses Browse-internal sidebar to a top filter chip |

## Content Hierarchy

### Article page

1. **Title + last-updated date** — orientation
2. **Article body** — the reason the user is here
3. **Related articles** — encourages depth
4. Tag list / breadcrumb — navigation context
5. Author + edit history — below the fold

### Topic page

1. **Topic name + 1-line description** — confirm landing
2. **Article list (sorted by recency)** — the user's task
3. Sub-topics, if any — discovery
4. Subscribe button — secondary action

## User Flows

### New visitor lands and reads an article

1. User lands on Home
2. User sees featured topics + recent activity
3. User clicks a topic
4. Topic page lists articles; user clicks one
5. User reads the article
   - If article references another → click → next article
   - If article is incomplete → "Improve this" link → editor (auth gate)

### Returning user finds something they read before

1. User lands on Home
2. User clicks **My Library → Saved**
3. User scans saved list, opens article
4. If not saved, falls back to Search

### Author drafts a new article

1. User clicks **My Library → Drafts → New article**
2. User enters title (auto-slug)
3. User picks topic from a typeahead
4. User writes content; draft auto-saves
5. User publishes
   - If topic has approval rules → article enters review
   - Else → article publishes immediately, redirected to its public URL

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| Categorisation node | **Topic** | Not "Category" / "Section"; matches existing tag system |
| Reading list | **Library** | Not "Saved" / "Bookmarks" — Library subsumes both Saved + Drafts |
| Search input | **Find** | Verb keeps the input feel light; consistent with placeholder "Find articles…" |
| Article state pre-publish | **Draft** | Not "Unpublished" — shorter, matches editor convention |
| Author profile | **Profile** | Not "Account" — Account is the menu group |

## Component Reuse Map

| Component | Used on | Reuse mode | Behavior differences |
| --- | --- | --- | --- |
| `AppShell` (header + main + drawer) | All pages | reuse-as-is | None |
| `TopicCard` | Home, Topic listing, Library | reuse-as-is | Home variant shows article count; others don't |
| `ArticleCard` | Browse, Search, Library, Recent | modify | Add "saved" indicator (new state); existing card lacks it |
| `Editor` | Drafts > New / Edit | new | Doesn't exist yet |
| `SearchInput` | Header, /search page | reuse-as-is | Same component, different size |

## Content Growth Plan

- **Topics** grow over time → support pagination at `/browse?page=<n>`, plus search-within-topic.
- **Articles per topic** grow over time → infinite scroll on topic pages, with date-cut-off filter.
- **Saved items** grow per user → folders in `library/saved/<folder-slug>` once any user passes 50 items.

## URL Strategy

- **Pattern:** `/<section>/<subsection>/<slug>`
- **Dynamic segments:** topic slug, article slug, folder slug, user-id (settings only).
- **Query parameters:** `?q=` for search, `?page=` for pagination, `?tag=` for filtering, `?sort=recent|popular` for ordering.
- **Slug rules:** kebab-case, ≤ 60 chars, no reserved words (`new`, `edit`, `delete`, `settings`, `library`, `search`, `browse`, `recent`).
- **Stability:** Article URLs are permanent — title changes do not change the slug. Topic URLs may change only on a topic merge, with redirects.

## Open questions

- [x] Do we need a per-team scope in the URL (`/team/<slug>/...`)? Decided: **no** — single-tenant for v1.
- [ ] Should "Recent" be personalized or global? Pending product call.
- [ ] How long do drafts auto-save before counting as "abandoned"?
