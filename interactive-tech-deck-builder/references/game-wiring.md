# Game Wiring

Each interactive game has three parts: an HTML slide, a Three.js scene, and a small piece of `presentation.js` that connects them.

## The contract

For every game, you write:

1. **A slide** with `data-scene="<name>"` and HTML controls + stat-display elements (with stable `id`s).
2. **A scene factory** in `scenes.js` that exposes lifecycle methods (e.g. `reset`, `start`, `setMode`) and calls a registered `onChange` callback when state changes.
3. **A wiring block** in `presentation.js` that:
   - Imports the scene's API
   - Adds an init branch in `showSlide()` (resets the scene, registers `setOnChange(refreshXxxUI)`, primes initial UI)
   - Adds a `refreshXxxUI(state)` function that updates DOM ids
   - Adds click handlers (delegated `document.addEventListener('click', ...)`) for the buttons.

## Worked example: HPA pod-scaling game

### Slide

```html
<section
  class="slide game-slide has-fullscreen"
  data-section="Flexibility &amp; Scaling"
  data-color="blue"
  data-scene="pod-scaling"
>
  <button class="fs-toggle" data-fs-toggle>▶ Play full-screen</button>
  <div class="content-wrap split game-wrap">
    <div class="left">
      <p class="kicker">HPA RACE</p>
      <h2 class="headline">Crank the load,<br />watch HPA react.</h2>
      <p class="subtitle muted">
        Move the slider. Pods scale up under pressure, scale down when calm.
      </p>
      <div class="load-control">
        <label class="load-label"
          >CPU load <span id="load-value">0%</span></label
        >
        <input
          type="range"
          id="load-slider"
          min="0"
          max="100"
          value="0"
          class="load-slider"
        />
      </div>
      <div class="game-controls">
        <button class="action-btn ghost" id="scale-reset">↺ Reset</button>
      </div>
    </div>
    <div class="right">
      <div class="stats-panel">
        <div class="stat">
          <div class="stat-label">Pods running</div>
          <div class="stat-value" id="scale-replicas">2 / 10</div>
          <div class="stat-bar">
            <div class="stat-bar-fill" id="scale-bar"></div>
          </div>
        </div>
        <div class="stat">
          <div class="stat-label">Avg CPU per pod</div>
          <div class="stat-value" id="scale-cpu">0%</div>
        </div>
        <div class="stat">
          <div class="stat-label">HPA decision</div>
          <div class="stat-value small" id="scale-decision">stable</div>
        </div>
      </div>
      <p class="game-toast" id="scale-toast"></p>
    </div>
  </div>
  <aside class="notes">
    As you raise load, average CPU per pod climbs. When it crosses 70%, HPA adds
    a pod.
  </aside>
</section>
```

### Scene factory (pattern)

```js
function createPodScalingScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 5, 14);
  camera.lookAt(0, 1.5, 0);

  // ...lighting, floor, geometry...

  const MIN = 2,
    MAX = 10;
  const TARGET_CPU = 70;
  let load = 0;
  const pods = [];
  let onChange = null;

  function reset() {
    /* clear pods, spawn MIN, load = 0 */
  }
  function setLoad(v) {
    load = Math.max(0, Math.min(100, v));
  }

  let lastReconcile = 0;
  function reconcile(now) {
    if (now - lastReconcile < 1000) return;
    lastReconcile = now;
    const replicas = pods.filter((p) => !p.userData.dying).length;
    const totalDemand = (load / 100) * (MAX * 50);
    const cpuPerPod =
      replicas > 0 ? Math.min(100, (totalDemand / replicas / 50) * 100) : 0;

    let decision = "stable";
    if (cpuPerPod > TARGET_CPU && replicas < MAX) {
      pods.push(spawnPod(replicas));
      decision = "scale up";
    } else if (cpuPerPod < TARGET_CPU * 0.5 && replicas > MIN) {
      const v = pods.find((p) => !p.userData.dying);
      if (v) v.userData.dying = performance.now();
      decision = "scale down";
    }
    if (onChange)
      onChange({ replicas, cpu: cpuPerPod, decision, max: MAX, min: MIN });
  }

  function update(dt, t) {
    reconcile(performance.now());
    /* animate pods, fade in/out */
  }

  return {
    scene,
    camera,
    update,
    reset,
    setLoad,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    setOnChange(fn) {
      onChange = fn;
    },
  };
}

// Register and export
const scenes = { /* ..., */ "pod-scaling": createPodScalingScene() };
export function podScalingReset() {
  scenes["pod-scaling"].reset();
}
export function podScalingSetLoad(v) {
  scenes["pod-scaling"].setLoad(v);
}
export function podScalingSetOnChange(fn) {
  scenes["pod-scaling"].setOnChange(fn);
}
```

### Wiring in `presentation.js`

```js
import {
  /* ... */ podScalingReset,
  podScalingSetLoad,
  podScalingSetOnChange,
} from "./scenes.js";

function showSlide(idx) {
  /* ... */
  if (slide.dataset.scene === "pod-scaling") {
    podScalingReset();
    podScalingSetOnChange(refreshScaleUI);
    const slider = document.getElementById("load-slider");
    if (slider) {
      slider.value = 0;
      slider.oninput = () => {
        const v = parseInt(slider.value, 10);
        podScalingSetLoad(v);
        document.getElementById("load-value").textContent = v + "%";
      };
    }
    refreshScaleUI({
      replicas: 2,
      cpu: 0,
      decision: "stable",
      max: 10,
      min: 2,
    });
  }
}

function refreshScaleUI({ replicas, cpu, decision, max, min }) {
  const r = document.getElementById("scale-replicas");
  const cpuEl = document.getElementById("scale-cpu");
  const dec = document.getElementById("scale-decision");
  const bar = document.getElementById("scale-bar");
  if (r) r.textContent = `${replicas} / ${max}`;
  if (cpuEl) cpuEl.textContent = Math.round(cpu) + "%";
  if (dec) dec.textContent = decision;
  if (bar) bar.style.width = (replicas / max) * 100 + "%";
}

document.addEventListener("click", (e) => {
  if (e.target.id === "scale-reset") podScalingReset();
});
```

## Build steps inside a slide (progressive reveal)

For slides with progressive bullet reveal or code-line highlight, the controller runs **build steps before advancing to the next slide**. Pressing → first executes the next build step; once exhausted, → moves to the next slide.

`getBuildCount(slideEl)` decides how many steps a slide has:

- `.code-block.highlight-lines code .line` count → highlight one line per click
- `.tier-grid.build > [data-build]` count → reveal one tier per click
- `.bullets.build li[data-build]` count → reveal one bullet per click (used by `image-container`)

## Why delegated click handlers

Slides come and go from the DOM tree (they're all there but with `display: none`). Using event delegation on `document` means handlers don't need re-binding when the active slide changes — and you can keep all wiring in a single block per game.
