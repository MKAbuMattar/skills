# Examples

This skill ships **the framework**, not pre-built decks. There are no example decks shipped here on purpose — the previous version had cloud-themed example decks bundled, and people copied them whole instead of building scenes from their own metaphors.

If you want to see what a finished deck looks like, build one. The framework files in `assets/templates/` are everything you need:

- `index.html` — slide skeleton
- `styles.css` — design system
- `presentation.js` — slide controller, keyboard nav, build steps
- `scenes.js` — Three.js scene framework with two ambient scenes (`particles`, `aurora` / `aurora-soft`)
- `demo.js` — modal CLI / REPL playback simulator

## How to build a deck

1. Run `scripts/new-deck.sh <deck-name>` to scaffold the framework files into a new folder.
2. Pick the narrative beats. Map them to ~6-9 sections, one accent color each.
3. For each scene you want, **pick a concrete physical metaphor first** ("particles flowing through gates", "boxes filling a room", "balls bouncing on a curve"), then find the closest recipe in [`references/scene-recipes.md`](../../references/scene-recipes.md). Each recipe has shape, gotchas, implementation sketch, UI tile pattern.
4. Write the scene factory in `scenes.js` per the contract in [`references/threejs-scenes.md`](../../references/threejs-scenes.md).
5. Wire the scene to the slide per [`references/scene-wiring.md`](../../references/scene-wiring.md).
6. Add a fullscreen toggle per [`references/fullscreen-scene-pattern.md`](../../references/fullscreen-scene-pattern.md).
7. Generate the speaker guide with `scripts/extract-speaker-notes.py`.

## How the framework transfers to non-technical topics

The recipes in `scene-recipes.md` are deliberately metaphor-shaped, not domain-shaped. The same shape works for many topics:

| Recipe            | Sales deck            | Lecture                   | Product demo                | System talk             |
| ----------------- | --------------------- | ------------------------- | --------------------------- | ----------------------- |
| Race              | revenue vs target     | reaction-rate comparison  | feature speed vs competitor | request latency by tier |
| Particle flow     | leads through funnel  | electrons through circuit | data through pipeline       | packets through routers |
| Click-to-destroy  | churn events          | predator/prey             | error injection             | failure-domain testing  |
| Density / fill-up | accounts per CSM      | molecules in container    | seats sold                  | capacity utilization    |
| Slider scaling    | price/volume tradeoff | dose response             | quantity discounts          | autoscale curve         |
| Force-graph       | account relationships | concept map               | feature dependencies        | service mesh            |
| Wave generator    | seasonality           | wave physics              | usage patterns              | traffic shaping         |
| Topology          | territory map         | system diagram            | architecture                | cluster layout          |
| Hub-and-spoke     | regions / accounts    | central idea + branches   | platform + integrations     | control plane + workers |

Pick the recipe whose **shape** fits your concept. The materials, colors, and labels are yours to bring.

## What the framework does NOT ship

- Topic-specific scenes (no "kubernetes pod" scene, no "sales funnel" scene). Build them per deck.
- Topic-specific CSS classes. The design system is generic — `.scene-slide`, `.scene-controls`, `.scene-stats`, etc.
- Real data. Whatever your source (CSV / JSON / API / SQL / kubectl / file scan), see [`references/data-sources.md`](../../references/data-sources.md) for how to bake real numbers in.
- Pre-written demo walkthroughs. `demo.js` ships one placeholder; replace it with your own.

The framework is the integration pattern; the deck is yours.
