# Scene recipes

Structural recipes for the common scene patterns. Each recipe is a **shape**, not a finished implementation — pick the closest match, fill in the metaphor that fits your deck's concept, write the Three.js. For Three.js fundamentals (geometries, materials, lighting, performance), defer to a `threejs-webgl` skill.

Every recipe assumes the integration contract from `references/threejs-scenes.md`: a factory function returning `{ scene, camera, update, setColor, ... }` registered in the `scenes` map.

---

## Recipe 1 — Race / N-lane competition

**Use when:** comparing approaches, benchmarking, A/B, before/after, "this is how long X takes vs Y".

**Shape:**

- N parallel lanes (planes or cylinders).
- One marker per lane, animating along the lane's length at a different speed.
- A finish line; markers stop on cross.
- Optional clock / countdown.

**Implementation sketch:**

```javascript
function createRaceScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 4, 14);
  camera.lookAt(0, 0, 0);

  // ... lights ...

  const lanes = [];
  const SPEEDS = [
    /* per-lane m/s */
  ];
  const NAMES = [
    /* per-lane label */
  ];

  // Build N lanes; each adds a marker mesh to `lanes` array with userData
  // for speed and finished flag.

  let running = false;

  return {
    scene,
    camera,
    update(dt) {
      if (!running) return;
      lanes.forEach((m) => {
        if (m.userData.finished) return;
        m.position.x += m.userData.speed * dt;
        if (m.position.x >= FINISH_X) m.userData.finished = true;
      });
      onChange?.({ progress: lanes.map((m) => m.position.x / FINISH_X) });
    },
    start() {
      running = true;
    },
    reset() {
      lanes.forEach((m) => {
        m.position.x = -START_X;
        m.userData.finished = false;
      });
      running = false;
    },
    setColor(c) {
      /* recolor lane lines or the active-lane indicator */
    },
    setOnChange(cb) {
      onChange = cb;
    },
  };
}
```

**UI tile pattern:** show per-lane progress %, leader, time elapsed.

---

## Recipe 2 — Particle flow / staged pipeline

**Use when:** process flow, request-response, supply chain, transformation pipeline, stepped progression.

**Shape:**

- N stations arranged in a line (or arc).
- Particles emit at the source, move toward each station in sequence, terminate at the sink.
- Optional response path: same particles flow back.

**Key gotcha:** if the scene is offset (`scene.position.y = 3.5` to push it into the upper viewport), particles must use scene-local target coordinates. Convert via `scene.worldToLocal(target)` before assigning to `particle.userData.target`.

**Implementation sketch:**

```javascript
function createPipelineScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 5, 21);
  camera.lookAt(0, 4, 0);
  scene.position.y = 3.5; // push into upper viewport

  const STAGES = [
    { name: "stage-a", x: -7.0 },
    { name: "stage-b", x: -3.5 },
    { name: "stage-c", x: 0.0 },
    { name: "stage-d", x: 3.5 },
    { name: "stage-e", x: 7.5 },
  ];

  // Build station meshes. Build a particle pool (don't allocate per-spawn).

  function spawnParticle() {
    // grab from pool, set position to source, set userData.targetIndex = 0
  }

  return {
    scene,
    camera,
    update(dt) {
      // For each active particle: move toward STAGES[targetIndex] at fixed speed.
      // On arrival, advance targetIndex; if last, return to pool.
    },
    sendOne() {
      spawnParticle();
    },
    sendBurst(n) {
      for (let i = 0; i < n; i++) setTimeout(spawnParticle, i * 50);
    },
    setColor(c) {
      /* recolor particles + station rings */
    },
    setOnChange(cb) {
      onChange = cb;
    },
    reset() {
      /* return all particles to pool, reset counters */
    },
  };
}
```

**UI tile pattern:** per-stage throughput, total in-flight, total completed.

---

## Recipe 3 — Click-to-destroy + respawn

**Use when:** self-healing, redundancy, resilience, fault tolerance, ecology, immune response.

**Shape:**

- A grid / cluster of N targets (boxes, spheres, whatever fits the metaphor).
- The user clicks one (raycaster) → it disappears.
- A timer respawns it after some delay.
- Counters track destructions and respawns.

**Implementation sketch:**

```javascript
function createSelfHealingScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 4, 14);

  const TARGETS = 12;
  const targets = [];
  let onChange = null;
  let killed = 0,
    respawned = 0;

  // Build TARGETS meshes in a layout. Push to `targets`.

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onPointerDown(ev) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(targets);
    if (hits.length === 0) return;
    const hit = hits[0].object;
    hit.visible = false;
    killed++;
    onChange?.({
      alive: targets.filter((t) => t.visible).length,
      killed,
      respawned,
    });
    setTimeout(() => {
      hit.visible = true;
      respawned++;
      onChange?.({
        alive: targets.filter((t) => t.visible).length,
        killed,
        respawned,
      });
    }, 1200);
  }

  return {
    scene,
    camera,
    onPointerDown, // signals the framework to enable canvas pointer events
    update() {
      /* idle animation */
    },
    setColor(c) {
      targets.forEach((t) => t.material.color.copy(c));
    },
    setOnChange(cb) {
      onChange = cb;
    },
    reset() {
      targets.forEach((t) => (t.visible = true));
      killed = 0;
      respawned = 0;
    },
  };
}
```

**UI tile pattern:** alive count, kills, respawns, "self-heal latency".

---

## Recipe 4 — Density / fill-up

**Use when:** scaling, growth, population, capacity, "how big can it get".

**Shape:**

- A container (box, room, planet, jar).
- A counter that increments (button or slider).
- Each increment spawns one item inside the container.
- Items pack until full.

**Implementation sketch:**

```javascript
function createGrowthScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 4, 12);

  const CAPACITY = 200;
  const items = [];
  let onChange = null;

  function add() {
    if (items.length >= CAPACITY) return;
    // Spawn a small mesh at a randomized position inside the container.
    items.push(/* new mesh */);
    onChange?.({ count: items.length, full: items.length >= CAPACITY });
  }

  return {
    scene,
    camera,
    add,
    update() {
      /* gentle settling animation */
    },
    setColor(c) {
      items.forEach((it) => it.material?.color.copy(c));
    },
    setOnChange(cb) {
      onChange = cb;
    },
    reset() {
      /* remove all items */
    },
  };
}
```

**UI tile pattern:** count / capacity, fill %, time-to-full.

---

## Recipe 5 — Slider-driven scale-up / scale-down

**Use when:** autoscaling, demand response, dynamic allocation, "how does it react to load".

**Shape:**

- A reactive component (cluster of objects).
- A slider drives an external "load" or "demand" value.
- A reconcile loop changes the count of objects to match demand.

**Implementation sketch:**

```javascript
function createScalingScene() {
  let load = 0; // 0–100 from slider
  let replicas = 1; // current count of objects in scene
  const objects = [];

  function reconcile() {
    const target = Math.max(1, Math.min(MAX, Math.ceil(load / 25)));
    while (replicas < target) {
      /* spawn */ replicas++;
    }
    while (replicas > target) {
      /* despawn */ replicas--;
    }
    onChange?.({ load, replicas, target });
  }

  return {
    setLoad(v) {
      load = v;
      reconcile();
    },
    update() {
      /* animate active objects */
    },
    setColor(c) {
      objects.forEach((o) => o.material.color.copy(c));
    },
    setOnChange(cb) {
      onChange = cb;
    },
    reset() {
      load = 0;
      reconcile();
    },
    /* scene, camera */
  };
}
```

**UI tile pattern:** load %, replicas, target replicas, threshold-state ("idle" / "scaling up" / "at max").

---

## Recipe 6 — Force-directed graph

**Use when:** networks, dependency graphs, social structures, organizational charts, related-things visualization.

**Shape:**

- N nodes (spheres) with random initial positions.
- M edges between nodes (line segments).
- Each frame: apply attraction along edges (Hooke's law) and repulsion between all nodes (Coulomb's law). Integrate positions.
- Optional: drag a node to perturb the layout.

**Performance note:** O(N²) repulsion is fine up to ~100 nodes. For more, use Barnes-Hut or restrict repulsion to a neighborhood. Don't allocate inside the update loop — reuse `Vector3` buffers.

**Implementation sketch:**

```javascript
function createForceGraphScene() {
  const nodes = []; // { mesh, vel: Vector3, fixed: bool }
  const edges = []; // { a, b, line }

  const _delta = new THREE.Vector3();

  function update(dt) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        _delta.subVectors(nodes[i].mesh.position, nodes[j].mesh.position);
        const dist2 = Math.max(0.01, _delta.lengthSq());
        _delta.multiplyScalar(REPULSE_K / dist2);
        nodes[i].vel.add(_delta);
        nodes[j].vel.sub(_delta);
      }
    }
    // Spring along edges
    edges.forEach(({ a, b }) => {
      _delta.subVectors(b.mesh.position, a.mesh.position);
      const len = _delta.length();
      _delta.multiplyScalar((SPRING_K * (len - REST_LEN)) / len);
      a.vel.add(_delta);
      b.vel.sub(_delta);
    });
    // Damping + integration
    nodes.forEach((n) => {
      if (n.fixed) return;
      n.vel.multiplyScalar(0.9);
      n.mesh.position.addScaledVector(n.vel, dt);
    });
    // Update edge geometries to match node positions
  }

  /* scene, camera, setColor, setOnChange, reset, ... */
}
```

**UI tile pattern:** node count, edge count, layout-energy (kinetic energy sum).

---

## Recipe 7 — Wave / sine-driven generator

**Use when:** load testing, oscillation, seasonal patterns, business cycles, periodic phenomena.

**Shape:**

- A "load value" oscillates as `load = base + amp * sin(time * freq + phase)`.
- A reactive component spawns / drops items based on the load.
- A graph shows the wave history.

**Implementation sketch:**

```javascript
function createWaveScene() {
  let baseLoad = 50,
    amp = 50,
    freq = 0.5,
    phase = 0;
  let running = false,
    time = 0;
  let served = 0,
    dropped = 0;
  let capacity = 60; // could be slider-driven from scaling scene

  return {
    update(dt) {
      if (!running) return;
      time += dt;
      const load = baseLoad + amp * Math.sin(time * freq + phase);
      const requests = Math.round(load * dt * 10);
      const handled = Math.min(requests, capacity * dt * 10);
      served += handled;
      dropped += requests - handled;
      onChange?.({ load, served, dropped, capacity });
    },
    start() {
      running = true;
    },
    stop() {
      running = false;
    },
    setCapacity(c) {
      capacity = c;
    },
    setColor(c) {
      /* recolor request particles + capacity bar */
    },
    setOnChange(cb) {
      onChange = cb;
    },
    reset() {
      time = 0;
      served = 0;
      dropped = 0;
      running = false;
    },
    /* scene, camera */
  };
}
```

**UI tile pattern:** current load, capacity, served, dropped, drop %.

---

## Recipe 8 — Topology / cluster view (filterable)

**Use when:** system maps, organizational charts, dataset categories, family trees, taxonomies.

**Shape:**

- Nodes laid out by category (concentric rings, grid grouped by group, columns).
- Filter buttons fade non-matching nodes to ~10% opacity.
- Optional: click a node to see metadata.

**Implementation sketch:**

```javascript
function createTopologyScene() {
  const items = []; // { mesh, category, group, label }

  return {
    highlight(category) {
      items.forEach((it) => {
        const match = !category || it.category === category;
        it.mesh.material.opacity = match ? 1.0 : 0.1;
      });
    },
    showAll() {
      items.forEach((it) => (it.mesh.material.opacity = 1.0));
    },
    setColor(c) {
      /* recolor by group */
    },
    setOnChange(cb) {
      onChange = cb;
    },
    /* scene, camera, update, reset */
  };
}
```

**UI tile pattern:** total items, items per category, currently highlighted category.

---

## Recipe 9 — Color-shift slider

**Use when:** A/B percentage rollouts, sentiment spectrum, before/after gradient, demographic split.

**Shape:**

- A field of items.
- A slider 0-100 sets a "shift point".
- Items below the shift get color A; items above get color B; items near the shift get an interpolated mix.

**Implementation sketch:**

```javascript
function createColorShiftScene() {
  const items = []; // each has userData.position01 in [0, 1]

  function applyShift(pct) {
    const cutoff = pct / 100;
    items.forEach((it) => {
      const p = it.userData.position01;
      const t = THREE.MathUtils.smoothstep(p, cutoff - 0.05, cutoff + 0.05);
      it.material.color.copy(colorA).lerp(colorB, t);
    });
    onChange?.({
      pct,
      leftCount: items.filter((i) => i.userData.position01 < cutoff).length,
    });
  }

  return {
    setPct(p) {
      applyShift(p);
    },
    setColor(c) {
      colorA.copy(c).multiplyScalar(0.4);
      colorB.copy(c);
      applyShift(currentPct);
    },
    /* scene, camera, update, setOnChange, reset */
  };
}
```

**UI tile pattern:** percent split, color-A count, color-B count.

---

## Recipe 10 — Hub-and-spoke (service routing / broadcast)

**Use when:** load balancing, message broadcast, distribution, service mesh, gravitational systems.

**Shape:**

- A central node (hub).
- N peripheral nodes (spokes).
- Particles flow from hub → spoke (or spoke → hub).
- Optional: kill / add / remove spokes; rerouting.

**Implementation sketch:**

```javascript
function createHubSpokeScene() {
  const hub = /* central mesh */;
  const spokes = [];          // { mesh, alive: bool }
  const particles = [];       // pool

  function spawn() {
    const liveSpokes = spokes.filter(s => s.alive);
    if (liveSpokes.length === 0) return;
    const target = liveSpokes[Math.floor(Math.random() * liveSpokes.length)];
    // emit a particle from hub.position toward target.mesh.position
  }

  return {
    addSpoke()    { /* push a new spoke mesh */ },
    removeSpoke() { /* mark last spoke dead, schedule removal */ },
    spawn,        // bind to a button or call from update at intervals
    update(dt) { /* tick particles toward their target; recycle on arrival */ },
    setColor(c) { /* hub + spokes + particles */ },
    setOnChange(cb) { onChange = cb; },
    reset() { /* restore initial spoke count + flush particles */ },
    /* scene, camera */
  };
}
```

**UI tile pattern:** alive spokes, total throughput, per-spoke load.

---

## Recipe 11 — Migration on failure

**Use when:** failover, evacuation, disaster recovery, ecological succession, redistribution.

**Shape:**

- N hosts arranged in a row.
- Items belong to hosts.
- Killing a host arcs its items toward the surviving hosts (parabolic trajectory).
- Restoring the host accepts items back.

**Implementation sketch:**

```javascript
function createMigrationScene() {
  const hosts = []; // { mesh, alive, items: [] }
  const inflight = []; // { mesh, source, target, t: 0 }

  function killHost(idx) {
    const dying = hosts[idx];
    dying.alive = false;
    const live = hosts.filter((h) => h.alive);
    dying.items.forEach((it) => {
      const target = live[Math.floor(Math.random() * live.length)];
      inflight.push({
        mesh: it,
        source: dying.mesh.position.clone(),
        target: target.mesh.position.clone(),
        t: 0,
        destHost: target,
      });
    });
    dying.items = [];
  }

  function update(dt) {
    inflight.forEach((m, i) => {
      m.t += dt * 1.2;
      if (m.t >= 1) {
        m.destHost.items.push(m.mesh);
        m.mesh.position.copy(m.destHost.mesh.position);
        inflight.splice(i, 1);
        return;
      }
      // Quadratic Bezier with a peaked control point
      const cp = m.source.clone().lerp(m.target, 0.5);
      cp.y += 2; // arc height
      const a = m.source.clone().lerp(cp, m.t);
      const b = cp.clone().lerp(m.target, m.t);
      m.mesh.position.copy(a.lerp(b, m.t));
    });
  }

  /* scene, camera, setColor, setOnChange, reset, ... */
}
```

**UI tile pattern:** alive hosts, total items, in-flight items, max-items-per-host.

---

## Recipe 12 — Comparison split-screen

**Use when:** before/after, manual-vs-automated, baseline-vs-optimized, A/B side-by-side.

**Shape:**

- Two camera viewports OR two halves of one scene.
- Same dataset rendered with method A on the left, method B on the right.
- Optional: synchronized cursor / hover state.

**Implementation sketch:**

```javascript
function createComparisonScene() {
  const scene = new THREE.Scene();
  const cameraL = new THREE.PerspectiveCamera(35, 0.5, 0.1, 100);
  const cameraR = new THREE.PerspectiveCamera(35, 0.5, 0.1, 100);
  cameraL.position.set(-4, 0, 8);
  cameraR.position.set(4, 0, 8);

  const groupA = new THREE.Group();
  const groupB = new THREE.Group();
  groupA.position.x = -4;
  groupB.position.x = 4;
  scene.add(groupA, groupB);

  // Build groupA with method A, groupB with method B.

  return {
    scene,
    camera: cameraL, // primary camera; renderer composites both halves
    update(dt) {
      /* animate both groups */
    },
    setColor(c) {
      /* apply to both groups, perhaps with subtle differentiation */
    },
    /* optionally render to two viewports — see threejs-webgl skill */
  };
}
```

**UI tile pattern:** key metric per side (latency, throughput, score) plus delta.

---

## Picking the right recipe

A short heuristic for matching concept to recipe:

| Concept                                 | Most likely recipe              |
| --------------------------------------- | ------------------------------- |
| "How fast is X compared to Y?"          | Race                            |
| "What happens when X moves through Y?"  | Particle flow / pipeline        |
| "What if X fails? Does it recover?"     | Click-to-destroy / Migration    |
| "How big can X get?"                    | Density / fill-up               |
| "How does X react to demand?"           | Slider-driven scale             |
| "What's connected to what?"             | Force-directed graph / Topology |
| "How does X behave over time?"          | Wave / sine-driven              |
| "Where do things get distributed?"      | Hub-and-spoke                   |
| "X ranges from A to B — show me"        | Color-shift slider              |
| "Method A vs method B on the same data" | Comparison split-screen         |

If your concept doesn't match any recipe, you're authoring something genuinely new — start with the contract from `references/threejs-scenes.md` and compose from Three.js primitives via the `threejs-webgl` skill.
