# Scene Wiring

Each interactive scene has three parts: an HTML slide, a Three.js scene, and a small piece of `presentation.js` that connects them.

## The contract

For every scene, you write:

1. **A slide** with `data-scene="<name>"` and HTML controls + stat-display elements (with stable `id`s).
2. **A scene factory** in `scenes.js` that exposes lifecycle methods (e.g. `reset`, `setLoad`, `setMode`) and calls a registered `onChange` callback when state changes.
3. **A wiring block** in `presentation.js` that:
   - Imports the scene's API (or reaches it through the scene registry).
   - Adds an init branch in `showSlide()` (resets the scene, registers `setOnChange(refreshXxxUI)`, primes initial UI).
   - Adds a `refreshXxxUI(state)` function that updates DOM ids.
   - Adds click / input handlers (delegated `document.addEventListener('click', ...)`) for the buttons and controls.

## Worked example: a slider-scaling scene

This example uses the **slider-scaling** recipe from `scene-recipes.md` (a slider drives a metric, the scene reacts in real time, stat tiles update). The same shape works whether the metric is dose response, autoscale, price elasticity, or any other quantity-driven concept — bring your own labels.

### Slide

```html
<section
  class="slide scene-slide has-fullscreen"
  data-section="dynamics"
  data-color="blue"
  data-scene="slider-demo"
>
  <button class="fs-toggle" data-fs-toggle>▶ Play full-screen</button>
  <div class="content-wrap split scene-wrap">
    <div class="left">
      <p class="kicker">DYNAMICS</p>
      <h2 class="headline">Move the slider,<br />watch the system react.</h2>
      <p class="subtitle muted">
        Drag the input. The output adjusts toward equilibrium.
      </p>
      <div class="load-control">
        <label class="load-label">Input <span id="input-value">0%</span></label>
        <input
          type="range"
          id="input-slider"
          min="0"
          max="100"
          value="0"
          class="load-slider"
        />
      </div>
      <div class="scene-controls">
        <button class="action-btn ghost" id="slider-reset">↺ Reset</button>
      </div>
    </div>
    <div class="right">
      <div class="stats-panel">
        <div class="stat">
          <div class="stat-label">Units active</div>
          <div class="stat-value" id="slider-units">2 / 10</div>
          <div class="stat-bar">
            <div class="stat-bar-fill" id="slider-bar"></div>
          </div>
        </div>
        <div class="stat">
          <div class="stat-label">Avg load per unit</div>
          <div class="stat-value" id="slider-load">0%</div>
        </div>
        <div class="stat">
          <div class="stat-label">Decision</div>
          <div class="stat-value small" id="slider-decision">stable</div>
        </div>
      </div>
      <p class="scene-toast" id="slider-toast"></p>
    </div>
  </div>
  <aside class="notes">
    As the input rises, average load climbs. When it crosses the threshold, the
    system adds a unit.
  </aside>
</section>
```

### Scene factory (pattern)

```js
function createSliderDemoScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 5, 14);
  camera.lookAt(0, 1.5, 0);

  // ...lighting, floor, geometry...

  const MIN = 2,
    MAX = 10;
  const TARGET_LOAD = 70;
  let input = 0;
  const units = [];
  let onChange = null;

  function reset() {
    /* clear units, spawn MIN, input = 0 */
  }
  function setInput(v) {
    input = Math.max(0, Math.min(100, v));
  }

  let lastReconcile = 0;
  function reconcile(now) {
    if (now - lastReconcile < 1000) return;
    lastReconcile = now;
    const active = units.filter((u) => !u.userData.dying).length;
    const totalDemand = (input / 100) * (MAX * 50);
    const loadPerUnit =
      active > 0 ? Math.min(100, (totalDemand / active / 50) * 100) : 0;

    let decision = "stable";
    if (loadPerUnit > TARGET_LOAD && active < MAX) {
      units.push(spawnUnit(active));
      decision = "scale up";
    } else if (loadPerUnit < TARGET_LOAD * 0.5 && active > MIN) {
      const v = units.find((u) => !u.userData.dying);
      if (v) v.userData.dying = performance.now();
      decision = "scale down";
    }
    if (onChange)
      onChange({ active, load: loadPerUnit, decision, max: MAX, min: MIN });
  }

  function update(dt, t) {
    reconcile(performance.now());
    /* animate units, fade in/out */
  }

  function setColor(hex) {
    /* apply accent to materials */
  }

  return {
    scene,
    camera,
    update,
    setColor,
    reset,
    setInput,
    setOnChange(fn) {
      onChange = fn;
    },
  };
}

// Register in the scenes map
const scenes = {
  /* ...other scenes..., */
  "slider-demo": createSliderDemoScene,
};
```

### Wiring in `presentation.js`

`presentation.js` reaches the active scene via the scene registry rather than importing each factory by name. The wiring block belongs in the "PER-DECK WIRING" section near the bottom of the file.

```js
import { getScene } from "./scenes.js";

function showSlide(idx) {
  /* ...generic slide-switch logic... */

  const slide = slides[idx];
  if (slide.dataset.scene === "slider-demo") {
    const s = getScene();
    s.reset();
    s.setOnChange(refreshSliderUI);
    const slider = document.getElementById("input-slider");
    if (slider) {
      slider.value = 0;
      slider.oninput = () => {
        const v = parseInt(slider.value, 10);
        s.setInput(v);
        document.getElementById("input-value").textContent = v + "%";
      };
    }
    refreshSliderUI({
      active: 2,
      load: 0,
      decision: "stable",
      max: 10,
      min: 2,
    });
  }
}

function refreshSliderUI({ active, load, decision, max, min }) {
  const u = document.getElementById("slider-units");
  const ld = document.getElementById("slider-load");
  const dec = document.getElementById("slider-decision");
  const bar = document.getElementById("slider-bar");
  if (u) u.textContent = `${active} / ${max}`;
  if (ld) ld.textContent = Math.round(load) + "%";
  if (dec) dec.textContent = decision;
  if (bar) bar.style.width = (active / max) * 100 + "%";
}

document.addEventListener("click", (e) => {
  if (e.target.id === "slider-reset") {
    const s = getScene();
    if (s && s.reset) s.reset();
  }
});
```

## Build steps inside a slide (progressive reveal)

For slides with progressive bullet reveal or code-line highlight, the controller runs **build steps before advancing to the next slide**. Pressing → first executes the next build step; once exhausted, → moves to the next slide.

`getBuildCount(slideEl)` decides how many steps a slide has:

- `.code-block.highlight-lines code .line` count → highlight one line per click.
- `[data-build]` count → reveal one element per click (works on bullets, tier grids, any container).

## Why delegated click handlers

Slides come and go from the active state (only the `.active` slide is visible). Using event delegation on `document` means handlers don't need re-binding when the active slide changes — and you can keep all wiring for one scene in a single block.
