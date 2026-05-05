# Three.js scenes

How to write a scene that plugs into this framework. **This file teaches the integration pattern, not Three.js fundamentals.** For geometry / materials / lighting / performance / WebGL details, defer to a `threejs-webgl` skill.

## The scene factory contract

Every scene in `scenes.js` is a function returning a fixed-shape object:

```javascript
function createMyScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // ... add lights, meshes, helpers ...

  // Optional: state shared between update() and external UI
  let state = { count: 0, running: true };
  let onChange = null;

  // Return the contract
  return {
    scene,
    camera,
    update, // called every frame; receives (dt, time)
    setColor, // called on slide change with the section accent color
    setOnChange, // optional; lets presentation.js wire UI tile updates
    onPointerDown, // optional; raycasting handler if the scene is clickable
    reset, // optional; called when the user hits the "Reset" button
    teardown, // optional; called when the scene is unloaded
  };

  function update(dt, time) {
    // Per-frame work. Cheap. Don't allocate.
  }

  function setColor(hexColor) {
    // Apply the section accent color to materials, particles, etc.
  }

  function setOnChange(cb) {
    onChange = cb;
    // Inside the scene, call onChange(state) whenever state.count etc. changes
    // so the slide UI tiles can update without polling.
  }

  function onPointerDown(event) {
    // Raycast against meshes; do something on hit.
  }

  function reset() {
    // Restore initial state.
  }

  function teardown() {
    // Dispose geometries / materials / textures, remove event listeners.
  }
}
```

Then register:

```javascript
const scenes = {
  "my-scene": createMyScene,
  // ... other scenes ...
};
```

The slide that wants this scene declares `data-scene="my-scene"`. The framework loads / unloads scenes as the user navigates.

## Single canvas, shared renderer

The framework uses **one** `<canvas>` element and **one** `WebGLRenderer`. When the user switches slides:

1. The previous scene's `teardown()` is called (if defined).
2. The new scene's factory is called.
3. The new scene's `setColor(<accent>)` is called with the section's color.
4. The renderer's animation loop calls `update(dt, time)` every frame on the active scene.

Multiple canvases would multiply GPU memory. One canvas with scene-swap is the right shape for a deck.

## Accent-color sync

Each slide has a `data-color="<accent>"` attribute. When the slide loads, `presentation.js` calls `scene.setColor(ACCENT[<accent>])`. The scene applies the color to whichever surfaces should match the section's mood:

- Particle colors.
- Glow / aurora gradients.
- Emissive material `emissive` channel.
- Line / stroke colors on helpers.

Forgetting `setColor` is the #1 reason scenes look the same across sections.

## Raycasting (clickable scenes)

For scenes the user interacts with by clicking:

```javascript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerDown(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  if (hits.length > 0) {
    handleHit(hits[0]);
  }
}
```

The framework only enables canvas pointer events on slides that need raycasting:

```javascript
// presentation.js
if (currentScene.onPointerDown) {
  canvas.style.pointerEvents = "auto";
} else {
  canvas.style.pointerEvents = "none"; // clicks pass through to slide content
}
```

## Scene-local vs world coordinates

When a scene is offset (e.g. `scene.position.y = 3.5` to push it into the upper viewport), child positions are **scene-local**. If you target an object via `obj.getWorldPosition(wp)`, you must `scene.worldToLocal(wp)` before assigning to a particle whose movement is computed in scene-local space. Otherwise particles aim N units off the target and never visually arrive.

```javascript
// WRONG — particle aims at world coords but moves in scene-local
const target = new THREE.Vector3();
obj.getWorldPosition(target);
particle.userData.target = target.clone();

// RIGHT — convert to scene-local
const target = new THREE.Vector3();
obj.getWorldPosition(target);
scene.worldToLocal(target);
particle.userData.target = target;
```

## Animation loop

The renderer ticks once per frame. The active scene's `update(dt, time)` is called with delta-time in seconds and absolute time in seconds since epoch. **Don't allocate inside `update`** — reuse `Vector3` / `Quaternion` / temporary buffers declared at scene-creation time.

```javascript
const _tmpV = new THREE.Vector3(); // declare once

function update(dt, time) {
  particles.children.forEach((p) => {
    _tmpV.copy(p.userData.target).sub(p.position).multiplyScalar(0.1);
    p.position.add(_tmpV);
  });
}
```

A scene that allocates per-frame produces visible GC stutter at ~30 fps thresholds.

## Disposing on teardown

When a scene is unloaded, call `dispose()` on every geometry, material, and texture. The shared renderer holds GPU buffers; missing disposes leak memory across slide switches:

```javascript
function teardown() {
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        Object.values(m).forEach((v) => {
          if (v && v.isTexture) v.dispose();
        });
        m.dispose();
      });
    }
  });
  // remove any window-level listeners you registered
}
```

## Common scene patterns

The shipped `assets/templates/scenes.js` is intentionally minimal — it ships only `particles` (title ambient) and `aurora` / `aurora-soft` (divider ambient). **Every other scene is built per deck.** The framework teaches you HOW to build scenes; it does not ship ready-made topic-specific implementations.

For each common pattern (race, particle flow, click-to-destroy, density / fill-up, slider scaling, force-directed graph, wave generator, topology view, color-shift slider, hub-and-spoke, migration on failure, comparison split-screen), the building recipe — shape, key gotchas, implementation sketch, UI tile pattern — lives in **[`references/scene-recipes.md`](scene-recipes.md)**. Open that file when authoring a new scene.

For Three.js fundamentals (geometry, materials, lighting, animations, post-processing, performance), defer to a `threejs-webgl` skill. THIS skill teaches the deck-integration contract; the threejs-webgl skill teaches the 3D primitives.

## Adding a brand-new scene

1. **Pick the metaphor first.** "I want to show <X>" → "what physical thing behaves like <X>?" Don't code Three.js until you've answered this. The metaphor should be specific (boxes filling a room, particles flowing through gates, balls bouncing on a curve), not abstract ("a 3D representation of X").
2. **Find the closest recipe** in `references/scene-recipes.md`. Each recipe gives you the shape and an implementation sketch — fill in the geometries / materials / behavior to fit your metaphor.
3. **Write the factory** in `scenes.js` returning the contract (`scene`, `camera`, `update`, `setColor`, plus optional `onPointerDown`, `setOnChange`, `reset`, `teardown`).
4. **Register in the `scenes` map** with a descriptive name.
5. **Add `data-scene="<your-scene-name>"`** to the slide in `index.html`.
6. **Implement `setColor`** so the scene picks up the section accent on slide change.
7. **If interactive, implement `setOnChange`** and add a "PER-DECK WIRING" block in `presentation.js` that updates DOM stat tiles when the callback fires.
8. **If clickable, implement `onPointerDown`**; the framework auto-enables canvas pointer events when the active scene exposes that method.
9. **Implement `teardown`** that disposes geometries / materials / textures — the shared renderer leaks GPU memory if you skip this.
10. **Test in the browser.** Walk every state transition. Toggle fullscreen. Switch to another scene and back to verify teardown.

If your concept doesn't fit any of the recipes, you're authoring something genuinely new — start with the contract above and compose from Three.js primitives via the `threejs-webgl` skill.

## Anti-patterns

- **Allocating inside `update`** — produces GC stutter. Reuse declared-at-scene-creation buffers.
- **Forgetting `teardown` disposal** — GPU memory leaks across slide switches.
- **Using world coords without `worldToLocal`** when scene is offset — particles miss targets.
- **One-canvas-per-scene** — multiplies GPU memory. Use the shared renderer.
- **Hardcoding accent colors in the scene** — defeats the design system. Always use `setColor` from outside.
- **Treating Three.js fundamentals as part of this skill** — defer to `threejs-webgl`. This skill is the integration pattern.
