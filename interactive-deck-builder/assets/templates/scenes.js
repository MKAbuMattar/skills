// scenes.js — Three.js scene framework for the deck.
//
// One <canvas>, one WebGLRenderer, many scenes. Scenes are factory
// functions registered in the `scenes` map by name; slides reference
// them via `data-scene="<name>"` and the framework swaps the active
// scene as the user navigates.
//
// THIS FILE IS THE FRAMEWORK + TWO MINIMAL AMBIENT SCENES:
//   - particles : title-slide ambient (floating points)
//   - aurora    : section-divider ambient (color-shifting gradient)
//
// All other scenes are BUILT PER DECK from the patterns in
// references/scene-recipes.md. Do NOT copy a pre-baked topic-specific
// scene from somewhere else — author it for the concept your deck is
// actually about.
//
// To add a new scene:
//   1. Read references/scene-recipes.md and pick the closest pattern.
//   2. Add a `function create<YourScene>() { ... }` that returns the
//      contract: { scene, camera, update, setColor, ... }.
//   3. Register it: scenes["<your-scene-name>"] = create<YourScene>();
//   4. Add `data-scene="<your-scene-name>"` to the slide.

import * as THREE from "three";

// ─── Renderer ────────────────────────────────────────────────────────

const canvas = document.getElementById("bg-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  for (const s of Object.values(scenes)) {
    if (s && s.onResize) s.onResize(window.innerWidth, window.innerHeight);
  }
});

// ─── Section accent palette ──────────────────────────────────────────
//
// Each slide has a `data-color="<key>"` attribute. When the slide
// activates, the framework calls `scene.setColor(ACCENT[key])` so the
// scene picks up the section's mood color. Every scene that should
// participate in the design system implements `setColor`.

const ACCENT = {
  teal: new THREE.Color("#14b8a6"),
  red: new THREE.Color("#f87171"),
  purple: new THREE.Color("#a78bfa"),
  amber: new THREE.Color("#fbbf24"),
  green: new THREE.Color("#34d399"),
  blue: new THREE.Color("#60a5fa"),
  cyan: new THREE.Color("#22d3ee"),
  rose: new THREE.Color("#fb7185"),
  "deep-purple": new THREE.Color("#c084fc"),
};

// ─── Scene: particles (title-slide ambient) ──────────────────────────

function createParticlesScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 50;

  const COUNT = 800;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: ACCENT.teal,
    size: 1.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geom, mat);
  scene.add(points);

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(dt) {
      points.rotation.y += dt * 0.04;
      points.rotation.x += dt * 0.02;
    },
    setColor(c) {
      mat.color.copy(c);
    },
    teardown() {
      geom.dispose();
      mat.dispose();
    },
  };
}

// ─── Scene: aurora (section-divider ambient) ─────────────────────────

function createAuroraScene(soft = false) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    u_time: { value: 0 },
    u_color: { value: new THREE.Color(ACCENT.teal) },
    u_resolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    u_intensity: { value: soft ? 0.45 : 0.85 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float u_time;
      uniform vec3 u_color;
      uniform vec2 u_resolution;
      uniform float u_intensity;

      vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
      vec2 mod289(vec2 x){return x - floor(x * (1.0/289.0)) * 289.0;}
      vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 uv = vUv;
        float t = u_time * 0.06;
        float n1 = snoise(vec2(uv.x * 1.6 + t,     uv.y * 2.0 - t * 0.5));
        float n2 = snoise(vec2(uv.x * 3.0 - t*0.7, uv.y * 1.2 + t * 0.3)) * 0.5;
        float n  = (n1 + n2) * 0.5 + 0.5;
        float d = distance(uv, vec2(0.5));
        float vignette = smoothstep(0.95, 0.25, d);
        float intensity = pow(n, 2.5) * u_intensity * vignette;
        vec3 col = u_color * intensity;
        col += vec3(0.02, 0.02, 0.04) * (1.0 - intensity);
        gl_FragColor = vec4(col, intensity * 0.95);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  return {
    scene,
    camera,
    onResize(w, h) {
      uniforms.u_resolution.value.set(w, h);
    },
    update(dt, t) {
      uniforms.u_time.value = t;
    },
    setColor(c) {
      uniforms.u_color.value.copy(c);
    },
    teardown() {
      quad.geometry.dispose();
      material.dispose();
    },
  };
}

// ─── Scene registry ──────────────────────────────────────────────────
//
// Add new scenes here. Names are matched against `data-scene` on slides.

const scenes = {
  particles: createParticlesScene(),
  aurora: createAuroraScene(false),
  "aurora-soft": createAuroraScene(true),

  // Add scene factories per deck. Recipes in references/scene-recipes.md.
  // Examples:
  //   "race":             createRaceScene(),
  //   "particle-flow":    createParticleFlowScene(),
  //   "click-to-destroy": createClickToDestroyScene(),
  //   "growth":           createGrowthScene(),
  //   "force-graph":      createForceGraphScene(),
  //   ...
};

// ─── Active scene + slide observer ───────────────────────────────────

let active = null;

/**
 * Activate a scene by name. Called by presentation.js when the user
 * navigates to a slide with `data-scene="<name>"`. Idempotent.
 */
export function activateScene(name, accentKey) {
  const next = scenes[name];
  if (!next || next === active) {
    if (active && accentKey) active.setColor?.(ACCENT[accentKey]);
    return;
  }
  active = next;
  if (accentKey) active.setColor?.(ACCENT[accentKey]);

  // Toggle pointer events: only enable raycasting on scenes that opt in.
  canvas.style.pointerEvents = active.onPointerDown ? "auto" : "none";
}

/**
 * Update the active scene's accent color (called when a slide changes
 * data-color without changing data-scene).
 */
export function setActiveAccent(accentKey) {
  if (active && ACCENT[accentKey]) active.setColor?.(ACCENT[accentKey]);
}

/** Forward a pointer event to the active scene if it raycasts. */
canvas.addEventListener("pointerdown", (ev) => {
  if (active && active.onPointerDown) active.onPointerDown(ev);
});

/** Reset the active scene to its initial state. Called by Reset buttons. */
export function resetActiveScene() {
  if (active && active.reset) active.reset();
}

/** Expose the registry for per-scene UI wiring (set up by presentation.js). */
export function getScene(name) {
  return scenes[name];
}

// ─── Render loop ─────────────────────────────────────────────────────

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // Tick all scenes — cheap, decouples timing from active state.
  for (const s of Object.values(scenes)) {
    if (s && s.update) s.update(dt, t);
  }

  renderer.clear();
  if (active) renderer.render(active.scene, active.camera);
}
animate();

// ─── Re-exports useful elsewhere ─────────────────────────────────────

export { ACCENT, renderer, canvas };
