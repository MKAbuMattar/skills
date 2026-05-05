# Design System

Bold, minimal, dark-first. Typography uses **scale** not weight for emphasis. All colors live as CSS custom properties and switch per section via `[data-color="..."]`.

## Color palette

Dark-mode defaults:

| Role             | Token            | Hex       |
| ---------------- | ---------------- | --------- |
| Background       | `--bg`           | `#0a0a0a` |
| Elevated surface | `--bg-elev`      | `#111113` |
| Primary text     | `--fg-primary`   | `#ffffff` |
| Secondary text   | `--fg-secondary` | `#a1a1aa` |
| Muted text       | `--fg-muted`     | `#71717a` |
| Faint dividers   | `--fg-faint`     | `#27272a` |

Section accents (one per major part of the deck):

| Section role             | Hex       | Token                  |
| ------------------------ | --------- | ---------------------- |
| Opening / closing        | `#14b8a6` | `--accent-teal`        |
| Problem / pain           | `#f87171` | `--accent-red`         |
| When to use / decisions  | `#a78bfa` | `--accent-purple`      |
| Why we need it           | `#fbbf24` | `--accent-amber`       |
| Fundamentals / mechanics | `#34d399` | `--accent-green`       |
| Security / scaling       | `#60a5fa` | `--accent-blue`        |
| Cloud / infra            | `#22d3ee` | `--accent-cyan`        |
| Live / real data         | `#fb7185` | `--accent-rose`        |
| Registry / artifacts     | `#c084fc` | `--accent-deep-purple` |

The active section accent is exposed as `--accent` and used by:

- `.kicker` (uppercase tag above the headline)
- `.progress-bar > .progress-fill` (3 px bar at viewport bottom)
- `.code-block` left-border on highlighted lines
- `.section-label` (top-left)
- Aurora gradient shader colour uniform

```css
[data-color="teal"] {
  --accent: var(--accent-teal);
}
[data-color="red"] {
  --accent: var(--accent-red);
}
[data-color="cyan"] {
  --accent: var(--accent-cyan);
}
/* etc. */
```

## Typography

```css
:root {
  --font-sans: "Geist", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}
```

| Class             | Size                        | Weight   | Use                                 |
| ----------------- | --------------------------- | -------- | ----------------------------------- |
| `.kicker`         | 14 px / uppercase / +0.18em | 500      | One-line section tag above headline |
| `.headline`       | clamp(56px, 6.5vw, 112px)   | 400      | Default slide title                 |
| `.mega`           | clamp(80px, 11vw, 200px)    | 300      | Title slide only                    |
| `.mega-statement` | clamp(72px, 9vw, 168px)     | 300      | Big-statement slides                |
| `.subtitle`       | clamp(22px, 2.2vw, 36px)    | 400      | Sub-headline / supporting line      |
| `.code-block`     | clamp(16px, 1.4vw, 22px)    | 400 mono | Code samples                        |
| `.bullets`        | clamp(22px, 2vw, 32px)      | 400      | Lists                               |

**Rules:**

- Maximum text width 1400 px (`--max-text-width`).
- Outer padding 96 px on all sides (`--pad-outer`).
- Headline → subtitle gap 32 px. Subtitle → body 64 px.
- Bullets: 5 max per slide. If you need 6, split.
- Lead-in word in bullets uses 600 weight; the rest stays 400.

## Layouts

The slide structure is a single `<main class="deck">` with absolutely-positioned `<section class="slide">` children. Only the `.active` slide is visible. All scene rendering happens in a single fixed-position `<canvas id="bg-canvas">` behind the deck (z-index: 0; deck is z-index: 10).

Scene slides use a split layout:

```html
<div class="content-wrap split scene-wrap">
  <div class="left">
    <p class="kicker">SECTION</p>
    <h2 class="headline">Title</h2>
    <p class="subtitle muted">Description</p>
    <!-- legend / picker / slider -->
    <div class="scene-controls">
      <button class="action-btn big" id="...">▶ Action</button>
    </div>
  </div>
  <div class="right">
    <div class="stats-panel">
      <div class="stat">
        <div class="stat-label">Label</div>
        <div class="stat-value" id="...">0</div>
      </div>
      <!-- repeat 3-4× -->
    </div>
    <p class="scene-toast" id="..."></p>
  </div>
</div>
```

When `.fullscreen-scene` is added to the slide, the split panels collapse into a single fixed bar at the bottom. See `fullscreen-scene-pattern.md` for the override CSS.

## Reusable components

- `.bullets.stagger` — list with staggered fade-in animation (CSS-driven via `:nth-child(n)` transition delays).
- `.bullets.check` / `.bullets.cross` — green-check or red-X bullets.
- `.bullets.numbered` — auto-counter bullets.
- `.tier-grid.build` — progressive-reveal grid (use `data-build="N"` on each tile).
- `.code-block.highlight-lines` — code where each line can be highlighted on click. JS splits `<code>` into `<span class="line">` elements; controller toggles `.active`.
- `.two-col-list` — left column ✗-style "what we lose", right column ✓-style "what we gain".
- `.evolution` — 4-tile horizontal timeline.
- `.dashboard` / `.dash-tile` — live-data tile grid.
- `.stats-panel` / `.stat` / `.stat-label` / `.stat-value` — scene stat tiles.
- `.scene-controls` — button row inside a scene slide.
- `.scene-toast` — transient floating notice on a scene slide.
