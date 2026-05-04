# Three.js Scene Pattern

Each game / animation is a function in `scenes.js` that returns an object with a known shape. A central registry maps `data-scene` attribute values to scenes; a single shared renderer + animation loop drives them all.

## Module layout

```js
import * as THREE from "three";

const canvas = document.getElementById("bg-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  for (const s of Object.values(scenes))
    s.onResize?.(window.innerWidth, window.innerHeight);
});

const ACCENT = {
  teal: new THREE.Color("#14b8a6"),
  red: new THREE.Color("#f87171"),
  /* ...all section colors */
};

// Scene factories below — each returns an object with at least { scene, camera, update }

function createXxxScene() {
  /* ... */
}

const scenes = {
  particles: createParticlesScene(),
  aurora: createAuroraScene(false),
  "aurora-soft": createAuroraScene(true),
  /* one entry per data-scene name */
};
let active = null;

export function setSceneForSlide(slideEl, color) {
  const sceneName = slideEl.dataset.scene || null;
  active = sceneName ? scenes[sceneName] : null;
  if (active && active.setColor) active.setColor(ACCENT[color] || ACCENT.teal);
  if (scenes.aurora.setColor)
    scenes.aurora.setColor(ACCENT[color] || ACCENT.teal);
  if (scenes["aurora-soft"].setColor)
    scenes["aurora-soft"].setColor(ACCENT[color] || ACCENT.teal);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;
  for (const s of Object.values(scenes)) s.update?.(dt, t);
  renderer.clear();
  if (active) renderer.render(active.scene, active.camera);
}
animate();
```

## Scene factory contract

Every factory returns an object with:

```js
{
  scene,           // THREE.Scene
  camera,          // THREE.PerspectiveCamera | OrthographicCamera
  update(dt, t),   // called every frame; dt seconds since last, t total elapsed
  onResize(w, h),  // (optional) called on window resize
  setColor(c),     // (optional) for scenes that adapt to the active section accent
  /* game-specific methods, e.g. spawn(), reset(), kill(), setMode() */
}
```

## Scene categories shipped

### Background / ambient

- `particles` — title-slide drifting particle field. Color follows the current section.
- `aurora` / `aurora-soft` — full-screen GLSL radial gradient with Simplex noise flow. Section dividers + Q&A.

### Conceptual visualizers

- `image-container` — image cube emits container cubes via `spawn()`. Click "Spawn container" to drive the recipe-vs-meal point.
- `density-race` — server rack fills with bare-metal / VM / container modes. Visual count-up.
- `cold-start` — two horizontal racers, VM vs container, animated boot times.
- `cve-hunt` — orbiting red dots (CVEs) shrink as you switch tiers (normal → hardened → distroless).
- `cluster-topology` — 2 server platforms, 92 pods placed by real namespace counts. Filter by namespace.

### Interactive games

- `self-healing` — click pods (raycaster) to kill them; setTimeout-based respawn.
- `pod-scaling` — load slider drives reconcile loop; pods appear / fade based on simulated CPU.
- `rolling-deploy` — `await`-driven sequence: spawn v2, wait, kill v1, repeat per replica.
- `traffic-wave` — sine-wave load auto-generator + flowing request particles + drop counter.
- `chaos` — kill a node, evicted pods arc over to the surviving node.
- `canary` — % traffic slider; particles colour-shift based on which version they hit.
- `service-routing` — service in middle, pods around it, traffic particles flow client → service → pod.

### Pipeline / network

- `deploy-race` — 3 lanes (manual / docker / k8s) with different speeds.
- `edge-to-pod` — Internet → CDN → cloud-provider edge → ingress controller → Service → Pods, request particles step through stations, response flows back. Station names in the scaffold are generic placeholders (`cdn`, `cloud`, `ingress`); rename to match your actual stack when forking the template.

## Common patterns

### Raycasting (clickable scenes)

Used by `self-healing`. Set `canvas.style.pointerEvents = 'auto'` only while on this slide:

```js
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function onPointerMove(canvas, ev) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}
function onClick(canvas, ev) {
  onPointerMove(canvas, ev);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(targetMeshes, false);
  if (hits.length > 0) doSomething(hits[0].object);
}
```

In the slide controller, toggle interactivity per slide:

```js
function setCanvasInteractive(sceneName) {
  const canvas = document.getElementById("bg-canvas");
  canvas.style.pointerEvents = sceneName ? "auto" : "none";
  canvasInteractiveScene = sceneName;
}
```

### Particle pool

For traffic-flow style scenes, allocate once and recycle:

```js
const PARTICLE_COUNT = 60;
const particles = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const m = new THREE.Mesh(geom, material.clone());
  m.userData = { active: false };
  scene.add(m);
  particles.push(m);
}

function emitOne() {
  const idle = particles.find((p) => !p.userData.active);
  if (!idle) return;
  idle.userData = { active: true /* ... */ };
}
```

### Aurora gradient shader

Custom `ShaderMaterial` with a simplex-noise fragment shader. The colour uniform is the section accent. Section dividers call `scenes.aurora.setColor(ACCENT[color])` whenever the slide changes.

### Sub-scene that shifts the world origin

If you offset a scene with `scene.position.y = 3.5` (to push the visible area into the upper viewport), child positions are local. **Critical:** when targeting a child via `getWorldPosition(wp)`, convert back to scene-local:

```js
const wp = new THREE.Vector3();
target.getWorldPosition(wp);
scene.worldToLocal(wp); // <-- without this, particles aim 3.5 units off
particle.userData.target = wp;
```

Or compute manually using the parent group's local position:

```js
const podLocal = new THREE.Vector3()
  .copy(podsGroup.position)
  .add(target.position);
particle.userData.target = podLocal;
```

This is exactly the bug we hit on the edge-to-pod scene.
