---
name: interactive-deck-builder
description: Build interactive HTML presentations on any topic — Three.js scenes per concept, dark theme with section accent colors, modal CLI / REPL playback simulator, optional live-data integration that bakes real numbers from any source (CSV / JSON / API / SQL / kubectl / file scanner / spreadsheet), fullscreen-scene toggle, keyboard navigation, build-step framework, and auto-generated speaker guide. Topic-agnostic — works for sales pitches, conference talks, classroom lectures, product demos, scientific visualizations, story telling, training material. Use whenever the user asks to create an interactive HTML deck, slide framework with Three.js scenes, browser presentation with games / animations / live-data tiles, or says things like 'build me an interactive deck', 'make a fancy presentation', 'add a 3D animation to my slides', 'browser presentation with games'. Pairs with separate skills for Three.js fundamentals, presentation content, slide design, and outline / pitch-deck structure.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "2.0.0"
---

# Interactive Deck Builder

A framework for self-contained HTML presentations: one canvas, many Three.js scenes, click-driven interactions per slide, modal CLI / REPL playback simulator, dark accent-colored design system, live-data tiles fed from any source. Topic-agnostic — bring your own metaphor, your own data, your own scenes.

## When to use

- The user asks for an interactive HTML / browser presentation, deck with games, or "talk with 3D animations" on **any** topic.
- The user wants Three.js scenes to illustrate a concept (any concept — process flow, market dynamics, scientific phenomenon, system architecture, narrative metaphor).
- The user wants slides that show **real data** baked in from an external source (CSV file, REST API, SQL query, kubectl output, file system, spreadsheet, anything).
- The user already has a deck built with this framework and wants a new scene / section / animation added.

Skip this skill when:

- The user wants a static deck (Keynote, PowerPoint, Google Slides, plain Markdown). For those, use a presentation-design / animation-principles skill.
- The user wants a tech-talk *outline* without the framework — use a presentation-outline skill.
- The user wants pure Three.js fundamentals (scene graph, materials, cameras) without the deck wrapper — use a threejs-webgl skill.

This skill is the **framework**. Bring complementary skills for content writing, animation theory, design, and Three.js fundamentals.

## Required structure

Every deck is a self-contained directory served as static files:

```
<deck-name>/
├── index.html        # <section class="slide" data-section="X" data-color="Y" data-scene="Z"> per slide
├── styles.css        # design system: --accent-* colors, .slide, .scene-slide, .fullscreen-scene
├── presentation.js   # slide controller, keyboard nav, build steps, scene wiring
├── scenes.js         # Three.js scenes — one per data-scene name, registered in `scenes` map
├── demo.js           # CLI / REPL / terminal playback simulator (modal, optional)
├── data/             # CSV / JSON / etc. shown on slides AND fed into scenes (optional)
├── code-examples/    # snippets shown on slides AND used by the demo simulator (optional)
├── README.md         # how to open + section map
├── OUTLINE.md        # section-by-section structural map
└── SPEAKER-GUIDE.md  # per-slide talking points (auto-generated from <aside class="notes">)
```

Run with `python3 -m http.server 8765` from the parent directory, then open `http://localhost:8765/<deck-name>/`.

## Workflow

1. **Pick the topic and narrative beats.** Map your story to ~6-9 sections. Each section gets one accent color (teal / red / purple / amber / green / blue / cyan / rose / deep-purple). The colors are mood markers, not topic markers — pick what fits the beat (red = problem / alarm, green = fundamentals / safety, blue = scale / depth, cyan = open / cool, rose = warmth / data, etc.).
2. **Capture real data first** (optional but high-value). Whatever your topic, find the real numbers that ground it. Sales deck → real revenue / churn / LTV. Lecture → real survey / experiment results. System talk → real cluster output. Product demo → real usage stats. Load `references/data-sources.md` for the discovery patterns by data source type.
3. **Copy framework files** from `assets/templates/` into the new deck folder: `index.html`, `styles.css`, `presentation.js`, `scenes.js`, `demo.js`. Or run `bash scripts/new-deck.sh <deck-name>` to scaffold.
4. **Author slides in `index.html`** as `<section class="slide" data-section="..." data-color="..." [data-scene="..."]>`. Use the established slide types: title, big-statement, framework, code, divider, scene, recap, q-and-a. Load `references/slide-types.md` for the full template gallery.
5. **Build Three.js scenes** for concepts that benefit from interaction. Each scene is a function in `scenes.js` that returns `{ scene, camera, update, ... }` and is registered in the `scenes` map. The shipped templates ship ONLY two ambient scenes — `particles` (title) and `aurora` (dividers) — so every interactive scene is **built per deck**, not copied from a shipped library. Load `references/scene-recipes.md` for structural recipes covering ~12 common patterns (race, particle-flow, click-to-destroy, density / fill-up, slider scaling, force-directed graph, wave generator, topology, color-shift, hub-and-spoke, migration, comparison split-screen). Load `references/threejs-scenes.md` for the factory contract + accent-color sync + raycasting + scene-local-vs-world-coords gotcha. For Three.js fundamentals (geometries, materials, lighting, performance), defer to a `threejs-webgl` skill.
6. **Wire each scene to its slide** — `data-scene="<name>"` on the section + matching control elements + a `refreshXxxUI()` function in `presentation.js` fed by a callback the scene exposes via `setOnChange()`. Load `references/scene-wiring.md` for the wiring contract.
7. **Add demo simulator entries** in `demo.js` (optional) — one per scripted walkthrough. Each entry is an array of `{ say }` (narration) and `{ run, out, status }` (commands + simulated output). Triggered with the `D` key. Generic enough for any CLI: kubectl, psql, redis-cli, git, npm, AWS CLI, custom REPLs, or scripted shell.
8. **Generate the speaker guide** with `python3 scripts/extract-speaker-notes.py <deck-dir>` after every slide-content change.
9. **Add the fullscreen-scene toggle** to every scene slide. Load `references/fullscreen-scene-pattern.md` if a slide's right panel overflows the viewport in fullscreen mode — the fix is `position: fixed` + grid `minmax(0, ...)` + `overflow: hidden`.
10. **Validate by opening in a browser.** Don't trust the build alone. Walk every slide with arrows, toggle fullscreen on every scene, open the demo modal on `D`, confirm section colors render distinctly. Load `references/qa-checklist.md` for the full pre-talk list.

## Available resources

- `assets/templates/index.html` — slide skeleton with persistent UI frame, help overlay, demo overlay, notes panel, overview grid.
- `assets/templates/styles.css` — full design system: `--accent-*` colors, `.slide`, `.scene-slide`, `.fullscreen-scene` overrides.
- `assets/templates/presentation.js` — slide controller, keyboard nav, build-step framework, scene wiring.
- `assets/templates/scenes.js` — slim Three.js scene framework: shared renderer + animation loop + scene registry + two ambient scenes (`particles`, `aurora`). All other scenes are built per deck.
- `assets/templates/demo.js` — modal CLI / REPL / terminal playback simulator.
- `assets/examples/README.md` — pointers to example decks and how the patterns transfer to non-technical topics.
- `scripts/extract-speaker-notes.py` — generates `SPEAKER-GUIDE.md` from `<aside class="notes">` blocks.
- `scripts/new-deck.sh` — scaffold a new deck directory by copying framework files and substituting the deck name.
- `scripts/discover-cluster.sh` — preset data discovery for kubectl-style sources (one example among many; see `references/data-sources.md` for patterns covering CSV / JSON / API / SQL / file-scan).
- `references/design-system.md` — colors, typography, layout, accent-color rules.
- `references/slide-types.md` — title, big-statement, framework, code, divider, scene, recap, q-and-a templates.
- `references/threejs-scenes.md` — scene factory contract, render loop, accent-color sync, raycasting, scene-local-vs-world-coords gotcha, teardown disposal. Defers Three.js fundamentals to a `threejs-webgl` skill; defers per-pattern recipes to `scene-recipes.md`.
- `references/scene-recipes.md` — structural recipes for ~12 common scene patterns (race, particle-flow, click-to-destroy, density, slider-scaling, force-graph, wave, topology, color-shift, hub-and-spoke, migration, comparison). Each recipe gives shape, gotchas, implementation sketch, UI tile pattern.
- `references/scene-wiring.md` — `data-scene`, `refreshXxxUI`, build steps, the integration contract.
- `references/data-sources.md` — patterns for CSV / JSON / API / SQL / kubectl / file-scanning / spreadsheets — what to bake in, how to bake it in, freshness strategies.
- `references/fullscreen-scene-pattern.md` — toggle button + CSS overrides for the bottom-bar layout.
- `references/qa-checklist.md` — pre-talk verification list (topic-agnostic).

## Top gotchas (always inline — do not skip)

- **Three.js scene-local vs world coords.** When a scene is offset (e.g. `scene.position.y = 3.5` to push it into the upper viewport), child positions are scene-local. If you target an object via `obj.getWorldPosition(wp)`, you must `scene.worldToLocal(wp)` before assigning to a particle whose movement is computed in scene-local space. Otherwise particles aim N units off and never visually arrive.
- **Fullscreen-scene CSS must use `position: fixed` + grid `minmax(0, ...)`.** `position: absolute` + flex inside the slide can overflow the viewport on the right. Use `min-width: 0; overflow: hidden` on grid children to prevent text from blowing out the bar.
- **`canvas.style.pointerEvents` defaults to `none`** so clicks pass through to slides. Toggle to `'auto'` only on slides that need raycasting. Forgetting this means the user can't click anything in the scene.
- **Aurora gradient shader needs a section-color setter.** When you switch slides, call `scene.setColor(ACCENT[color])` so the divider's radial gradient matches. Forgetting this is why every section divider looks the same.
- **Build-step navigation runs first.** Pressing → first runs build steps inside the slide (progressive bullet reveals, code-line highlights), then advances to the next slide once steps are exhausted. Track this in slide controller state, not on the scene.
- **Real-data discovery is read-only.** Whether your source is `kubectl`, a SQL query, a REST API, or a file scan — pick read-only operations during deck-building. Never run write / destructive ops while authoring slides.
- **Pick a concrete metaphor before coding the scene.** "A 3D representation of X" is not a scene — it's a wish. Land on a specific physical metaphor (boxes filling a server, particles flowing through gates, balls bouncing on a curve, a force-directed graph relaxing) before writing Three.js.
- **Topic-agnostic does not mean topic-blind.** The framework is generic; each deck is specific. Start with the narrative, then the metaphors, then the scenes — not the other way around.

## What you DO

1. Treat the framework templates as the source of truth — copy and extend, do not refactor speculatively.
2. Capture real data with the appropriate discovery script before writing the "real numbers" section.
3. Build each scene as a small, focused module (~150-300 lines) illustrating exactly one concept.
4. Use the section accent color in code-block borders, progress bar, kicker text, and aurora gradient — visual continuity matters.
5. Write speaker notes inline in `<aside class="notes">` so they show up in both the runtime panel (`S` key) and the generated `SPEAKER-GUIDE.md`.
6. Add a `▶ Play full-screen` toggle button to every scene slide so the 3D scene can take over without slide content covering it.
7. Pair this skill with complementary skills: a `presentations` / `presentation-design` skill for animation principles + slide design, a `presentation-content` skill for content writing, a `threejs-webgl` skill for 3D fundamentals, an outline / pitch-deck skill for narrative structure.

## What you do NOT do

- Generate Three.js scenes from prose ("a 3D representation of <X>"). Pick a concrete metaphor first, then code.
- Put more than 5 bullets on a slide — split it.
- Use stock images, clip art, or emoji decoration. The deck's visuals are Three.js + accent colors + typography.
- Animate everything — section dividers and big-statement slides should be still.
- Skip the speaker guide. The deck is half the artifact; the talk is the other half.
- Commit credentials, internal hostnames, real customer data, or anything that leaks production / private info beyond what is already public.
- Re-implement Three.js fundamentals in this skill's references — defer to a `threejs-webgl` skill. This skill teaches the *integration pattern* (one canvas, scene registry, slide-driven scene switch, accent-color sync) — not how to use materials and lights.
- Make assumptions about the topic. The framework is topic-agnostic; ask the user for their narrative before scaffolding scenes.
