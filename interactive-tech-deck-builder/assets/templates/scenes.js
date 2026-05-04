// Three.js scenes for the Docker Fundamentals deck.
// One renderer, one canvas, multiple scenes swapped per slide:
//   - particles      : title slide (slide 1)
//   - aurora         : section dividers
//   - aurora-soft    : Q&A
//   - image-container: interactive image-vs-container reveal
//   - (default)      : empty / faint ambient

import * as THREE from "three";

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
    if (s.onResize) s.onResize(window.innerWidth, window.innerHeight);
  }
});

// ----- Section accent palette --------------------------------------

const ACCENT = {
  teal: new THREE.Color("#14b8a6"),
  red: new THREE.Color("#f87171"),
  purple: new THREE.Color("#a78bfa"),
  amber: new THREE.Color("#fbbf24"),
  green: new THREE.Color("#34d399"),
  blue: new THREE.Color("#60a5fa"),
  "deep-purple": new THREE.Color("#c084fc"),
  cyan: new THREE.Color("#22d3ee"),
  rose: new THREE.Color("#fb7185"),
};

// ----- Scene: Particles (title) ------------------------------------

function createParticlesScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 50;

  const COUNT = 800;
  const positions = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    sizes[i] = Math.random() * 2 + 0.5;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

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
    points,
    mat,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(dt, t) {
      points.rotation.y = t * 0.04;
      points.rotation.x = Math.sin(t * 0.1) * 0.08;
    },
    setColor(c) {
      mat.color.copy(c);
    },
  };
}

// ----- Scene: Aurora gradient (section dividers) -------------------

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

      // Simplex-ish noise
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

        // Multi-octave noise for soft aurora flow
        float n1 = snoise(vec2(uv.x * 1.6 + t,    uv.y * 2.0 - t * 0.5));
        float n2 = snoise(vec2(uv.x * 3.0 - t*0.7, uv.y * 1.2 + t * 0.3)) * 0.5;
        float n  = (n1 + n2) * 0.5 + 0.5;

        // Radial darkening so corners stay quiet
        float d = distance(uv, vec2(0.5));
        float vignette = smoothstep(0.95, 0.25, d);

        float intensity = pow(n, 2.5) * u_intensity * vignette;

        vec3 col = u_color * intensity;
        // Slight blue undertone in shadows
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
    uniforms,
    onResize(w, h) {
      uniforms.u_resolution.value.set(w, h);
    },
    update(dt, t) {
      uniforms.u_time.value = t;
    },
    setColor(c) {
      uniforms.u_color.value.copy(c);
    },
  };
}

// ----- Scene: Image vs Container (interactive) --------------------

function createImageContainerScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 2, 14);
  camera.lookAt(0, 0, 0);

  // Subtle lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x60a5fa, 0.6);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // The "image" — a wireframe glowing cube on the left
  const imageGroup = new THREE.Group();
  const imageMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x34d399,
    emissiveIntensity: 0.35,
    metalness: 0.2,
    roughness: 0.45,
    transparent: true,
    opacity: 0.85,
  });
  const imageBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.4, 2.4),
    imageMat,
  );
  imageGroup.add(imageBox);

  const imageWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.42, 2.42, 2.42)),
    new THREE.LineBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.9,
    }),
  );
  imageGroup.add(imageWire);

  imageGroup.position.set(-4.5, 0, 0);
  scene.add(imageGroup);

  // Floor reference
  const floorGeom = new THREE.PlaneGeometry(40, 20);
  const floorMat = new THREE.MeshBasicMaterial({
    color: 0x111113,
    transparent: true,
    opacity: 0.4,
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.6;
  scene.add(floor);

  // Containers — spawned dynamically, max 6
  const containers = [];
  const MAX = 6;
  const containerColors = [
    0x60a5fa, 0xa78bfa, 0xfbbf24, 0xc084fc, 0xf87171, 0x14b8a6,
  ];

  function spawn() {
    if (containers.length >= MAX) return;

    const idx = containers.length;
    const color = containerColors[idx % containerColors.length];

    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat);
    group.add(box);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.42, 1.42, 1.42)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }),
    );
    group.add(wire);

    // Position in a grid to the right of the image
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    group.userData.targetPos = new THREE.Vector3(
      1.5 + col * 2.1,
      1 - row * 2.1,
      0,
    );
    // Start at the image's position (so it appears to fly out)
    group.position.copy(imageGroup.position);

    // Connecting line to the source image
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      imageGroup.position.clone(),
      group.position.clone(),
    ]);
    const line = new THREE.Line(
      lineGeom,
      new THREE.LineDashedMaterial({
        color,
        dashSize: 0.15,
        gapSize: 0.1,
        transparent: true,
        opacity: 0,
      }),
    );
    line.computeLineDistances();

    scene.add(group);
    scene.add(line);
    containers.push({
      group,
      mat,
      wire,
      line,
      lineMat: line.material,
      birth: performance.now(),
      idx,
    });
  }

  function reset() {
    containers.forEach((c) => {
      scene.remove(c.group);
      scene.remove(c.line);
      c.group.children.forEach((child) => child.geometry?.dispose());
      c.line.geometry.dispose();
    });
    containers.length = 0;
  }

  function update(dt, t) {
    // Image: gentle rotation + pulse
    imageGroup.rotation.y += dt * 0.15;
    imageGroup.rotation.x = Math.sin(t * 0.3) * 0.06;
    imageMat.emissiveIntensity = 0.3 + Math.sin(t * 1.2) * 0.08;

    // Containers: ease toward target, fade in, drift
    const now = performance.now();
    containers.forEach((c) => {
      const age = (now - c.birth) / 1000; // seconds
      const ease = Math.min(1, age / 0.7);
      const eased = 1 - Math.pow(1 - ease, 3);

      c.group.position.lerpVectors(
        imageGroup.position,
        c.group.userData.targetPos,
        eased,
      );
      c.mat.opacity = 0.85 * eased;
      c.wire.material.opacity = 0.95 * eased;
      c.lineMat.opacity = 0.35 * eased;

      // Idle motion
      c.group.rotation.y += dt * (0.4 + c.idx * 0.05);
      c.group.rotation.x = Math.sin(t * 0.7 + c.idx) * 0.1;

      // Update line endpoints
      const positions = c.line.geometry.attributes.position;
      positions.setXYZ(
        0,
        imageGroup.position.x,
        imageGroup.position.y,
        imageGroup.position.z,
      );
      positions.setXYZ(
        1,
        c.group.position.x,
        c.group.position.y,
        c.group.position.z,
      );
      positions.needsUpdate = true;
      c.line.computeLineDistances();
    });
  }

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    spawn,
    reset,
    count: () => containers.length,
  };
}

// ----- Scene: Density Race (on-prem vs VMs vs containers) ---------

function createDensityRaceScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(0, 7, 18);
  camera.lookAt(0, 2, 0);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(8, 12, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x22d3ee, 0.45);
  rim.position.set(-6, 4, -4);
  scene.add(rim);

  // Server rack baseplate
  const rackW = 11,
    rackD = 7,
    rackH = 0.3;
  const rack = new THREE.Mesh(
    new THREE.BoxGeometry(rackW, rackH, rackD),
    new THREE.MeshStandardMaterial({
      color: 0x1f1f24,
      metalness: 0.65,
      roughness: 0.45,
    }),
  );
  rack.position.y = -rackH / 2;
  scene.add(rack);

  // Rack outline
  const rackEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(rackW + 0.04, rackH + 0.04, rackD + 0.04),
    ),
    new THREE.LineBasicMaterial({ color: 0x52525b }),
  );
  rackEdges.position.y = -rackH / 2;
  scene.add(rackEdges);

  // Server label posts (just for visual interest)
  for (let i = -1; i <= 1; i += 2) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x71717a,
        metalness: 0.6,
        roughness: 0.4,
      }),
    );
    post.position.set(i * (rackW / 2 - 0.3), 0.05, rackD / 2 - 0.3);
    scene.add(post);
  }

  // Mode groups
  const groups = {
    bare: new THREE.Group(),
    vm: new THREE.Group(),
    container: new THREE.Group(),
  };
  Object.values(groups).forEach((g) => scene.add(g));

  // Host kernel layer (only for container mode)
  const hostKernel = new THREE.Mesh(
    new THREE.BoxGeometry(rackW - 0.6, 0.35, rackD - 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.18,
      metalness: 0.4,
      roughness: 0.5,
      transparent: true,
      opacity: 0.85,
    }),
  );
  hostKernel.position.y = 0.25;
  groups.container.add(hostKernel);

  const hostKernelLabel = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(rackW - 0.55, 0.4, rackD - 0.55),
    ),
    new THREE.LineBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.9,
    }),
  );
  hostKernelLabel.position.y = 0.25;
  groups.container.add(hostKernelLabel);

  let mode = "bare";
  const items = [];

  function setMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    Object.entries(groups).forEach(([name, g]) => {
      g.visible = name === mode;
    });
    reset();
  }

  function reset() {
    // Remove all dynamic items but keep static elements (host kernel)
    items.forEach((it) => {
      const root = it.group || it.mesh;
      root.parent?.remove(root);
      root.traverse?.((obj) => {
        obj.geometry?.dispose();
        obj.material?.dispose();
      });
    });
    items.length = 0;
  }

  function deploy() {
    const now = performance.now();

    if (mode === "bare") {
      if (items.length >= 1) return false;
      const w = rackW - 1.2,
        h = 4.6,
        d = rackD - 1.2;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        emissive: 0xfb7185,
        emissiveIntensity: 0.15,
        metalness: 0.25,
        roughness: 0.5,
        transparent: true,
        opacity: 0,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.y = h / 2 + 0.1;
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
        new THREE.LineBasicMaterial({
          color: 0xfb7185,
          transparent: true,
          opacity: 0,
        }),
      );
      wire.position.copy(box.position);
      groups.bare.add(box);
      groups.bare.add(wire);
      items.push({
        mesh: box,
        wire,
        birth: now,
        target: box.position.clone(),
        spawnY: 8,
      });
      box.position.y = 8;
      wire.position.y = 8;
      return true;
    }

    if (mode === "vm") {
      if (items.length >= 4) return false;
      const idx = items.length;
      const vmW = rackW - 1.4;
      const vmD = rackD - 1.4;
      const vmH = 1.0;
      const grp = new THREE.Group();

      // Guest OS layer (60% of VM height, dark gray)
      const os = new THREE.Mesh(
        new THREE.BoxGeometry(vmW, vmH * 0.6, vmD),
        new THREE.MeshStandardMaterial({
          color: 0x52525b,
          metalness: 0.4,
          roughness: 0.6,
          transparent: true,
          opacity: 0,
        }),
      );
      os.position.y = -vmH * 0.2;
      grp.add(os);
      const osWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(vmW, vmH * 0.6, vmD)),
        new THREE.LineBasicMaterial({
          color: 0x71717a,
          transparent: true,
          opacity: 0,
        }),
      );
      osWire.position.copy(os.position);
      grp.add(osWire);

      // App layer (40% of VM height, amber)
      const app = new THREE.Mesh(
        new THREE.BoxGeometry(vmW - 0.2, vmH * 0.4, vmD - 0.2),
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xfbbf24,
          emissiveIntensity: 0.18,
          metalness: 0.25,
          roughness: 0.45,
          transparent: true,
          opacity: 0,
        }),
      );
      app.position.y = vmH * 0.3;
      grp.add(app);

      const targetY = 0.3 + vmH / 2 + idx * (vmH + 0.18);
      grp.userData.target = new THREE.Vector3(0, targetY, 0);
      grp.position.set(0, 9, 0);
      groups.vm.add(grp);
      items.push({ group: grp, birth: now });
      return true;
    }

    if (mode === "container") {
      if (items.length >= 20) return false;
      const idx = items.length;
      const cols = 5,
        rows = 4;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cw = 1.3;
      const xStart = -((cols - 1) * 1.6) / 2;
      const zStart = -((rows - 1) * 1.2) / 2;

      const colors = [0x60a5fa, 0xa78bfa, 0xfbbf24, 0x34d399, 0xf87171];
      const color = colors[idx % colors.length];

      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.22,
        metalness: 0.3,
        roughness: 0.5,
        transparent: true,
        opacity: 0,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(cw, cw, cw), mat);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(
          new THREE.BoxGeometry(cw + 0.02, cw + 0.02, cw + 0.02),
        ),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }),
      );

      const targetX = xStart + col * 1.6;
      const targetZ = zStart + row * 1.2;
      const targetY = 0.45 + cw / 2;
      box.userData.target = new THREE.Vector3(targetX, targetY, targetZ);
      wire.userData.target = box.userData.target;

      // Spawn from above
      box.position.set(targetX, 8 + Math.random() * 2, targetZ);
      wire.position.copy(box.position);
      groups.container.add(box);
      groups.container.add(wire);
      items.push({ mesh: box, wire, birth: now });
      return true;
    }
    return false;
  }

  function update(dt, t) {
    const now = performance.now();

    // Animate items: ease into target position + fade in
    items.forEach((item) => {
      const age = (now - item.birth) / 1000;
      const ease = Math.min(1, age / 0.6);
      const eased = 1 - Math.pow(1 - ease, 3);

      // Bare metal: rises into place
      if (item.mesh && item.target) {
        item.mesh.position.y = THREE.MathUtils.lerp(
          item.spawnY,
          item.target.y,
          eased,
        );
        if (item.wire) item.wire.position.y = item.mesh.position.y;
        item.mesh.material.opacity = 0.9 * eased;
        if (item.wire) item.wire.material.opacity = 0.95 * eased;
      }
      // VM: drops into stack position
      else if (item.group) {
        const target = item.group.userData.target;
        item.group.position.lerp(target, eased * 0.18 + 0.05);
        item.group.children.forEach((child) => {
          if (child.material) child.material.opacity = 0.9 * eased;
        });
      }
      // Container: falls into grid
      else if (item.mesh && item.mesh.userData.target) {
        const target = item.mesh.userData.target;
        item.mesh.position.lerp(target, eased * 0.18 + 0.05);
        item.wire.position.copy(item.mesh.position);
        item.mesh.material.opacity = 0.9 * eased;
        item.wire.material.opacity = 0.95 * eased;
        // Idle wobble
        item.mesh.rotation.y = Math.sin(t * 0.6 + items.indexOf(item)) * 0.05;
        item.wire.rotation.y = item.mesh.rotation.y;
      }
    });

    // Subtle whole-scene rotation for parallax
    scene.rotation.y = Math.sin(t * 0.12) * 0.05;

    // Host kernel pulse (cyan glow)
    hostKernel.material.emissiveIntensity = 0.16 + Math.sin(t * 1.4) * 0.05;
  }

  // Start in bare mode
  Object.entries(groups).forEach(([name, g]) => (g.visible = name === "bare"));

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    setMode,
    reset,
    deploy,
    count: () => items.length,
    mode: () => mode,
    limit: () => (mode === "bare" ? 1 : mode === "vm" ? 4 : 20),
  };
}

// ----- Scene: Cold-Start Race (VM vs Container boot time) ---------

function createColdStartScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 3, 16);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(4, 8, 6);
  scene.add(key);

  // Two race tracks
  const TRACK_LEN = 14;
  const trackY = (z) => z;

  function makeTrack(yPos, color, label) {
    const grp = new THREE.Group();
    grp.position.y = yPos;

    // Track surface
    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_LEN, 1.6),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1f,
        metalness: 0.3,
        roughness: 0.7,
      }),
    );
    track.rotation.x = -Math.PI / 2;
    track.position.y = -0.1;
    grp.add(track);

    // Start/finish lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0x71717a });
    [-TRACK_LEN / 2, TRACK_LEN / 2].forEach((x) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, -0.8),
        new THREE.Vector3(x, 0.01, 0.8),
      ]);
      grp.add(new THREE.Line(g, lineMat));
    });

    // Phase markers along the track (5 segments)
    const phases = label === "VM" ? 5 : 2;
    for (let i = 1; i < phases; i++) {
      const x = -TRACK_LEN / 2 + (i / phases) * TRACK_LEN;
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, -0.4),
        new THREE.Vector3(x, 0.01, 0.4),
      ]);
      grp.add(
        new THREE.Line(
          g,
          new THREE.LineDashedMaterial({
            color: 0x52525b,
            dashSize: 0.08,
            gapSize: 0.06,
          }),
        ),
      );
    }

    // Racer box
    const racer = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        metalness: 0.3,
        roughness: 0.4,
      }),
    );
    racer.position.x = -TRACK_LEN / 2;
    racer.position.y = 0.4;
    grp.add(racer);

    // Wire glow
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.82, 0.82, 0.82)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }),
    );
    racer.add(wire);

    scene.add(grp);
    return { group: grp, racer, color, label };
  }

  const vmTrack = makeTrack(0.8, 0xfbbf24, "VM");
  const containerTrack = makeTrack(-1.2, 0x22d3ee, "Container");

  let raceState = "idle"; // idle | running | done
  let raceStart = 0;
  // Animation duration in real seconds (scaled from real boot times)
  // VM: 30s real → 4s animation; Container: 0.7s real → 0.1s animation
  const VM_DUR = 4.0;
  const CONTAINER_DUR = 0.18;
  let onUpdate = null;

  function startRace(progressCallback) {
    raceState = "running";
    raceStart = performance.now();
    onUpdate = progressCallback || null;
    // Reset positions
    vmTrack.racer.position.x = -TRACK_LEN / 2;
    containerTrack.racer.position.x = -TRACK_LEN / 2;
  }
  function reset() {
    raceState = "idle";
    vmTrack.racer.position.x = -TRACK_LEN / 2;
    containerTrack.racer.position.x = -TRACK_LEN / 2;
    onUpdate = null;
  }

  function update(dt, t) {
    if (raceState === "running") {
      const elapsed = (performance.now() - raceStart) / 1000;
      const vmT = Math.min(1, elapsed / VM_DUR);
      const containerT = Math.min(1, elapsed / CONTAINER_DUR);
      // Slight ease-out
      const easeVM = 1 - Math.pow(1 - vmT, 2);
      const easeC = 1 - Math.pow(1 - containerT, 2);

      vmTrack.racer.position.x = -TRACK_LEN / 2 + easeVM * TRACK_LEN;
      containerTrack.racer.position.x = -TRACK_LEN / 2 + easeC * TRACK_LEN;

      if (onUpdate)
        onUpdate({
          elapsed,
          vmDone: vmT >= 1,
          containerDone: containerT >= 1,
        });

      if (vmT >= 1 && containerT >= 1) {
        raceState = "done";
      }
    }

    // Idle bobbing & glow
    [vmTrack, containerTrack].forEach((tr) => {
      tr.racer.rotation.y += dt * 0.7;
      tr.racer.material.emissiveIntensity = 0.25 + Math.sin(t * 2) * 0.1;
    });

    scene.rotation.y = Math.sin(t * 0.1) * 0.02;
  }

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    startRace,
    reset,
    state: () => raceState,
  };
}

// ----- Scene: CVE Hunt (security tier visualizer) ------------------

function createCVEHuntScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const point = new THREE.PointLight(0xffffff, 0.8, 50);
  point.position.set(0, 0, 8);
  scene.add(point);

  // Container "image" represented as a sphere
  const imageMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    emissive: 0x222226,
    emissiveIntensity: 0.4,
    metalness: 0.6,
    roughness: 0.5,
    transparent: true,
    opacity: 0.75,
  });
  const imageSphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.6, 1),
    imageMat,
  );
  scene.add(imageSphere);

  const imageWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.65, 1)),
    new THREE.LineBasicMaterial({
      color: 0x52525b,
      transparent: true,
      opacity: 0.6,
    }),
  );
  scene.add(imageWire);

  // CVE dots — orbiting the sphere
  const TIER_COUNTS = { normal: 47, hardened: 4, distroless: 0 };
  const TIER_COLORS = {
    normal: 0xf87171,
    hardened: 0xfbbf24,
    distroless: 0x34d399,
  };
  const MAX_DOTS = 47;

  const dots = [];
  const dotGeom = new THREE.SphereGeometry(0.09, 12, 12);

  for (let i = 0; i < MAX_DOTS; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf87171,
      emissive: 0xf87171,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(dotGeom, mat);

    // Random spherical orbit
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = 3.2 + Math.random() * 0.5;

    mesh.userData = {
      r,
      phi,
      theta,
      phiSpeed: (Math.random() - 0.5) * 0.3,
      thetaSpeed: 0.2 + Math.random() * 0.4,
      visible: false,
      birth: 0,
    };
    scene.add(mesh);
    dots.push(mesh);
  }

  let activeTier = "normal";
  let lastChangeTime = 0;

  function setTier(tier) {
    if (!(tier in TIER_COUNTS)) return;
    activeTier = tier;
    lastChangeTime = performance.now();
    const count = TIER_COUNTS[tier];
    const color = TIER_COLORS[tier];
    dots.forEach((d, i) => {
      const wantVisible = i < count;
      d.userData.visible = wantVisible;
      d.userData.birth = performance.now();
      d.material.color.setHex(color);
      d.material.emissive.setHex(color);
    });
  }

  function update(dt, t) {
    // Image sphere rotates slowly
    imageSphere.rotation.y += dt * 0.15;
    imageSphere.rotation.x = Math.sin(t * 0.3) * 0.1;
    imageWire.rotation.copy(imageSphere.rotation);
    // Pulse based on tier (red pulses stronger)
    const pulse =
      activeTier === "normal" ? 0.5 : activeTier === "hardened" ? 0.3 : 0.2;
    imageMat.emissiveIntensity = pulse + Math.sin(t * 1.5) * 0.1;

    // Animate each dot
    const now = performance.now();
    dots.forEach((d) => {
      d.userData.theta += dt * d.userData.thetaSpeed;
      d.userData.phi += dt * d.userData.phiSpeed * 0.1;

      const r = d.userData.r;
      const x = r * Math.sin(d.userData.phi) * Math.cos(d.userData.theta);
      const y = r * Math.sin(d.userData.phi) * Math.sin(d.userData.theta);
      const z = r * Math.cos(d.userData.phi);
      d.position.set(x, y, z);

      // Fade in/out based on visible flag
      const targetOpacity = d.userData.visible ? 0.9 : 0;
      d.material.opacity = THREE.MathUtils.lerp(
        d.material.opacity,
        targetOpacity,
        0.08,
      );
      d.material.emissiveIntensity =
        0.5 + Math.sin(t * 3 + d.userData.theta) * 0.3;
    });
  }

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    setTier,
    tier: () => activeTier,
    counts: () => TIER_COUNTS,
  };
}

// ============================================================
// KUBERNETES-SPECIFIC SCENES
// ============================================================

// ----- Scene: Self-Healing — click pods to kill them ---------------

function createSelfHealingScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 4, 11);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(5, 8, 6);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 12),
    new THREE.MeshStandardMaterial({
      color: 0x111113,
      metalness: 0.4,
      roughness: 0.7,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  scene.add(floor);

  const DESIRED = 3;
  const slots = [
    { x: -3, color: 0x60a5fa },
    { x: 0, color: 0x60a5fa },
    { x: 3, color: 0x60a5fa },
  ];

  const pods = [];
  let kills = 0;
  let respawns = 0;
  let onChange = null;

  function makePod(slotIdx, isReplacement = false) {
    const slot = slots[slotIdx];
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: slot.color,
      emissive: slot.color,
      emissiveIntensity: 0.3,
      metalness: 0.25,
      roughness: 0.45,
      transparent: true,
      opacity: isReplacement ? 0 : 0.9,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat);
    grp.add(box);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.42, 1.42, 1.42)),
      new THREE.LineBasicMaterial({
        color: slot.color,
        transparent: true,
        opacity: isReplacement ? 0 : 0.95,
      }),
    );
    grp.add(wire);
    grp.position.set(slot.x, isReplacement ? 5 : 0.7, 0);
    grp.userData = {
      slotIdx,
      alive: true,
      mat,
      wire,
      birth: performance.now(),
      isReplacement,
    };
    scene.add(grp);
    return grp;
  }

  function reset() {
    pods.forEach((p) => {
      scene.remove(p);
      p.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    });
    pods.length = 0;
    kills = 0;
    respawns = 0;
    for (let i = 0; i < DESIRED; i++) pods.push(makePod(i));
    if (onChange) onChange({ alive: pods.length, kills, respawns });
  }

  function killPod(target) {
    if (!target || !target.userData.alive) return;
    target.userData.alive = false;
    target.userData.deathStart = performance.now();
    kills += 1;
    setTimeout(() => {
      const slotIdx = target.userData.slotIdx;
      scene.remove(target);
      const ix = pods.indexOf(target);
      if (ix >= 0) pods.splice(ix, 1);
      const newPod = makePod(slotIdx, true);
      pods.push(newPod);
      respawns += 1;
      if (onChange)
        onChange({
          alive: pods.filter((p) => p.userData.alive).length,
          kills,
          respawns,
        });
    }, 1200);
    if (onChange)
      onChange({
        alive: pods.filter((p) => p.userData.alive).length,
        kills,
        respawns,
      });
  }

  function killRandom() {
    const alive = pods.filter((p) => p.userData.alive);
    if (alive.length === 0) return;
    killPod(alive[Math.floor(Math.random() * alive.length)]);
  }

  // Raycaster for click detection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null;

  function onPointerMove(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function onClick(canvas, ev) {
    onPointerMove(canvas, ev);
    raycaster.setFromCamera(mouse, camera);
    const targets = pods
      .filter((p) => p.userData.alive)
      .flatMap((p) => p.children.filter((c) => c.isMesh));
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) killPod(hits[0].object.parent);
  }

  function update(dt, t) {
    raycaster.setFromCamera(mouse, camera);
    const targets = pods
      .filter((p) => p.userData.alive)
      .flatMap((p) => p.children.filter((c) => c.isMesh));
    const hits = raycaster.intersectObjects(targets, false);
    hovered = hits[0]?.object.parent || null;

    const now = performance.now();
    pods.forEach((p) => {
      const ud = p.userData;
      if (ud.alive) {
        p.position.y = THREE.MathUtils.lerp(
          p.position.y,
          0.7 + Math.sin(t * 1.5 + ud.slotIdx) * 0.08,
          0.15,
        );
        p.rotation.y += dt * 0.3;
        const scale = p === hovered ? 1.1 : 1.0;
        p.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.2);
        ud.mat.emissiveIntensity = 0.3 + Math.sin(t * 2 + ud.slotIdx) * 0.1;
        if (ud.isReplacement) {
          const age = (now - ud.birth) / 1000;
          const ease = Math.min(1, age / 0.5);
          ud.mat.opacity = 0.9 * ease;
          ud.wire.material.opacity = 0.95 * ease;
          if (ease >= 1) ud.isReplacement = false;
        }
      } else {
        const age = (now - ud.deathStart) / 1000;
        const fall = Math.min(1, age / 1.0);
        p.position.y -= dt * 4;
        p.rotation.x += dt * 2;
        ud.mat.opacity = (1 - fall) * 0.9;
        ud.wire.material.opacity = (1 - fall) * 0.95;
      }
    });
  }

  reset();

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    killRandom,
    setOnChange(fn) {
      onChange = fn;
    },
    onPointerMove,
    onClick,
    isHoveringPod: () => !!hovered,
  };
}

// ----- Scene: Pod Scaling — HPA reaction to load slider -----------

function createPodScalingScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 5, 14);
  camera.lookAt(0, 1.5, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(6, 10, 5);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 14),
    new THREE.MeshStandardMaterial({
      color: 0x0d0d10,
      metalness: 0.4,
      roughness: 0.8,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  scene.add(floor);

  const MIN = 2,
    MAX = 10;
  const TARGET_CPU = 70;
  const CAPACITY_PER_POD = 50;

  let load = 0;
  const pods = [];
  let onChange = null;

  function spawnPod(idx) {
    const grp = new THREE.Group();
    const color = 0x60a5fa;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), mat);
    grp.add(box);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }),
    );
    grp.add(wire);

    const cols = 5;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const xStart = -((cols - 1) * 1.5) / 2;
    const target = new THREE.Vector3(xStart + col * 1.5, 0.5 + row * 1.4, 0);

    grp.position.set(target.x, 8, target.z);
    grp.userData = { mat, wire, target, birth: performance.now(), idx };
    scene.add(grp);
    return grp;
  }

  function setLoad(value) {
    load = Math.max(0, Math.min(100, value));
  }

  function reset() {
    pods.forEach((p) => {
      scene.remove(p);
      p.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    });
    pods.length = 0;
    for (let i = 0; i < MIN; i++) pods.push(spawnPod(i));
    load = 0;
  }

  let lastReconcile = 0;
  function reconcile(now) {
    if (now - lastReconcile < 1000) return;
    lastReconcile = now;
    const replicas = pods.filter((p) => !p.userData.dying).length;
    const totalDemand = (load / 100) * (MAX * CAPACITY_PER_POD);
    const cpuPerPod =
      replicas > 0
        ? Math.min(100, (totalDemand / replicas / CAPACITY_PER_POD) * 100)
        : 0;

    let decision = "stable";
    if (cpuPerPod > TARGET_CPU && replicas < MAX) {
      pods.push(spawnPod(replicas));
      decision = "scale up";
    } else if (cpuPerPod < TARGET_CPU * 0.5 && replicas > MIN) {
      const removed = pods.find((p) => !p.userData.dying);
      if (removed) {
        pods.splice(pods.indexOf(removed), 1);
        pods.push(removed);
        removed.userData.dying = performance.now();
      }
      decision = "scale down";
    }

    if (onChange) {
      const aliveReplicas = pods.filter((p) => !p.userData.dying).length;
      const newCpu =
        aliveReplicas > 0
          ? Math.min(
              100,
              (totalDemand / aliveReplicas / CAPACITY_PER_POD) * 100,
            )
          : 0;
      onChange({
        replicas: aliveReplicas,
        cpu: newCpu,
        decision,
        max: MAX,
        min: MIN,
        target: TARGET_CPU,
      });
    }
  }

  function update(dt, t) {
    const now = performance.now();
    reconcile(now);

    pods.forEach((p, i) => {
      const ud = p.userData;
      p.position.lerp(ud.target, 0.08);
      const age = (now - ud.birth) / 1000;
      const ease = Math.min(1, age / 0.5);
      const baseOpacity = 0.9 * ease;

      if (ud.dying) {
        const dyingAge = (now - ud.dying) / 1000;
        const fade = Math.min(1, dyingAge / 0.6);
        ud.mat.opacity = baseOpacity * (1 - fade);
        ud.wire.material.opacity = 0.95 * (1 - fade);
        p.position.y -= dt * 3;
        if (fade >= 1) {
          scene.remove(p);
          const ix = pods.indexOf(p);
          if (ix >= 0) pods.splice(ix, 1);
        }
      } else {
        ud.mat.opacity = baseOpacity;
        ud.wire.material.opacity = 0.95 * ease;
      }

      const cpuFraction = load / 100;
      let targetColor;
      if (cpuFraction < 0.4) targetColor = 0x60a5fa;
      else if (cpuFraction < 0.7) targetColor = 0xfbbf24;
      else targetColor = 0xfb7185;
      ud.mat.color.lerp(new THREE.Color(targetColor), 0.05);
      ud.mat.emissive.copy(ud.mat.color);
      ud.wire.material.color.copy(ud.mat.color);

      ud.mat.emissiveIntensity =
        0.25 + cpuFraction * 0.4 + Math.sin(t * 4 + i) * 0.08;
      p.rotation.y += dt * (0.2 + cpuFraction * 0.6);
    });

    scene.rotation.y = Math.sin(t * 0.1) * 0.04;
  }

  reset();

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    setLoad,
    setOnChange(fn) {
      onChange = fn;
    },
  };
}

// ----- Scene: Cluster Topology — 2 nodes, 92 pods, by namespace ---

function createClusterTopologyScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(0, 8, 18);
  camera.lookAt(0, 1, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(8, 12, 6);
  scene.add(key);

  // Real cluster data — namespaces + pod counts
  const NS_DATA = {
    "kube-system": { count: 18, color: 0x71717a },
    monitoring: { count: 13, color: 0x60a5fa },
    argocd: { count: 9, color: 0xa78bfa },
    ingress: { count: 7, color: 0x34d399 },
    kyverno: { count: 5, color: 0xfb7185 },
    "dev-007": { count: 5, color: 0xfbbf24 },
    "stg-007": { count: 5, color: 0xfbbf24 },
    n8n: { count: 5, color: 0xc084fc },
    keycloak: { count: 4, color: 0xf87171 },
    vault: { count: 3, color: 0x14b8a6 },
    other: { count: 18, color: 0x52525b },
  };

  const NODE_W = 6,
    NODE_D = 5,
    NODE_H = 0.4;
  const nodes = [];
  [-3.7, 3.7].forEach((x, i) => {
    const n = new THREE.Mesh(
      new THREE.BoxGeometry(NODE_W, NODE_H, NODE_D),
      new THREE.MeshStandardMaterial({
        color: 0x222226,
        metalness: 0.6,
        roughness: 0.5,
      }),
    );
    n.position.set(x, 0, 0);
    scene.add(n);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(NODE_W + 0.05, NODE_H + 0.05, NODE_D + 0.05),
      ),
      new THREE.LineBasicMaterial({ color: 0x71717a }),
    );
    wire.position.set(x, 0, 0);
    scene.add(wire);
    nodes.push({ x, group: n });
  });

  const pods = [];
  let podIdx = 0;
  Object.entries(NS_DATA).forEach(([ns, data]) => {
    for (let i = 0; i < data.count; i++) {
      const nodeIdx = podIdx % 2;
      const node = nodes[nodeIdx];

      const podsOnNode = pods.filter(
        (p) => p.userData.nodeIdx === nodeIdx,
      ).length;
      const cols = 6;
      const col = podsOnNode % cols;
      const row = Math.floor(podsOnNode / cols);
      const cellW = (NODE_W - 0.6) / cols;
      const cellD = (NODE_D - 0.6) / 8;
      const xLocal = -NODE_W / 2 + 0.3 + cellW / 2 + col * cellW;
      const zLocal = -NODE_D / 2 + 0.3 + cellD / 2 + row * cellD;

      const sz = 0.45;
      const mat = new THREE.MeshStandardMaterial({
        color: data.color,
        emissive: data.color,
        emissiveIntensity: 0.25,
        metalness: 0.3,
        roughness: 0.5,
        transparent: true,
        opacity: 0.85,
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), mat);
      box.position.set(node.x + xLocal, 0.45, zLocal);
      box.userData = {
        ns,
        nodeIdx,
        mat,
        baseColor: new THREE.Color(data.color),
        floatPhase: Math.random() * Math.PI * 2,
      };
      scene.add(box);
      pods.push(box);
      podIdx += 1;
    }
  });

  let highlight = "all";
  function setHighlight(ns) {
    highlight = ns;
  }

  function update(dt, t) {
    pods.forEach((p, i) => {
      const ud = p.userData;
      const isHighlighted = highlight === "all" || ud.ns === highlight;

      p.position.y = 0.45 + Math.sin(t * 1.2 + ud.floatPhase) * 0.06;

      const targetOpacity = isHighlighted ? 0.95 : 0.18;
      ud.mat.opacity = THREE.MathUtils.lerp(ud.mat.opacity, targetOpacity, 0.1);
      ud.mat.emissiveIntensity = isHighlighted
        ? 0.3 + Math.sin(t * 2 + ud.floatPhase) * 0.15
        : 0.05;

      p.rotation.y += dt * (isHighlighted ? 0.4 : 0.05);
    });

    scene.rotation.y = Math.sin(t * 0.06) * 0.18;
  }

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    setHighlight,
    namespaces: () => NS_DATA,
  };
}

// ----- Scene: Deploy Race (Manual vs Docker vs K8s) ----------------

function createDeployRaceScene() {
  const scene = new THREE.Scene();
  // Camera further back + offset right so the 3D race sits in the right half of the slide
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(3, 3.5, 22);
  camera.lookAt(3, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(4, 8, 6);
  scene.add(key);

  const TRACK_LEN = 11;
  const TARGET_DEPLOYS = 10;

  // Three lanes: tighter vertical spacing so the scene is compact
  const lanes = [
    { y: 1.5, color: 0xfb7185, label: "Manual", speed: 0.4, name: "manual" },
    { y: 0.0, color: 0xfbbf24, label: "Docker", speed: 1.2, name: "docker" },
    {
      y: -1.5,
      color: 0x34d399,
      label: "Kubernetes",
      speed: 5.0,
      name: "kubernetes",
    },
  ];

  lanes.forEach((lane) => {
    // Track surface
    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_LEN, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x111113,
        metalness: 0.3,
        roughness: 0.7,
      }),
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, -0.05, lane.y);
    scene.add(track);

    // Start/finish lines
    [-TRACK_LEN / 2, TRACK_LEN / 2].forEach((x) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, lane.y - 0.7),
        new THREE.Vector3(x, 0.01, lane.y + 0.7),
      ]);
      scene.add(
        new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x52525b })),
      );
    });

    // Racer (a stack of mini-deploys riding on top)
    const racer = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({
        color: lane.color,
        emissive: lane.color,
        emissiveIntensity: 0.35,
        metalness: 0.3,
        roughness: 0.4,
      }),
    );
    racer.add(body);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.72, 0.72, 0.72)),
      new THREE.LineBasicMaterial({ color: lane.color }),
    );
    racer.add(wire);
    racer.position.set(-TRACK_LEN / 2, 0.4, lane.y);
    scene.add(racer);

    lane.racer = racer;
    lane.deploysDone = 0;
  });

  let raceState = "idle";
  let raceStart = 0;
  let onTick = null;

  function start(cb) {
    raceState = "running";
    raceStart = performance.now();
    onTick = cb || null;
    lanes.forEach((l) => {
      l.racer.position.x = -TRACK_LEN / 2;
      l.deploysDone = 0;
    });
  }
  function reset() {
    raceState = "idle";
    onTick = null;
    lanes.forEach((l) => {
      l.racer.position.x = -TRACK_LEN / 2;
      l.deploysDone = 0;
    });
  }

  function update(dt, t) {
    if (raceState === "running") {
      const elapsed = (performance.now() - raceStart) / 1000;
      let allDone = true;

      lanes.forEach((l) => {
        // Each lane has a different "speed" (deploys per second)
        const deploysCompletedF = elapsed * l.speed;
        l.deploysDone = Math.min(TARGET_DEPLOYS, deploysCompletedF);
        const fraction = l.deploysDone / TARGET_DEPLOYS;
        l.racer.position.x = -TRACK_LEN / 2 + fraction * TRACK_LEN;
        if (fraction < 1) allDone = false;
      });

      if (onTick)
        onTick({
          elapsed,
          manual: lanes[0].deploysDone,
          docker: lanes[1].deploysDone,
          kubernetes: lanes[2].deploysDone,
          target: TARGET_DEPLOYS,
          done: allDone,
        });

      if (allDone) raceState = "done";
    }

    // Idle visual flair
    lanes.forEach((l, i) => {
      l.racer.rotation.y += dt * 0.7;
      l.racer.children[0].material.emissiveIntensity =
        0.3 + Math.sin(t * 2 + i) * 0.1;
    });
  }

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    start,
    reset,
    state: () => raceState,
  };
}

// ----- Scene: Traffic Wave (auto-varying load drives HPA) ---------

function createTrafficWaveScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 5, 14);
  camera.lookAt(0, 1.5, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(6, 10, 5);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 14),
    new THREE.MeshStandardMaterial({
      color: 0x0d0d10,
      metalness: 0.4,
      roughness: 0.8,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  scene.add(floor);

  // Visualize traffic as glowing particles flowing toward the pods
  const PARTICLE_COUNT = 200;
  const partPositions = new Float32Array(PARTICLE_COUNT * 3);
  const partVel = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    partPositions[i * 3] = (Math.random() - 0.5) * 14;
    partPositions[i * 3 + 1] = 4 + Math.random() * 2;
    partPositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    partVel.push(Math.random() * 0.5 + 0.3);
  }
  const partGeom = new THREE.BufferGeometry();
  partGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(partPositions, 3),
  );
  const partMat = new THREE.PointsMaterial({
    color: 0x60a5fa,
    size: 0.08,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(partGeom, partMat);
  scene.add(particles);

  const MIN = 2,
    MAX = 10;
  const TARGET_CPU = 70;
  const CAPACITY_PER_POD = 50;

  let load = 0;
  let waveActive = false;
  let waveStart = 0;
  const pods = [];
  let onChange = null;
  let requestsServed = 0;
  let requestsDropped = 0;

  function spawnPod(idx) {
    const grp = new THREE.Group();
    const color = 0x60a5fa;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat);
    grp.add(box);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.92, 0.92, 0.92)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }),
    );
    grp.add(wire);
    const cols = 5;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const xStart = -((cols - 1) * 1.4) / 2;
    const target = new THREE.Vector3(xStart + col * 1.4, 0.5 + row * 1.3, 0);
    grp.position.set(target.x, 8, target.z);
    grp.userData = { mat, wire, target, birth: performance.now(), idx };
    scene.add(grp);
    return grp;
  }

  function reset() {
    pods.forEach((p) => {
      scene.remove(p);
      p.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    });
    pods.length = 0;
    for (let i = 0; i < MIN; i++) pods.push(spawnPod(i));
    load = 0;
    waveActive = false;
    requestsServed = 0;
    requestsDropped = 0;
  }

  function startWave() {
    waveActive = true;
    waveStart = performance.now();
    requestsServed = 0;
    requestsDropped = 0;
  }
  function stopWave() {
    waveActive = false;
    load = 0;
  }

  let lastReconcile = 0;
  function reconcile(now) {
    if (now - lastReconcile < 1000) return;
    lastReconcile = now;
    const replicas = pods.filter((p) => !p.userData.dying).length;
    const totalDemand = (load / 100) * (MAX * CAPACITY_PER_POD);
    const cpuPerPod =
      replicas > 0
        ? Math.min(100, (totalDemand / replicas / CAPACITY_PER_POD) * 100)
        : 0;

    let decision = "stable";
    if (cpuPerPod > TARGET_CPU && replicas < MAX) {
      pods.push(spawnPod(replicas));
      decision = "scale up";
    } else if (cpuPerPod < TARGET_CPU * 0.5 && replicas > MIN) {
      const idx = pods.findIndex((p) => !p.userData.dying);
      if (idx >= 0) {
        pods[idx].userData.dying = performance.now();
        decision = "scale down";
      }
    }

    if (onChange) {
      const aliveReplicas = pods.filter((p) => !p.userData.dying).length;
      const newCpu =
        aliveReplicas > 0
          ? Math.min(
              100,
              (totalDemand / aliveReplicas / CAPACITY_PER_POD) * 100,
            )
          : 0;
      onChange({
        load,
        replicas: aliveReplicas,
        cpu: newCpu,
        decision,
        served: requestsServed,
        dropped: requestsDropped,
      });
    }
  }

  function update(dt, t) {
    const now = performance.now();

    if (waveActive) {
      // Sine wave: 0..100, period ~12 s
      const elapsed = (now - waveStart) / 1000;
      load = 50 + 50 * Math.sin(elapsed * ((Math.PI * 2) / 12) - Math.PI / 2);
    }

    reconcile(now);

    // Particles flow from random top toward pods near origin
    const positions = particles.geometry.attributes.position;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);

      // Drift down and toward center
      y -= partVel[i] * dt * (0.5 + load / 100);
      x += (0 - x) * dt * 0.5;
      z += (0 - z) * dt * 0.5;

      // When particle reaches the pods area, count it as served (or dropped if overloaded)
      if (y < 0.5) {
        const replicas = pods.filter((p) => !p.userData.dying).length;
        const totalCap = replicas * CAPACITY_PER_POD;
        const demand = (load / 100) * (MAX * CAPACITY_PER_POD);
        if (demand <= totalCap) requestsServed += 1;
        else requestsDropped += 1;
        // Respawn at top
        x = (Math.random() - 0.5) * 14;
        y = 4 + Math.random() * 2;
        z = (Math.random() - 0.5) * 4;
      }

      // Throttle particle generation by load — when load high, more particles "active"
      const isActive = i / PARTICLE_COUNT < load / 100 + 0.1;
      if (!isActive) {
        x = (Math.random() - 0.5) * 14;
        y = 5 + Math.random() * 2;
        z = (Math.random() - 0.5) * 4;
      }

      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;

    partMat.opacity = 0.4 + (load / 100) * 0.5;

    // Pods animation
    pods.forEach((p, i) => {
      const ud = p.userData;
      p.position.lerp(ud.target, 0.08);
      const age = (now - ud.birth) / 1000;
      const ease = Math.min(1, age / 0.5);
      const baseOpacity = 0.9 * ease;

      if (ud.dying) {
        const dyingAge = (now - ud.dying) / 1000;
        const fade = Math.min(1, dyingAge / 0.6);
        ud.mat.opacity = baseOpacity * (1 - fade);
        ud.wire.material.opacity = 0.95 * (1 - fade);
        if (fade >= 1) {
          scene.remove(p);
          const ix = pods.indexOf(p);
          if (ix >= 0) pods.splice(ix, 1);
        }
      } else {
        ud.mat.opacity = baseOpacity;
        ud.wire.material.opacity = 0.95 * ease;
      }
      const cpuFraction = load / 100;
      let targetColor;
      if (cpuFraction < 0.4) targetColor = 0x60a5fa;
      else if (cpuFraction < 0.7) targetColor = 0xfbbf24;
      else targetColor = 0xfb7185;
      ud.mat.color.lerp(new THREE.Color(targetColor), 0.05);
      ud.mat.emissive.copy(ud.mat.color);
      ud.wire.material.color.copy(ud.mat.color);
      ud.mat.emissiveIntensity =
        0.25 + cpuFraction * 0.4 + Math.sin(t * 4 + i) * 0.08;
      p.rotation.y += dt * (0.2 + cpuFraction * 0.6);
    });
  }

  reset();

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    startWave,
    stopWave,
    setOnChange(fn) {
      onChange = fn;
    },
  };
}

// ----- Scene: Rolling Deploy (v1 → v2) ----------------------------

function createRollingDeployScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 3.5, 12);
  camera.lookAt(0, 0.5, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(5, 8, 5);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 8),
    new THREE.MeshStandardMaterial({
      color: 0x111113,
      metalness: 0.4,
      roughness: 0.7,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  scene.add(floor);

  const REPLICAS = 4;
  const pods = [];
  let onChange = null;

  function makePod(slot, version) {
    const color = version === "v1" ? 0xfb7185 : 0x34d399;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0,
    });
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), mat);
    grp.add(box);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }),
    );
    grp.add(wire);
    const x = (slot - (REPLICAS - 1) / 2) * 1.7;
    grp.position.set(x, version === "v2" ? 5 : 0.5, 0);
    grp.userData = {
      mat,
      wire,
      version,
      slot,
      birth: performance.now(),
      state: "spawning",
    };
    scene.add(grp);
    return grp;
  }

  function reset() {
    pods.forEach((p) => {
      scene.remove(p);
      p.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    });
    pods.length = 0;
    for (let s = 0; s < REPLICAS; s++) {
      const p = makePod(s, "v1");
      p.userData.state = "ready";
      pods.push(p);
    }
    if (onChange) onChange(state());
  }

  function state() {
    return {
      total: pods.length,
      v1: pods.filter(
        (p) => p.userData.version === "v1" && p.userData.state !== "dying",
      ).length,
      v2: pods.filter(
        (p) => p.userData.version === "v2" && p.userData.state !== "dying",
      ).length,
    };
  }

  // Trigger a rolling update — replace v1 with v2 one at a time
  let rollingActive = false;
  async function startRolling() {
    if (rollingActive) return;
    rollingActive = true;
    for (let s = 0; s < REPLICAS; s++) {
      // Spawn a v2 next to v1
      const v2 = makePod(s, "v2");
      pods.push(v2);
      // Wait for it to become ready (~1.2s)
      await new Promise((r) => setTimeout(r, 1400));
      // Mark old v1 as dying
      const v1 = pods.find(
        (p) =>
          p.userData.version === "v1" &&
          p.userData.slot === s &&
          p.userData.state !== "dying",
      );
      if (v1) {
        v1.userData.state = "dying";
        v1.userData.dyingAt = performance.now();
      }
      if (onChange) onChange(state());
      await new Promise((r) => setTimeout(r, 600));
    }
    rollingActive = false;
  }

  function update(dt, t) {
    const now = performance.now();
    pods.forEach((p) => {
      const ud = p.userData;
      const targetX = (ud.slot - (REPLICAS - 1) / 2) * 1.7;
      const targetY = 0.5;

      if (ud.version === "v2" && ud.state === "spawning") {
        // Slot in slightly offset (next to v1) until v1 dies
        const settleX = targetX + 0.3;
        p.position.x = THREE.MathUtils.lerp(p.position.x, settleX, 0.08);
        p.position.y = THREE.MathUtils.lerp(p.position.y, targetY, 0.08);
        const age = (now - ud.birth) / 1000;
        const ease = Math.min(1, age / 0.5);
        ud.mat.opacity = 0.9 * ease;
        ud.wire.material.opacity = 0.95 * ease;
        if (age > 1.2) ud.state = "ready";
      } else if (ud.state === "dying") {
        const dyingAge = (now - ud.dyingAt) / 1000;
        const fade = Math.min(1, dyingAge / 0.6);
        ud.mat.opacity = 0.9 * (1 - fade);
        ud.wire.material.opacity = 0.95 * (1 - fade);
        p.position.y -= dt * 2.2;
        p.rotation.x += dt * 1.5;
        if (fade >= 1) {
          scene.remove(p);
          const ix = pods.indexOf(p);
          if (ix >= 0) pods.splice(ix, 1);
        }
      } else if (ud.state === "ready") {
        // Settle to canonical position
        p.position.x = THREE.MathUtils.lerp(p.position.x, targetX, 0.08);
        p.position.y = THREE.MathUtils.lerp(
          p.position.y,
          targetY + Math.sin(t * 1.3 + ud.slot) * 0.04,
          0.15,
        );
        ud.mat.opacity = THREE.MathUtils.lerp(ud.mat.opacity, 0.9, 0.1);
        ud.wire.material.opacity = THREE.MathUtils.lerp(
          ud.wire.material.opacity,
          0.95,
          0.1,
        );
      }
      p.rotation.y += dt * 0.3;
      ud.mat.emissiveIntensity = 0.3 + Math.sin(t * 2 + ud.slot) * 0.1;
    });
  }

  reset();

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    startRolling,
    setOnChange(fn) {
      onChange = fn;
    },
  };
}

// ----- Scene: Chaos Engineering — node down, pods migrate ---------

function createChaosScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(2, 6, 18);
  camera.lookAt(2, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(8, 12, 6);
  scene.add(key);

  const NODE_W = 5.5,
    NODE_D = 4.5,
    NODE_H = 0.4;
  const nodes = [];
  [-3.5, 3.5].forEach((x, i) => {
    const grp = new THREE.Group();
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(NODE_W, NODE_H, NODE_D),
      new THREE.MeshStandardMaterial({
        color: 0x222226,
        metalness: 0.6,
        roughness: 0.5,
      }),
    );
    grp.add(platform);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(NODE_W + 0.05, NODE_H + 0.05, NODE_D + 0.05),
      ),
      new THREE.LineBasicMaterial({ color: 0x71717a }),
    );
    grp.add(wire);
    grp.position.set(x, 0, 0);
    scene.add(grp);
    nodes.push({ x, group: grp, platform, wire, alive: true, idx: i });
  });

  const PODS_PER_NODE = 6;
  const pods = [];
  let onChange = null;
  let evicted = 0;
  let rescheduled = 0;

  function placePod(pod, nodeIdx, slotIdx) {
    const cols = 3;
    const col = slotIdx % cols;
    const row = Math.floor(slotIdx / cols);
    const cellW = (NODE_W - 0.5) / cols;
    const cellD = (NODE_D - 0.5) / 2;
    const xLocal = -NODE_W / 2 + 0.25 + cellW / 2 + col * cellW;
    const zLocal = -NODE_D / 2 + 0.25 + cellD / 2 + row * cellD;
    pod.userData.targetPos = new THREE.Vector3(
      nodes[nodeIdx].x + xLocal,
      0.55,
      zLocal,
    );
    pod.userData.nodeIdx = nodeIdx;
    pod.userData.slotIdx = slotIdx;
  }

  function reset() {
    pods.forEach((p) => {
      scene.remove(p);
      p.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    });
    pods.length = 0;
    evicted = 0;
    rescheduled = 0;
    nodes.forEach((n) => {
      n.alive = true;
      n.platform.material.color.setHex(0x222226);
    });

    // 6 pods per node
    [0, 1].forEach((nodeIdx) => {
      for (let i = 0; i < PODS_PER_NODE; i++) {
        const colors = [
          0x60a5fa, 0xa78bfa, 0x34d399, 0xfbbf24, 0xfb7185, 0xc084fc,
        ];
        const color = colors[i % colors.length];
        const grp = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.3,
          metalness: 0.3,
          roughness: 0.5,
          transparent: true,
          opacity: 0.9,
        });
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.55, 0.55),
          mat,
        );
        grp.add(box);
        const wire = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(0.57, 0.57, 0.57)),
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.95,
          }),
        );
        grp.add(wire);
        grp.userData = { mat, wire, floatPhase: Math.random() * Math.PI * 2 };
        placePod(grp, nodeIdx, i);
        grp.position.copy(grp.userData.targetPos);
        scene.add(grp);
        pods.push(grp);
      }
    });

    if (onChange)
      onChange({ aliveNodes: 2, totalPods: pods.length, evicted, rescheduled });
  }

  function killNode(nodeIdx) {
    const node = nodes[nodeIdx];
    if (!node.alive) return;
    node.alive = false;
    node.platform.material.color.setHex(0x3f1f24); // red-ish dead

    // Find pods on this node, mark for migration
    const podsOnNode = pods.filter((p) => p.userData.nodeIdx === nodeIdx);
    evicted += podsOnNode.length;

    // Find surviving node
    const survivingIdx = nodes.findIndex((n) => n.alive);
    if (survivingIdx < 0) {
      // No survivor — pods just float in despair
      podsOnNode.forEach((p) => {
        p.userData.evicted = true;
        p.userData.evictedAt = performance.now();
      });
      if (onChange)
        onChange({
          aliveNodes: 0,
          totalPods: pods.length,
          evicted,
          rescheduled,
        });
      return;
    }

    // Find available slots on surviving node
    const occupiedSlots = pods
      .filter((p) => p.userData.nodeIdx === survivingIdx && !p.userData.evicted)
      .map((p) => p.userData.slotIdx);

    podsOnNode.forEach((pod, i) => {
      // Find next free slot (allow up to 12 — packing more densely)
      let slot = 0;
      while (occupiedSlots.includes(slot)) slot += 1;
      occupiedSlots.push(slot);

      // Migrate with delay (one at a time looks more dramatic)
      setTimeout(() => {
        pod.userData.evicted = true;
        pod.userData.evictedAt = performance.now();
        // Reposition to new node
        placePodWithStretch(pod, survivingIdx, slot);
        rescheduled += 1;
        if (onChange)
          onChange({
            aliveNodes: nodes.filter((n) => n.alive).length,
            totalPods: pods.length,
            evicted,
            rescheduled,
          });
      }, i * 350);
    });

    if (onChange)
      onChange({
        aliveNodes: nodes.filter((n) => n.alive).length,
        totalPods: pods.length,
        evicted,
        rescheduled,
      });
  }

  function placePodWithStretch(pod, nodeIdx, slotIdx) {
    // Allow more slots — pack tighter
    const cols = 4;
    const col = slotIdx % cols;
    const row = Math.floor(slotIdx / cols);
    const cellW = (NODE_W - 0.5) / cols;
    const cellD = (NODE_D - 0.5) / 3;
    const xLocal = -NODE_W / 2 + 0.25 + cellW / 2 + col * cellW;
    const zLocal = -NODE_D / 2 + 0.25 + cellD / 2 + row * cellD;
    pod.userData.targetPos = new THREE.Vector3(
      nodes[nodeIdx].x + xLocal,
      0.55 + (slotIdx >= 8 ? 0.7 : 0),
      zLocal,
    );
    pod.userData.nodeIdx = nodeIdx;
    pod.userData.slotIdx = slotIdx;
  }

  function restoreNode(nodeIdx) {
    const node = nodes[nodeIdx];
    if (node.alive) return;
    node.alive = true;
    node.platform.material.color.setHex(0x222226);
    if (onChange)
      onChange({
        aliveNodes: nodes.filter((n) => n.alive).length,
        totalPods: pods.length,
        evicted,
        rescheduled,
      });
  }

  function update(dt, t) {
    const now = performance.now();

    pods.forEach((p) => {
      const ud = p.userData;
      // Lerp toward target, with a high arc when migrating
      if (ud.evicted) {
        const age = (now - ud.evictedAt) / 1000;
        const ease = Math.min(1, age / 0.9);
        // Arc upward then down
        const arcY = ud.targetPos.y + Math.sin(ease * Math.PI) * 1.4;
        p.position.x = THREE.MathUtils.lerp(p.position.x, ud.targetPos.x, 0.07);
        p.position.z = THREE.MathUtils.lerp(p.position.z, ud.targetPos.z, 0.07);
        p.position.y = THREE.MathUtils.lerp(p.position.y, arcY, 0.12);
        if (ease >= 1) ud.evicted = false;
      } else {
        p.position.x = THREE.MathUtils.lerp(p.position.x, ud.targetPos.x, 0.1);
        p.position.z = THREE.MathUtils.lerp(p.position.z, ud.targetPos.z, 0.1);
        p.position.y = THREE.MathUtils.lerp(
          p.position.y,
          ud.targetPos.y + Math.sin(t * 1.4 + ud.floatPhase) * 0.05,
          0.15,
        );
      }
      p.rotation.y += dt * 0.4;
      ud.mat.emissiveIntensity = 0.3 + Math.sin(t * 2 + ud.floatPhase) * 0.1;
    });

    // Dead node: pulse red dim
    nodes.forEach((n) => {
      if (!n.alive) {
        const dim = 0.08 + Math.sin(t * 1.5) * 0.04;
        n.platform.material.color.setRGB(0.2 + dim, 0.05, 0.08);
      }
    });

    scene.rotation.y = Math.sin(t * 0.07) * 0.06;
  }

  reset();

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    killNode,
    restoreNode,
    setOnChange(fn) {
      onChange = fn;
    },
    nodeAlive: (i) => nodes[i].alive,
  };
}

// ----- Scene: Canary Rollout — % traffic between v1 and v2 --------

function createCanaryScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 5, 16);
  camera.lookAt(0, 1, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(5, 9, 6);
  scene.add(key);

  const TOTAL_PODS = 10;
  const pods = []; // each pod is either v1 or v2 based on the canary %
  const POD_W = 0.85;

  // Lay pods in a single row at z = 0
  for (let i = 0; i < TOTAL_PODS; i++) {
    const x = (i - (TOTAL_PODS - 1) / 2) * 1.0;
    const grp = new THREE.Group();
    const color = 0xfb7185; // start as v1
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(POD_W, POD_W, POD_W), mat);
    grp.add(box);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(POD_W + 0.02, POD_W + 0.02, POD_W + 0.02),
      ),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    grp.add(wire);
    grp.position.set(x, POD_W / 2, 0);
    grp.userData = {
      mat,
      wire,
      version: "v1",
      baseX: x,
      idx: i,
      floatPhase: Math.random() * Math.PI * 2,
    };
    scene.add(grp);
    pods.push(grp);
  }

  // Traffic particles — flow from above (random x) down to a chosen pod
  const PARTICLE_COUNT = 80;
  const particleGeom = new THREE.SphereGeometry(0.07, 8, 8);
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.9,
    });
    const m = new THREE.Mesh(particleGeom, mat);
    m.userData = { active: false };
    scene.add(m);
    particles.push(m);
  }

  let canaryPct = 0; // 0..100, % of pods + traffic going to v2
  let trafficV1 = 0,
    trafficV2 = 0;
  let onChange = null;

  function setCanaryPct(p) {
    canaryPct = Math.max(0, Math.min(100, p));
    // Distribute v2 pods roughly proportionally
    const v2Count = Math.round(TOTAL_PODS * (canaryPct / 100));
    pods.forEach((pod, i) => {
      const wantV2 = i >= TOTAL_PODS - v2Count;
      pod.userData.version = wantV2 ? "v2" : "v1";
    });
  }

  function reset() {
    canaryPct = 0;
    trafficV1 = 0;
    trafficV2 = 0;
    pods.forEach((p) => {
      p.userData.version = "v1";
    });
    particles.forEach((pt) => {
      pt.userData.active = false;
      pt.material.opacity = 0;
    });
    if (onChange)
      onChange({
        pct: 0,
        v1Count: TOTAL_PODS,
        v2Count: 0,
        trafficV1: 0,
        trafficV2: 0,
      });
  }

  function spawnParticle() {
    const idle = particles.find((p) => !p.userData.active);
    if (!idle) return;
    const startX = (Math.random() - 0.5) * 12;
    idle.position.set(startX, 5, 0);
    // Choose a target pod based on canary pct
    const goV2 = Math.random() * 100 < canaryPct;
    const candidates = pods.filter(
      (p) => p.userData.version === (goV2 ? "v2" : "v1"),
    );
    const target =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : pods[Math.floor(Math.random() * pods.length)];
    idle.userData = {
      active: true,
      target: target.position.clone(),
      version: target.userData.version,
      birth: performance.now(),
    };
    const color = target.userData.version === "v2" ? 0x34d399 : 0xfb7185;
    idle.material.color.setHex(color);
    idle.material.emissive.setHex(color);
    idle.material.opacity = 0.95;
  }

  let lastSpawn = 0;
  function update(dt, t) {
    const now = performance.now();

    // Animate pod color toward version (smooth transition)
    pods.forEach((p) => {
      const ud = p.userData;
      const targetColor = ud.version === "v2" ? 0x34d399 : 0xfb7185;
      ud.mat.color.lerp(new THREE.Color(targetColor), 0.06);
      ud.mat.emissive.copy(ud.mat.color);
      ud.wire.material.color.copy(ud.mat.color);
      p.position.y = POD_W / 2 + Math.sin(t * 1.5 + ud.floatPhase) * 0.05;
      p.rotation.y += dt * 0.3;
      ud.mat.emissiveIntensity = 0.3 + Math.sin(t * 2 + ud.floatPhase) * 0.1;
    });

    // Spawn particles at a steady rate
    if (now - lastSpawn > 80) {
      spawnParticle();
      lastSpawn = now;
    }

    // Animate active particles
    particles.forEach((p) => {
      if (!p.userData.active) return;
      const age = (now - p.userData.birth) / 1000;
      const target = p.userData.target;
      // Ease toward target
      p.position.x = THREE.MathUtils.lerp(p.position.x, target.x, 0.08);
      p.position.y = THREE.MathUtils.lerp(p.position.y, target.y, 0.1);
      p.position.z = THREE.MathUtils.lerp(p.position.z, target.z, 0.1);
      // Fade out as it reaches target
      const dist = p.position.distanceTo(target);
      if (dist < 0.3 || age > 1.6) {
        // Count this request
        if (p.userData.version === "v2") trafficV2 += 1;
        else trafficV1 += 1;
        p.userData.active = false;
        p.material.opacity = 0;
      }
    });

    if (onChange)
      onChange({
        pct: canaryPct,
        v1Count: pods.filter((p) => p.userData.version === "v1").length,
        v2Count: pods.filter((p) => p.userData.version === "v2").length,
        trafficV1,
        trafficV2,
      });
  }

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    setCanaryPct,
    setOnChange(fn) {
      onChange = fn;
    },
  };
}

// ----- Scene: Service Routing — traffic from clients through service to pods --

function createServiceRoutingScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 4.5, 14);
  camera.lookAt(0, 0.5, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(5, 10, 6);
  scene.add(key);

  // The Service — a glowing cyan torus / cube
  const serviceGroup = new THREE.Group();
  const serviceMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.45,
    metalness: 0.3,
    roughness: 0.45,
    transparent: true,
    opacity: 0.9,
  });
  const serviceBox = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.85, 0),
    serviceMat,
  );
  serviceGroup.add(serviceBox);
  const serviceWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.9, 0)),
    new THREE.LineBasicMaterial({ color: 0x22d3ee }),
  );
  serviceGroup.add(serviceWire);
  serviceGroup.position.set(0, 1.0, 0);
  scene.add(serviceGroup);

  // Pods arranged in a semi-circle behind the service
  const pods = [];
  const POD_COUNT_INITIAL = 4;

  function podPosition(idx, total) {
    const angle = -Math.PI / 2 - (idx - (total - 1) / 2) * 0.45;
    const radius = 4;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0.5,
      Math.sin(angle) * radius - 0.5, // pull a bit forward
    );
  }
  function repositionAllPods() {
    const total = pods.length;
    pods.forEach((p, i) => {
      p.userData.target = podPosition(i, total);
    });
  }

  function addPod() {
    if (pods.length >= 8) return;
    const colors = [
      0x60a5fa, 0xa78bfa, 0x34d399, 0xfbbf24, 0xfb7185, 0xc084fc, 0x14b8a6,
      0xf472b6,
    ];
    const color = colors[pods.length % colors.length];
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), mat);
    grp.add(box);
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.67, 0.67, 0.67)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }),
    );
    grp.add(wire);
    grp.position.set(0, 5, -3);
    grp.userData = {
      mat,
      wire,
      color,
      birth: performance.now(),
      floatPhase: Math.random() * Math.PI * 2,
      requests: 0,
    };
    scene.add(grp);
    pods.push(grp);
    repositionAllPods();
  }

  function removePod() {
    if (pods.length <= 1) return;
    const last = pods.pop();
    last.userData.dying = performance.now();
    repositionAllPods();
    setTimeout(() => {
      scene.remove(last);
      last.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    }, 700);
  }

  function killRandom() {
    if (pods.length === 0) return;
    const idx = Math.floor(Math.random() * pods.length);
    const target = pods[idx];
    pods.splice(idx, 1);
    target.userData.dying = performance.now();
    repositionAllPods();
    setTimeout(() => {
      scene.remove(target);
      target.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    }, 700);
    // K8s would respawn — simulate that
    setTimeout(() => {
      addPod();
    }, 1100);
  }

  function reset() {
    [...pods].forEach((p) => {
      scene.remove(p);
      p.children.forEach((c) => {
        c.geometry?.dispose();
        c.material?.dispose();
      });
    });
    pods.length = 0;
    for (let i = 0; i < POD_COUNT_INITIAL; i++) addPod();
  }

  // Traffic particles: come from a "client" position to the service, then to a pod
  const PARTICLE_COUNT = 60;
  const particleGeom = new THREE.SphereGeometry(0.08, 8, 8);
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0,
    });
    const m = new THREE.Mesh(particleGeom, mat);
    m.userData = { active: false };
    scene.add(m);
    particles.push(m);
  }

  function spawnRequest() {
    const idle = particles.find((p) => !p.userData.active);
    if (!idle || pods.length === 0) return;
    // Start somewhere in front of the service (the "client")
    idle.position.set((Math.random() - 0.5) * 6, 1, 5);
    // Phase 1: travel to the service
    idle.userData = {
      active: true,
      phase: "to-service",
      birth: performance.now(),
      target: serviceGroup.position.clone(),
    };
    idle.material.opacity = 0.9;
    idle.material.color.setHex(0x22d3ee);
    idle.material.emissive.setHex(0x22d3ee);
  }

  let lastSpawn = 0;
  function update(dt, t) {
    const now = performance.now();

    // Service: subtle rotation + pulse
    serviceGroup.rotation.y += dt * 0.6;
    serviceGroup.rotation.x = Math.sin(t * 0.5) * 0.1;
    serviceMat.emissiveIntensity = 0.4 + Math.sin(t * 1.8) * 0.15;

    // Pods animation
    pods.forEach((p, i) => {
      const ud = p.userData;
      // Settle to target
      if (ud.target) {
        p.position.lerp(ud.target, 0.07);
      }
      // Fade in
      const age = (now - ud.birth) / 1000;
      const ease = Math.min(1, age / 0.5);

      if (ud.dying) {
        const dyingAge = (now - ud.dying) / 1000;
        const fade = Math.min(1, dyingAge / 0.6);
        ud.mat.opacity = 0.9 * (1 - fade);
        ud.wire.material.opacity = 0.95 * (1 - fade);
        p.position.y -= dt * 2;
        p.rotation.x += dt * 2;
      } else {
        ud.mat.opacity = 0.9 * ease;
        ud.wire.material.opacity = 0.95 * ease;
        p.position.y =
          (ud.target?.y || 0.5) + Math.sin(t * 1.4 + ud.floatPhase) * 0.05;
        ud.mat.emissiveIntensity = 0.3 + Math.sin(t * 2 + ud.floatPhase) * 0.1;
        p.rotation.y += dt * 0.3;
      }
    });

    // Spawn requests at a steady rate
    if (now - lastSpawn > 120) {
      spawnRequest();
      lastSpawn = now;
    }

    // Animate particles
    particles.forEach((p) => {
      const ud = p.userData;
      if (!ud.active) return;
      p.position.lerp(ud.target, 0.12);
      const dist = p.position.distanceTo(ud.target);

      if (ud.phase === "to-service" && dist < 0.25) {
        // Phase 2: pick a pod and route to it (round-robin / random)
        if (pods.length === 0) {
          ud.active = false;
          p.material.opacity = 0;
          return;
        }
        const target = pods[Math.floor(Math.random() * pods.length)];
        target.userData.requests = (target.userData.requests || 0) + 1;
        ud.phase = "to-pod";
        ud.target = target.position.clone();
        // Color shift to the pod's color
        const podColor = target.userData.color;
        p.material.color.setHex(podColor);
        p.material.emissive.setHex(podColor);
      } else if (ud.phase === "to-pod" && dist < 0.25) {
        ud.active = false;
        p.material.opacity = 0;
      }

      // Fade out particles that linger too long
      const age = (now - ud.birth) / 1000;
      if (age > 3) {
        ud.active = false;
        p.material.opacity = 0;
      }
    });
  }

  reset();

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    addPod,
    removePod,
    killRandom,
    podCount: () => pods.length,
  };
}

// ----- Scene: Edge-to-Pod Traffic Flow ----------------------------
// Visualizes the full request path:
//   Internet → CDN → cloud-provider load balancer → ingress controller → Service → Pods
// Particles flow in (request) and back out (response).

function createEdgeToPodScene() {
  const scene = new THREE.Scene();
  // Camera looks slightly up — the scene renders in the UPPER 60% of the viewport,
  // leaving the bottom for the slide's compact control bar.
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 5, 21);
  camera.lookAt(0, 4.0, 0);

  // Shift the entire scene UP so it lands in the upper portion of the screen.
  scene.position.y = 3.5;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(0, 12, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x60a5fa, 0.4);
  rim.position.set(-4, 4, -3);
  scene.add(rim);

  // Floor / grid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 10),
    new THREE.MeshStandardMaterial({
      color: 0x0d0d10,
      metalness: 0.5,
      roughness: 0.85,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.7;
  scene.add(floor);

  // Stations: stage objects with positions and visual identity
  const STAGES = [
    { name: "internet", x: -10.5, color: 0xffffff, geom: "cluster" },
    { name: "cdn", x: -7.0, color: 0xf38020, geom: "shield" },
    { name: "cloud", x: -3.5, color: 0xc7000b, geom: "cube" },
    { name: "ingress", x: 0.0, color: 0x002fa7, geom: "pillar" },
    { name: "service", x: 3.5, color: 0x22d3ee, geom: "octahedron" },
    { name: "pods", x: 7.5, color: 0x60a5fa, geom: "pods" },
  ];
  const stations = {};

  STAGES.forEach((s) => {
    const grp = new THREE.Group();
    grp.position.set(s.x, 0, 0);

    // Build the icon based on geometry kind
    if (s.geom === "cluster") {
      // 4-5 small spheres clustered (representing many internet clients)
      for (let i = 0; i < 5; i++) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 12, 12),
          new THREE.MeshStandardMaterial({
            color: s.color,
            emissive: s.color,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.85,
          }),
        );
        dot.position.set(
          (Math.random() - 0.5) * 1.0,
          0.4 + Math.random() * 0.6,
          (Math.random() - 0.5) * 1.0,
        );
        grp.add(dot);
      }
    } else if (s.geom === "shield") {
      const mat = new THREE.MeshStandardMaterial({
        color: s.color,
        emissive: s.color,
        emissiveIntensity: 0.35,
        metalness: 0.4,
        roughness: 0.4,
        transparent: true,
        opacity: 0.92,
      });
      const shield = new THREE.Mesh(
        new THREE.CylinderGeometry(0, 0.85, 1.6, 5),
        mat,
      );
      shield.position.y = 0.8;
      grp.add(shield);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(0, 0.87, 1.62, 5)),
        new THREE.LineBasicMaterial({
          color: s.color,
          transparent: true,
          opacity: 0.9,
        }),
      );
      wire.position.y = 0.8;
      grp.add(wire);
    } else if (s.geom === "cube") {
      const mat = new THREE.MeshStandardMaterial({
        color: s.color,
        emissive: s.color,
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.45,
        transparent: true,
        opacity: 0.92,
      });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), mat);
      cube.position.y = 0.75;
      grp.add(cube);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.52, 1.52, 1.52)),
        new THREE.LineBasicMaterial({ color: s.color }),
      );
      wire.position.y = 0.75;
      grp.add(wire);
    } else if (s.geom === "pillar") {
      const mat = new THREE.MeshStandardMaterial({
        color: s.color,
        emissive: s.color,
        emissiveIntensity: 0.4,
        metalness: 0.3,
        roughness: 0.45,
        transparent: true,
        opacity: 0.9,
      });
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 1.8, 8),
        mat,
      );
      pillar.position.y = 0.9;
      grp.add(pillar);
      const cap = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.12, 8, 24),
        new THREE.MeshStandardMaterial({
          color: s.color,
          emissive: s.color,
          emissiveIntensity: 0.6,
        }),
      );
      cap.position.y = 1.85;
      cap.rotation.x = Math.PI / 2;
      grp.add(cap);
    } else if (s.geom === "octahedron") {
      const mat = new THREE.MeshStandardMaterial({
        color: s.color,
        emissive: s.color,
        emissiveIntensity: 0.45,
        metalness: 0.3,
        roughness: 0.4,
        transparent: true,
        opacity: 0.92,
      });
      const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), mat);
      oct.position.y = 1.0;
      grp.add(oct);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.88, 0)),
        new THREE.LineBasicMaterial({ color: s.color }),
      );
      wire.position.y = 1.0;
      grp.add(wire);
      grp.userData.spinningChild = oct;
    } else if (s.geom === "pods") {
      // Cluster of 6 small pods arranged in a 2x3 grid
      const podColors = [
        0x60a5fa, 0xa78bfa, 0x34d399, 0xfbbf24, 0xfb7185, 0xc084fc,
      ];
      for (let i = 0; i < 6; i++) {
        const c = podColors[i];
        const mat = new THREE.MeshStandardMaterial({
          color: c,
          emissive: c,
          emissiveIntensity: 0.3,
          metalness: 0.3,
          roughness: 0.5,
          transparent: true,
          opacity: 0.9,
        });
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.55, 0.55),
          mat,
        );
        const col = i % 3;
        const row = Math.floor(i / 3);
        box.position.set((col - 1) * 0.85, 0.4 + row * 0.85, 0);
        grp.add(box);
      }
    }

    // Floor pad (a small tile under each station for grounding)
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 32),
      new THREE.MeshBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: 0.13,
      }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -0.65;
    grp.add(pad);

    scene.add(grp);
    stations[s.name] = { ...s, group: grp };
  });

  // Connection lines between stations (faint, decorative)
  for (let i = 0; i < STAGES.length - 1; i++) {
    const a = STAGES[i],
      b = STAGES[i + 1];
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x + 0.8, 0.7, 0),
      new THREE.Vector3(b.x - 0.8, 0.7, 0),
    ]);
    const line = new THREE.Line(
      g,
      new THREE.LineDashedMaterial({
        color: 0x52525b,
        dashSize: 0.15,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.5,
      }),
    );
    line.computeLineDistances();
    scene.add(line);
  }

  // Particle pool: each particle travels through stages
  const PARTICLE_COUNT = 60;
  const partGeom = new THREE.SphereGeometry(0.1, 10, 10);
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0,
    });
    const m = new THREE.Mesh(partGeom, mat);
    m.userData = { active: false };
    scene.add(m);
    particles.push(m);
  }

  // Counters per station (request / response)
  let counters = {
    internet: 0,
    cdn: 0,
    cloud: 0,
    ingress: 0,
    service: 0,
    pods: 0,
    blocked: 0,
    responses: 0,
  };
  let onChange = null;
  let ddosMode = false;

  function notify() {
    if (onChange) onChange({ ...counters });
  }

  function reset() {
    Object.keys(counters).forEach((k) => (counters[k] = 0));
    particles.forEach((p) => {
      p.userData.active = false;
      p.material.opacity = 0;
    });
    ddosMode = false;
    notify();
  }

  function emitOne(isMalicious = false) {
    const idle = particles.find((p) => !p.userData.active);
    if (!idle) return;
    // Start at the internet station (random offset)
    const start = stations.internet.group.position.clone();
    start.x += (Math.random() - 0.5) * 0.6;
    start.y += 0.4 + Math.random() * 0.4;
    start.z += (Math.random() - 0.5) * 0.6;
    idle.position.copy(start);
    idle.userData = {
      active: true,
      stage: 0, // index into STAGES
      direction: "in",
      malicious: isMalicious,
      birth: performance.now(),
      target: stations.cdn.group.position
        .clone()
        .add(new THREE.Vector3(0, 0.8, 0)),
    };
    idle.material.opacity = 0.95;
    idle.material.color.setHex(isMalicious ? 0xfb7185 : 0xffffff);
    idle.material.emissive.setHex(isMalicious ? 0xfb7185 : 0xffffff);
    counters.internet += 1;
    notify();
  }

  function sendRequest() {
    emitOne(false);
  }
  function sendBurst(n = 25) {
    for (let i = 0; i < n; i++) setTimeout(() => emitOne(false), i * 30);
  }
  function simulateDDoS() {
    ddosMode = true;
    for (let i = 0; i < 50; i++) setTimeout(() => emitOne(true), i * 25);
    setTimeout(() => {
      ddosMode = false;
    }, 3000);
  }

  function update(dt, t) {
    // Spin/pulse station icons
    Object.values(stations).forEach((s, i) => {
      if (s.geom === "octahedron") {
        s.group.children[0].rotation.y += dt * 0.7;
        s.group.children[0].rotation.x = Math.sin(t * 0.5) * 0.15;
      }
      if (s.geom === "pillar") {
        s.group.children[1].rotation.z += dt * 0.5;
      }
      if (s.geom === "shield") {
        s.group.children[0].rotation.y += dt * 0.4;
      }
      // Subtle bobble
      s.group.position.y = Math.sin(t * 0.8 + i * 0.5) * 0.04;
    });

    // Particle progression through stages
    const now = performance.now();
    particles.forEach((p) => {
      const ud = p.userData;
      if (!ud.active) return;

      // Move toward target
      p.position.lerp(ud.target, 0.13);
      const dist = p.position.distanceTo(ud.target);

      if (dist < 0.25) {
        // Reached current target. Increment stage / handle CDN blocking.
        if (ud.direction === "in") {
          if (ud.stage === 0) {
            // Just arrived at CDN
            counters.cdn += 1;
            // If malicious, ~85% blocked at CDN
            if (ud.malicious && Math.random() < 0.85) {
              counters.blocked += 1;
              ud.active = false;
              p.material.opacity = 0;
              notify();
              return;
            }
            ud.stage = 1;
            ud.target = stations.cloud.group.position
              .clone()
              .add(new THREE.Vector3(0, 0.75, 0));
            // Color shift to CDN orange briefly
            p.material.color.setHex(0xf38020);
            p.material.emissive.setHex(0xf38020);
          } else if (ud.stage === 1) {
            counters.cloud += 1;
            ud.stage = 2;
            ud.target = stations.ingress.group.position
              .clone()
              .add(new THREE.Vector3(0, 0.9, 0));
            p.material.color.setHex(0xc7000b);
            p.material.emissive.setHex(0xc7000b);
          } else if (ud.stage === 2) {
            counters.ingress += 1;
            ud.stage = 3;
            ud.target = stations.service.group.position
              .clone()
              .add(new THREE.Vector3(0, 1.0, 0));
            p.material.color.setHex(0x002fa7);
            p.material.emissive.setHex(0x002fa7);
          } else if (ud.stage === 3) {
            counters.service += 1;
            // Pick a random pod inside the pods station
            const podsGrp = stations.pods.group;
            const podMeshes = podsGrp.children.filter(
              (c) => c.geometry?.type === "BoxGeometry",
            );
            const target =
              podMeshes[Math.floor(Math.random() * podMeshes.length)];
            // Compute pod position in scene-local coordinates
            // (particle moves in scene-local space because it's a direct child of `scene`)
            const podLocal = new THREE.Vector3()
              .copy(podsGrp.position)
              .add(target.position);
            ud.target = podLocal;
            ud.stage = 4;
            p.material.color.setHex(0x22d3ee);
            p.material.emissive.setHex(0x22d3ee);
          } else if (ud.stage === 4) {
            counters.pods += 1;
            // Now generate a response — switch direction
            ud.direction = "out";
            ud.stage = 4;
            ud.target = stations.service.group.position
              .clone()
              .add(new THREE.Vector3(0, 1.0, 0));
            p.material.color.setHex(0x34d399);
            p.material.emissive.setHex(0x34d399);
            notify();
          }
        } else {
          // Direction = 'out' — flow back through stations
          if (ud.stage === 4) {
            ud.target = stations.ingress.group.position
              .clone()
              .add(new THREE.Vector3(0, 0.9, 0));
            ud.stage = 3;
          } else if (ud.stage === 3) {
            ud.target = stations.cloud.group.position
              .clone()
              .add(new THREE.Vector3(0, 0.75, 0));
            ud.stage = 2;
          } else if (ud.stage === 2) {
            ud.target = stations.cdn.group.position
              .clone()
              .add(new THREE.Vector3(0, 0.8, 0));
            ud.stage = 1;
          } else if (ud.stage === 1) {
            ud.target = stations.internet.group.position
              .clone()
              .add(new THREE.Vector3(0, 0.6, 0));
            ud.stage = 0;
          } else {
            // Reached internet on the way out — done, count response
            counters.responses += 1;
            ud.active = false;
            p.material.opacity = 0;
            notify();
          }
        }
      }

      // Fade as particle moves (slight pulse)
      p.material.emissiveIntensity = 0.7 + Math.sin(t * 6) * 0.2;
    });

    scene.rotation.y = Math.sin(t * 0.07) * 0.04;
  }

  return {
    scene,
    camera,
    onResize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update,
    reset,
    sendRequest,
    sendBurst,
    simulateDDoS,
    setOnChange(fn) {
      onChange = fn;
    },
  };
}

// ----- Scene registry & active scene -------------------------------

const scenes = {
  particles: createParticlesScene(),
  aurora: createAuroraScene(false),
  "aurora-soft": createAuroraScene(true),
  "image-container": createImageContainerScene(),
  "density-race": createDensityRaceScene(),
  "cold-start": createColdStartScene(),
  "cve-hunt": createCVEHuntScene(),
  "self-healing": createSelfHealingScene(),
  "pod-scaling": createPodScalingScene(),
  "cluster-topology": createClusterTopologyScene(),
  "deploy-race": createDeployRaceScene(),
  "traffic-wave": createTrafficWaveScene(),
  "rolling-deploy": createRollingDeployScene(),
  chaos: createChaosScene(),
  canary: createCanaryScene(),
  "service-routing": createServiceRoutingScene(),
  "edge-to-pod": createEdgeToPodScene(),
};
let active = null;

export function setSceneForSlide(slideEl, color) {
  const sceneName = slideEl.dataset.scene || null;
  active = sceneName ? scenes[sceneName] : null;

  // Push the section accent into the active scene if it accepts a color
  if (active && active.setColor) active.setColor(ACCENT[color] || ACCENT.teal);
  if (scenes.aurora.setColor)
    scenes.aurora.setColor(ACCENT[color] || ACCENT.teal);
  if (scenes["aurora-soft"].setColor)
    scenes["aurora-soft"].setColor(ACCENT[color] || ACCENT.teal);
}

export function spawnContainer() {
  scenes["image-container"].spawn();
}
export function resetContainers() {
  scenes["image-container"].reset();
}
export function getContainerCount() {
  return scenes["image-container"].count();
}

// Density Race game API
export function densitySetMode(mode) {
  scenes["density-race"].setMode(mode);
}
export function densityDeploy() {
  return scenes["density-race"].deploy();
}
export function densityReset() {
  scenes["density-race"].reset();
}
export function densityCount() {
  return scenes["density-race"].count();
}
export function densityMode() {
  return scenes["density-race"].mode();
}
export function densityLimit() {
  return scenes["density-race"].limit();
}

// Cold-Start Race game API
export function startColdStartRace(cb) {
  scenes["cold-start"].startRace(cb);
}
export function resetColdStartRace() {
  scenes["cold-start"].reset();
}

// CVE Hunt API
export function setCVETier(tier) {
  scenes["cve-hunt"].setTier(tier);
}
export function getCVECounts() {
  return scenes["cve-hunt"].counts();
}

// Self-Healing API
export function selfHealReset() {
  scenes["self-healing"].reset();
}
export function selfHealKillRandom() {
  scenes["self-healing"].killRandom();
}
export function selfHealSetOnChange(fn) {
  scenes["self-healing"].setOnChange(fn);
}
export function selfHealOnPointerMove(canvas, ev) {
  scenes["self-healing"].onPointerMove(canvas, ev);
}
export function selfHealOnClick(canvas, ev) {
  scenes["self-healing"].onClick(canvas, ev);
}
export function selfHealIsHovering() {
  return scenes["self-healing"].isHoveringPod();
}

// Pod Scaling API
export function podScalingReset() {
  scenes["pod-scaling"].reset();
}
export function podScalingSetLoad(v) {
  scenes["pod-scaling"].setLoad(v);
}
export function podScalingSetOnChange(fn) {
  scenes["pod-scaling"].setOnChange(fn);
}

// Cluster Topology API
export function topologyHighlight(ns) {
  scenes["cluster-topology"].setHighlight(ns);
}

// Deploy Race API
export function deployRaceStart(cb) {
  scenes["deploy-race"].start(cb);
}
export function deployRaceReset() {
  scenes["deploy-race"].reset();
}

// Traffic Wave API
export function trafficWaveReset() {
  scenes["traffic-wave"].reset();
}
export function trafficWaveStart() {
  scenes["traffic-wave"].startWave();
}
export function trafficWaveStop() {
  scenes["traffic-wave"].stopWave();
}
export function trafficWaveSetOnChange(fn) {
  scenes["traffic-wave"].setOnChange(fn);
}

// Rolling Deploy API
export function rollingDeployReset() {
  scenes["rolling-deploy"].reset();
}
export function rollingDeployStart() {
  return scenes["rolling-deploy"].startRolling();
}
export function rollingDeploySetOnChange(fn) {
  scenes["rolling-deploy"].setOnChange(fn);
}

// Chaos API
export function chaosReset() {
  scenes["chaos"].reset();
}
export function chaosKillNode(i) {
  scenes["chaos"].killNode(i);
}
export function chaosRestoreNode(i) {
  scenes["chaos"].restoreNode(i);
}
export function chaosSetOnChange(fn) {
  scenes["chaos"].setOnChange(fn);
}
export function chaosNodeAlive(i) {
  return scenes["chaos"].nodeAlive(i);
}

// Canary API
export function canaryReset() {
  scenes["canary"].reset();
}
export function canarySetPct(p) {
  scenes["canary"].setCanaryPct(p);
}
export function canarySetOnChange(fn) {
  scenes["canary"].setOnChange(fn);
}

// Service Routing API
export function svcReset() {
  scenes["service-routing"].reset();
}
export function svcAddPod() {
  scenes["service-routing"].addPod();
}
export function svcRemovePod() {
  scenes["service-routing"].removePod();
}
export function svcKillRandom() {
  scenes["service-routing"].killRandom();
}
export function svcPodCount() {
  return scenes["service-routing"].podCount();
}

// Edge-to-Pod traffic flow API
export function edgeReset() {
  scenes["edge-to-pod"].reset();
}
export function edgeSend() {
  scenes["edge-to-pod"].sendRequest();
}
export function edgeBurst(n) {
  scenes["edge-to-pod"].sendBurst(n);
}
export function edgeDDoS() {
  scenes["edge-to-pod"].simulateDDoS();
}
export function edgeSetOnChange(fn) {
  scenes["edge-to-pod"].setOnChange(fn);
}

// ----- Render loop --------------------------------------------------

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // Update all scenes — they're cheap and decouples timing from active state
  for (const s of Object.values(scenes)) s.update?.(dt, t);

  renderer.clear();
  if (active) renderer.render(active.scene, active.camera);
}
animate();
