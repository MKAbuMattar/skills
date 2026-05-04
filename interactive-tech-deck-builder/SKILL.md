---
name: interactive-tech-deck-builder
description: Build interactive HTML presentations for cloud / DevOps / platform topics — Three.js mini-games per concept, dark theme with section accent colors, kubectl/CLI demo simulator, and real cluster/registry data baked into the slides. Use this skill whenever the user asks to create a fundamentals deck, technical talk with games, interactive presentation, or hits you with phrases like "build a deck for X", "make a presentation about Kubernetes / Docker / cloud", "add a 3D animation to my slides", "I want a fancy interactive presentation", "deck with games and live data", "presentation that runs in the browser", or "interactive slides for my team". Also use when extending an existing deck with a new game / scene / section.
license: MIT. See LICENSE for full terms.
metadata:
  author: MKAbuMattar
  version: "1.0.0"
---

# Interactive Tech Deck Builder

Self-contained HTML presentation framework for cloud-native talks. One canvas, many scenes, dark design system, click-driven games, modal terminal demos.

## When to use

- The user asks for an interactive presentation, fundamentals deck, or "talk with games" on a tech / cloud topic.
- The user wants 3D Three.js animations to illustrate distributed-systems concepts (pods, traffic flow, scaling, image security, etc.).
- The user wants slides grounded in their real environment — `kubectl` output, registry contents, CI runs.
- The user already has a deck built with this pattern and wants a new game / section / scene added.

If the user wants a static slide deck (Keynote, Google Slides, plain Markdown), use a generic presentation skill instead — this one is specifically for HTML / Three.js / browser-rendered decks.

## Required structure

Every deck is a self-contained directory served as static files:

```
<deck-name>-presentation/
├── index.html        # <section class="slide" data-section="X" data-color="Y" data-scene="Z"> per slide
├── styles.css        # design system: --accent-* colors, .slide, .game-slide, .fullscreen-game
├── presentation.js   # slide controller, keyboard nav, build steps, game wiring
├── scenes.js         # Three.js scenes — one per data-scene name, registered in `scenes` map
├── demo.js           # kubectl / CLI playback simulator (modal terminal)
├── code-examples/    # YAML / Dockerfile / etc. shown on slides AND used by the demo simulator
├── README.md         # how to open + section map
├── OUTLINE.md        # section-by-section structural map
└── SPEAKER-GUIDE.md  # per-slide talking points (auto-generated from <aside class="notes">)
```

Run with `python3 -m http.server 8765` from the parent directory, then open `http://localhost:8765/<deck-name>-presentation/`.

## Workflow

1. **Pick the topic and section colors.** Each major part gets one accent: teal (opening / closing), red (problem), purple (when to use), amber (why we need it), green (fundamentals), blue (security / scaling), cyan (cloud), rose (live data), deep-purple (registry). Reusing colors is fine if separated.
2. **Capture real data first.** Before writing slides about "your cluster" or "your registry", run discovery commands and bake the numbers in: `kubectl get nodes -o wide`, `kubectl get pods -A | wc -l`, `kubectl get hpa -A`, `kubectl get sc`. Real numbers (e.g. "92 pods across 22 namespaces, 4 HPAs, 17 storage classes") give the deck credibility. Load `references/live-data-integration.md` for the discovery script.
3. **Copy framework files** from `assets/templates/` into the new deck folder: `index.html`, `styles.css`, `presentation.js`, `scenes.js`, `demo.js`. These are the worked output of two shipped decks — modify, don't rewrite from scratch.
4. **Author slides in `index.html`** as `<section class="slide" data-section="..." data-color="..." [data-scene="..."]>`. Use the established slide types: title, big-statement, framework, code, divider, game-slide, recap, qa-slide. Load `references/slide-types.md` for the full template gallery.
5. **Add a Three.js game** for each concept that benefits from interaction. Patterns we've shipped: image-vs-container, density-race, cold-start-race, cve-hunt, self-healing, pod-scaling, cluster-topology, deploy-race, traffic-wave, rolling-deploy, chaos, canary, service-routing, edge-to-pod-flow. Each is a function in `scenes.js` that returns `{ scene, camera, update, ... }` and is registered in the `scenes` map. Load `references/threejs-scenes.md` for the factory pattern + a worked example.
6. **Wire the game to the slide** — `data-scene="<name>"` on the section + matching control elements + a `refreshXxxUI()` function in `presentation.js` fed by a callback the scene exposes via `setOnChange()`. Load `references/game-wiring.md` for the wiring contract.
7. **Add demo simulator entries** in `demo.js` — one per scripted walkthrough (cluster overview, deploy, scale, self-heal). Each entry is an array of `{ say }` (narration) and `{ run, out, status }` (commands + simulated output). Triggered with the `D` key.
8. **Generate the speaker guide** with `python3 scripts/extract-speaker-notes.py <deck-dir>` after every slide-content change.
9. **Add the fullscreen-game toggle** to every game slide. Load `references/fullscreen-game-pattern.md` if a slide's right panel overflows the viewport in fullscreen mode — the fix is `position: fixed` + grid `minmax(0, ...)` + `overflow: hidden`.
10. **Validate by opening in a browser.** Don't trust the build alone. Walk every slide with arrows, toggle fullscreen on every game, open the demo modal on `D`, confirm section colors render distinctly. Load `references/qa-checklist.md` for the full pre-talk list.

## Available resources

- `assets/templates/index.html` — slide skeleton with persistent UI frame, help overlay, demo overlay, notes panel, overview grid
- `assets/templates/styles.css` — full design system including `--accent-*`, `.slide`, `.game-slide`, `.fullscreen-game` overrides
- `assets/templates/presentation.js` — slide controller, keyboard nav, build-step framework, game wiring
- `assets/templates/scenes.js` — Three.js scene factory pattern with shared renderer + animation loop and 14 worked-example scenes
- `assets/templates/demo.js` — modal terminal simulator
- `assets/examples/` — pointers to the two reference decks (`docker-fundamentals-presentation`, `kubernetes-fundamentals-presentation`)
- `scripts/extract-speaker-notes.py` — generates `SPEAKER-GUIDE.md` from `<aside class="notes">` blocks
- `scripts/discover-cluster.sh` — runs read-only `kubectl` queries to gather facts for the "your cluster" section
- `references/design-system.md` — colors, typography, layout rules
- `references/slide-types.md` — title, statement, framework, code, divider, game, recap, qa
- `references/threejs-scenes.md` — scene factory pattern, render loop, accent-color sync, raycasting
- `references/game-wiring.md` — `data-scene`, `refreshXxxUI`, build steps
- `references/live-data-integration.md` — discovery commands, what to bake in
- `references/fullscreen-game-pattern.md` — toggle button + CSS overrides for the bottom-bar layout
- `references/qa-checklist.md` — pre-talk verification list

## Top gotchas (always inline — do not skip)

- **Three.js scene-local vs world coords.** When a scene is offset (e.g. `scene.position.y = 3.5` to push it into the upper viewport), child positions are scene-local. If you target a pod via `pod.getWorldPosition(wp)`, you must `scene.worldToLocal(wp)` before assigning to a particle whose movement is computed in scene-local space. Otherwise particles aim 3.5 units off and never visually arrive — this is exactly the edge-to-pod bug we hit.
- **Fullscreen-game CSS must use `position: fixed` + grid `minmax(0, ...)`.** `position: absolute` + flex inside the slide can overflow the viewport on the right. Use `min-width: 0; overflow: hidden` on grid children to prevent text from blowing out the bar.
- **`canvas.style.pointerEvents` defaults to `none`** so clicks pass through to slides. Toggle to `'auto'` only on slides that need raycasting (self-healing). Forgetting this means the user can't click pods.
- **Aurora gradient shader needs a section-color setter.** When you switch slides, call `scene.setColor(ACCENT[color])` so the divider's radial gradient matches. Forgetting this is why every section divider looks the same.
- **Build-step navigation runs first.** Pressing → first runs build steps inside the slide (progressive bullet reveals, code-line highlights), then advances to the next slide once steps are exhausted. Track this in slide controller state, not on the scene.
- **Real cluster discovery is read-only.** `kubectl get`, `kubectl top`, `kubectl describe` are safe. Never run `kubectl apply / delete / drain / cordon` while building the deck.

## What you DO

1. Treat the framework templates as the source of truth — copy and extend, do not refactor speculatively.
2. Capture real data with `kubectl` / cluster CLIs before writing the "your environment" section.
3. Build each game as a small, focused scene (~150–300 lines) illustrating exactly one concept.
4. Use the section accent color in code-block borders, progress bar, kicker text, and aurora gradient — visual continuity matters.
5. Write speaker notes inline in `<aside class="notes">` so they show up in both the runtime panel (`S` key) and the generated `SPEAKER-GUIDE.md`.
6. Add a `▶ Play full-screen` toggle button to every game slide so the 3D scene can take over without slide content covering it.

## What you do NOT do

- Do not generate Three.js scenes from prose ("a 3D representation of containers"). Pick a concrete metaphor first (recipe vs meal, server filling with boxes, traffic particles flowing through stages), then code the scene.
- Do not put more than 5 bullets on a slide — split it.
- Do not use stock images, clip art, or emoji decoration.
- Do not animate everything — section dividers and big-statement slides should be still.
- Do not skip the speaker guide. The deck is half the artifact; the talk is the other half.
- Do not commit cluster credentials, registry URLs with auth, or anything that leaks production internals beyond what is already public.
