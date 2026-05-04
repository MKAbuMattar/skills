// Kubernetes Fundamentals — slide controller
// Handles navigation, click-driven builds, code highlighting, overlays.

import {
  setSceneForSlide,
  resetContainers,
  spawnContainer,
  getContainerCount,
  densitySetMode,
  densityDeploy,
  densityReset,
  densityCount,
  densityMode,
  densityLimit,
  startColdStartRace,
  resetColdStartRace,
  setCVETier,
  getCVECounts,
  selfHealReset,
  selfHealKillRandom,
  selfHealSetOnChange,
  selfHealOnPointerMove,
  selfHealOnClick,
  selfHealIsHovering,
  podScalingReset,
  podScalingSetLoad,
  podScalingSetOnChange,
  topologyHighlight,
  deployRaceStart,
  deployRaceReset,
  trafficWaveReset,
  trafficWaveStart,
  trafficWaveStop,
  trafficWaveSetOnChange,
  rollingDeployReset,
  rollingDeployStart,
  rollingDeploySetOnChange,
  chaosReset,
  chaosKillNode,
  chaosRestoreNode,
  chaosSetOnChange,
  canaryReset,
  canarySetPct,
  canarySetOnChange,
  svcReset,
  svcAddPod,
  svcRemovePod,
  svcKillRandom,
  svcPodCount,
  edgeReset,
  edgeSend,
  edgeBurst,
  edgeDDoS,
  edgeSetOnChange,
} from "./scenes.js";

const slides = Array.from(document.querySelectorAll(".slide"));
const sectionLabel = document.getElementById("section-label");
const slideCounter = document.getElementById("slide-counter");
const progressFill = document.getElementById("progress-fill");
const notesPanel = document.getElementById("notes-panel");
const helpOverlay = document.getElementById("help-overlay");
const overviewGrid = document.getElementById("overview-grid");

const state = {
  index: 0,
  buildStep: 0, // for slides with progressive builds
  notesVisible: false,
};

// ----- Per-slide build configuration -------------------------------

// Slides with click-driven builds: how many build steps each has.
// Index: slide number (0-based). Value: total build steps before advancing.
function getBuildCount(slideEl) {
  // Code-highlight-line slides
  if (slideEl.querySelector(".code-block.highlight-lines")) {
    const lines = slideEl.querySelectorAll(
      ".code-block.highlight-lines code .line",
    );
    return lines.length;
  }
  // Tier grid (security tiers slide)
  if (slideEl.querySelector(".tier-grid.build")) {
    return slideEl.querySelectorAll(".tier-grid.build > [data-build]").length;
  }
  // Image-vs-container slide (slide w/ data-scene="image-container")
  if (slideEl.dataset.scene === "image-container") {
    return slideEl.querySelectorAll(".bullets.build li[data-build]").length;
  }
  return 0;
}

// ----- Code line splitting (for highlight-on-click) ----------------

function prepareCodeLines() {
  document
    .querySelectorAll(".code-block.highlight-lines code")
    .forEach((codeEl) => {
      if (codeEl.dataset.prepared) return;
      const text = codeEl.textContent;
      const lines = text.split("\n");
      codeEl.innerHTML = lines
        .map(
          (line) => `<span class="line">${escapeHtml(line) || "&nbsp;"}</span>`,
        )
        .join("");
      codeEl.dataset.prepared = "1";
    });
}

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// ----- Render one slide --------------------------------------------

function showSlide(idx) {
  if (idx < 0 || idx >= slides.length) return;
  state.index = idx;
  state.buildStep = 0;

  // Exit fullscreen-game on the previous slide before navigating
  document.querySelectorAll(".slide.fullscreen-game").forEach((s) => {
    s.classList.remove("fullscreen-game");
    const btn = s.querySelector("[data-fs-toggle]");
    if (btn) btn.textContent = "▶ Play full-screen";
  });
  slides.forEach((s, i) => s.classList.toggle("active", i === idx));

  const slide = slides[idx];
  const section = slide.dataset.section || "";
  const color = slide.dataset.color || "teal";

  // UI frame: section label + counter + progress
  sectionLabel.textContent = section;
  slideCounter.textContent = `${idx + 1} / ${slides.length}`;
  progressFill.style.width = `${((idx + 1) / slides.length) * 100}%`;

  // Apply section accent to UI frame via :root override
  document.documentElement.style.setProperty(
    "--ui-accent",
    getColorValue(color),
  );
  document.querySelector(".ui-frame").setAttribute("data-color", color);

  // Reset all build-state on the new slide
  slide
    .querySelectorAll(".revealed")
    .forEach((el) => el.classList.remove("revealed"));
  slide
    .querySelectorAll(".code-block.highlight-lines code .line.active")
    .forEach((el) => el.classList.remove("active"));

  // Speaker notes
  const notes = slide.querySelector(".notes");
  notesPanel.textContent = notes ? notes.textContent.trim() : "";

  // Hand off to Three.js scene controller
  setSceneForSlide(slide, color);

  // Reset container scene state when arriving on the image-container slide
  if (slide.dataset.scene === "image-container") {
    resetContainers();
  }
  // Initialize density race UI when arriving on the game slide
  if (slide.dataset.scene === "density-race") {
    densityReset();
    densitySetMode("bare");
    refreshGameStats();
  }
  // Initialize cold-start race UI
  if (slide.dataset.scene === "cold-start") {
    resetColdStartRace();
    refreshRaceUI({ idle: true });
  }
  // Initialize CVE hunt UI
  if (slide.dataset.scene === "cve-hunt") {
    setCVETier("normal");
    refreshCVEUI("normal");
  }

  // Self-Healing — set up canvas pointer events while on this slide
  if (slide.dataset.scene === "self-healing") {
    selfHealReset();
    selfHealSetOnChange(refreshHealUI);
    refreshHealUI({ alive: 3, kills: 0, respawns: 0 });
    setCanvasInteractive("self-healing");
  } else {
    setCanvasInteractive(null);
  }

  // Pod Scaling — wire slider once
  if (slide.dataset.scene === "pod-scaling") {
    podScalingReset();
    podScalingSetOnChange(refreshScaleUI);
    const slider = document.getElementById("load-slider");
    if (slider) {
      slider.value = 0;
      slider.oninput = () => {
        const v = parseInt(slider.value, 10);
        podScalingSetLoad(v);
        const lv = document.getElementById("load-value");
        if (lv) lv.textContent = v + "%";
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

  // Cluster topology — bind namespace pickers
  if (slide.dataset.scene === "cluster-topology") {
    topologyHighlight("all");
  }
  // Deploy Race
  if (slide.dataset.scene === "deploy-race") {
    deployRaceReset();
    refreshDeployRaceUI({ idle: true });
  }
  // Traffic Wave
  if (slide.dataset.scene === "traffic-wave") {
    trafficWaveReset();
    trafficWaveSetOnChange(refreshTrafficWaveUI);
    refreshTrafficWaveUI({ load: 0, replicas: 2, served: 0, dropped: 0 });
  }
  // Rolling Deploy
  if (slide.dataset.scene === "rolling-deploy") {
    rollingDeployReset();
    rollingDeploySetOnChange(refreshRollingUI);
    refreshRollingUI({ total: 4, v1: 4, v2: 0 });
  }
  // Chaos
  if (slide.dataset.scene === "chaos") {
    chaosReset();
    chaosSetOnChange(refreshChaosUI);
    refreshChaosUI({
      aliveNodes: 2,
      totalPods: 12,
      evicted: 0,
      rescheduled: 0,
    });
  }
  // Canary
  if (slide.dataset.scene === "canary") {
    canaryReset();
    canarySetOnChange(refreshCanaryUI);
    const slider = document.getElementById("canary-slider");
    if (slider) {
      slider.value = 0;
      slider.oninput = () => {
        const v = parseInt(slider.value, 10);
        canarySetPct(v);
        const lbl = document.getElementById("canary-pct-label");
        if (lbl) lbl.textContent = v + "%";
      };
    }
    refreshCanaryUI({
      pct: 0,
      v1Count: 10,
      v2Count: 0,
      trafficV1: 0,
      trafficV2: 0,
    });
  }
  // Service Routing
  if (slide.dataset.scene === "service-routing") {
    svcReset();
    refreshSvcUI();
  }
  // Edge-to-pod
  if (slide.dataset.scene === "edge-to-pod") {
    edgeReset();
    edgeSetOnChange(refreshEdgeUI);
    refreshEdgeUI({ cloudflare: 0, blocked: 0, pods: 0, responses: 0 });
  }

  // Re-trigger Prism on the active slide if needed
  if (window.Prism) {
    slide
      .querySelectorAll("pre code:not([data-prism-applied])")
      .forEach((c) => {
        if (c.closest(".highlight-lines")) return; // skip — different system
        window.Prism.highlightElement(c);
        c.dataset.prismApplied = "1";
      });
  }
}

function getColorValue(name) {
  const map = {
    teal: "#14b8a6",
    red: "#f87171",
    purple: "#a78bfa",
    amber: "#fbbf24",
    green: "#34d399",
    blue: "#60a5fa",
    "deep-purple": "#c084fc",
  };
  return map[name] || map.teal;
}

// ----- Navigation: builds first, then slides -----------------------

function next() {
  const slide = slides[state.index];
  const buildCount = getBuildCount(slide);

  if (state.buildStep < buildCount) {
    state.buildStep += 1;
    applyBuildStep(slide, state.buildStep);
    return;
  }
  if (state.index < slides.length - 1) showSlide(state.index + 1);
}

function prev() {
  if (state.buildStep > 0) {
    state.buildStep -= 1;
    applyBuildStep(slides[state.index], state.buildStep);
    return;
  }
  if (state.index > 0) showSlide(state.index - 1);
}

function applyBuildStep(slide, step) {
  // Code line highlight
  const codeBlock = slide.querySelector(".code-block.highlight-lines");
  if (codeBlock) {
    const lines = codeBlock.querySelectorAll("code .line");
    lines.forEach((el, i) => el.classList.toggle("active", i + 1 === step));
    return;
  }

  // Tier grid reveal
  const tierGrid = slide.querySelector(".tier-grid.build");
  if (tierGrid) {
    tierGrid.querySelectorAll("[data-build]").forEach((el) => {
      const n = parseInt(el.dataset.build, 10);
      el.classList.toggle("revealed", n <= step);
    });
    return;
  }

  // Image-container build (bullets reveal AND a container spawns)
  if (slide.dataset.scene === "image-container") {
    slide.querySelectorAll(".bullets.build li").forEach((el) => {
      const n = parseInt(el.dataset.build, 10);
      el.classList.toggle("revealed", n <= step);
    });
    // Sync 3D scene: ensure exactly `step` containers exist
    while (getContainerCount() < step) spawnContainer();
  }
}

// ----- Image-vs-container interactive controls ----------------------

document.addEventListener("click", (e) => {
  if (e.target.id === "spawn-container-btn") {
    spawnContainer();
    const slide = slides[state.index];
    if (slide.dataset.scene === "image-container") {
      const max = slide.querySelectorAll(".bullets.build li").length;
      state.buildStep = Math.min(state.buildStep + 1, max);
      applyBuildStep(slide, state.buildStep);
    }
  }
  if (e.target.id === "reset-containers-btn") {
    resetContainers();
    const slide = slides[state.index];
    if (slide.dataset.scene === "image-container") {
      state.buildStep = 0;
      slide
        .querySelectorAll(".bullets.build li")
        .forEach((el) => el.classList.remove("revealed"));
    }
  }
});

// ----- Density-race game controls ----------------------------------

const GAME_COSTS = {
  bare: {
    ramPerApp: 32,
    bootSeconds: 300,
    totalRam: 32,
    label: "32 GB · ~5 min boot",
  },
  vm: {
    ramPerApp: 8,
    bootSeconds: 30,
    totalRam: 32,
    label: "8 GB · ~30 s boot",
  },
  container: {
    ramPerApp: 0.25,
    bootSeconds: 0.7,
    totalRam: 32,
    label: "256 MB · < 1 s boot",
  },
};

function refreshGameStats() {
  const slide = document.querySelector(".game-slide");
  if (!slide || !slide.classList.contains("active")) return;

  const mode = densityMode();
  const count = densityCount();
  const limit = densityLimit();
  const cfg = GAME_COSTS[mode];

  slide.dataset.activeMode = mode;
  // Sync mode button visual state
  slide
    .querySelectorAll(".mode-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

  const apps = document.getElementById("stat-apps");
  const ram = document.getElementById("stat-ram");
  const boot = document.getElementById("stat-boot");
  const cost = document.getElementById("stat-cost");
  const barApps = document.getElementById("bar-apps");
  const barRam = document.getElementById("bar-ram");
  const toast = document.getElementById("game-toast");

  if (apps) apps.textContent = `${count} / ${limit}`;
  const ramUsed = Math.min(cfg.totalRam, count * cfg.ramPerApp);
  if (ram)
    ram.innerHTML = `${ramUsed.toFixed(ramUsed < 1 ? 2 : 1)} GB <span class="stat-unit">/ ${cfg.totalRam} GB</span>`;
  if (boot)
    boot.textContent =
      count === 0
        ? "— s"
        : `${cfg.bootSeconds < 1 ? cfg.bootSeconds.toFixed(1) : cfg.bootSeconds.toFixed(0)} s`;
  if (cost) cost.textContent = cfg.label;

  if (barApps) barApps.style.width = `${(count / limit) * 100}%`;
  if (barRam) {
    const ramPct = (ramUsed / cfg.totalRam) * 100;
    barRam.style.width = `${ramPct}%`;
    barRam.classList.toggle("danger", ramPct >= 100);
    barRam.classList.toggle("warn", ramPct >= 60 && ramPct < 100);
  }

  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (count === limit) {
      if (mode === "container") {
        toast.textContent = `Server full: ${count} containers in ${ramUsed.toFixed(1)} GB. ~${Math.floor(cfg.totalRam / cfg.ramPerApp)}× the throughput of bare metal.`;
        toast.classList.add("show", "win");
      } else if (mode === "vm") {
        toast.textContent = `Server full at ${count} VMs. Switch to Containers to fit ~30× more.`;
        toast.classList.add("show", "full");
      } else {
        toast.textContent = `Server full at 1 app. The whole machine is yours — and only yours.`;
        toast.classList.add("show", "full");
      }
    }
  }
}

document.addEventListener("click", (e) => {
  // Density mode switcher
  if (e.target.closest(".mode-btn")) {
    const btn = e.target.closest(".mode-btn");
    const mode = btn.dataset.mode;
    densitySetMode(mode);
    refreshGameStats();
  }
  // Density deploy
  if (e.target.id === "game-deploy") {
    const ok = densityDeploy();
    refreshGameStats();
    if (!ok) {
      const toast = document.getElementById("game-toast");
      if (toast) toast.classList.add("show", "full");
    }
  }
  // Density reset
  if (e.target.id === "game-reset") {
    densityReset();
    refreshGameStats();
  }

  // Cold-Start race controls
  if (e.target.id === "race-start") {
    refreshRaceUI({ running: true, vmS: 0, containerS: 0 });
    startColdStartRace((p) =>
      refreshRaceUI({
        running: !(p.vmDone && p.containerDone),
        // Map animation seconds back to "real" boot time for display
        vmS: Math.min(30, (p.elapsed * 30) / 4.0),
        containerS: Math.min(0.7, (p.elapsed * 0.7) / 0.18),
        vmDone: p.vmDone,
        containerDone: p.containerDone,
      }),
    );
  }
  if (e.target.id === "race-reset") {
    resetColdStartRace();
    refreshRaceUI({ idle: true });
  }

  // CVE Hunt tier switcher
  if (e.target.closest(".tier-btn")) {
    const btn = e.target.closest(".tier-btn");
    const tier = btn.dataset.tier;
    setCVETier(tier);
    refreshCVEUI(tier);
  }

  // Pipeline animation
  if (e.target.id === "pipeline-run") {
    runPipelineAnimation();
  }
});

// ----- Cold-Start Race UI helpers ----------------------------------

function refreshRaceUI({
  idle,
  running,
  vmS,
  containerS,
  vmDone,
  containerDone,
}) {
  const vm = document.getElementById("race-vm");
  const c = document.getElementById("race-container");
  const vs = document.getElementById("race-vm-status");
  const cs = document.getElementById("race-container-status");
  const diff = document.getElementById("race-diff");
  const toast = document.getElementById("race-toast");

  if (idle) {
    if (vm) vm.textContent = "— s";
    if (c) c.textContent = "— s";
    if (vs) {
      vs.textContent = "waiting";
      vs.className = "clock-status";
    }
    if (cs) {
      cs.textContent = "waiting";
      cs.className = "clock-status";
    }
    if (diff) diff.textContent = "—";
    if (toast) toast.classList.remove("show", "win");
    return;
  }
  if (typeof vmS === "number") vm.textContent = vmS.toFixed(1) + " s";
  if (typeof containerS === "number")
    c.textContent = containerS.toFixed(2) + " s";
  if (vs) {
    vs.textContent = vmDone ? "app up" : "booting";
    vs.className = "clock-status " + (vmDone ? "done" : "running");
  }
  if (cs) {
    cs.textContent = containerDone ? "app up" : "starting";
    cs.className = "clock-status " + (containerDone ? "done" : "running");
  }
  if (vmDone && containerDone) {
    const ratio = (30 / 0.7).toFixed(0);
    if (diff) diff.textContent = `~${ratio}× faster`;
    if (toast) {
      toast.textContent = `Container started in 0.7 s. VM took 30 s. That's ~${ratio}× — and it's why CI/CD timeouts feel different in a container world.`;
      toast.classList.add("show", "win");
    }
  }
}

// ----- CVE Hunt UI helpers -----------------------------------------

const CVE_DATA = {
  normal: { total: 47, high: 39, critical: 8, size: "1.09 GB", shell: "Yes" },
  hardened: {
    total: 4,
    high: 4,
    critical: 0,
    size: "142 MB",
    shell: "No (apk only)",
  },
  distroless: { total: 0, high: 0, critical: 0, size: "118 MB", shell: "None" },
};

function refreshCVEUI(tier) {
  const cfg = CVE_DATA[tier];
  if (!cfg) return;
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = v;
    el.classList.remove("flash");
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add("flash");
  };
  setVal("cve-total", cfg.total);
  setVal("cve-high", cfg.high);
  setVal("cve-critical", cfg.critical);
  setVal("cve-size", cfg.size);
  setVal("cve-shell", cfg.shell);

  // Active state on tier buttons
  document.querySelectorAll(".tier-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tier === tier);
  });

  const toast = document.getElementById("cve-toast");
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (tier === "distroless") {
      toast.textContent =
        "Zero CVEs. No shell. ~9× smaller. This is what production should pull.";
      toast.classList.add("show", "win");
    } else if (tier === "hardened") {
      toast.textContent =
        "~12× fewer CVEs and no Critical. Minimal attack surface.";
      toast.classList.add("show", "win");
    } else {
      toast.textContent =
        "47 vulnerabilities, 8 Critical. Convenient for dev — wrong default for prod.";
      toast.classList.add("show", "full");
    }
  }
}

// ----- Fullscreen-game toggle --------------------------------------

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-fs-toggle]");
  if (!btn) return;
  const slide = btn.closest(".slide");
  if (!slide) return;
  const isFs = slide.classList.toggle("fullscreen-game");
  btn.textContent = isFs ? "✕ Exit full-screen" : "▶ Play full-screen";
});

// Esc exits fullscreen-game mode
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const fs = document.querySelector(".slide.fullscreen-game");
    if (fs) {
      fs.classList.remove("fullscreen-game");
      const btn = fs.querySelector("[data-fs-toggle]");
      if (btn) btn.textContent = "▶ Play full-screen";
    }
  }
});

// When changing slides, exit fullscreen-game on the previous slide
const _origShowSlide = typeof showSlide !== "undefined" ? showSlide : null;

// ----- Self-Healing canvas interaction -----------------------------

let canvasInteractiveScene = null;
function setCanvasInteractive(sceneName) {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  canvas.style.pointerEvents = sceneName ? "auto" : "none";
  canvasInteractiveScene = sceneName;
}

(function bindCanvasEvents() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  canvas.addEventListener("mousemove", (ev) => {
    if (canvasInteractiveScene === "self-healing") {
      selfHealOnPointerMove(canvas, ev);
      canvas.style.cursor = selfHealIsHovering() ? "pointer" : "default";
    }
  });
  canvas.addEventListener("click", (ev) => {
    if (canvasInteractiveScene === "self-healing") {
      selfHealOnClick(canvas, ev);
    }
  });
})();

// ----- Self-Healing UI -----

function refreshHealUI({ alive, kills, respawns }) {
  const aliveEl = document.getElementById("heal-alive");
  const bar = document.getElementById("heal-bar");
  const killsEl = document.getElementById("heal-kills");
  const respEl = document.getElementById("heal-respawns");
  const toast = document.getElementById("heal-toast");
  if (aliveEl) aliveEl.textContent = String(alive);
  if (bar) {
    bar.style.width = (alive / 3) * 100 + "%";
    bar.classList.toggle("warn", alive < 3);
    bar.classList.toggle("danger", alive === 0);
  }
  if (killsEl) killsEl.textContent = String(kills || 0);
  if (respEl) respEl.textContent = String(respawns || 0);
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (kills > 0 && alive === 3) {
      toast.textContent = `K8s restored desired state. ${kills} kill${kills === 1 ? "" : "s"} → ${respawns} respawn${respawns === 1 ? "" : "s"}. Cluster keeps reconciling.`;
      toast.classList.add("show", "win");
    } else if (alive < 3) {
      toast.textContent = "Pod terminated. Replacement spawning…";
      toast.classList.add("show", "full");
    }
  }
}

document.addEventListener("click", (e) => {
  if (e.target.id === "heal-kill-random") selfHealKillRandom();
  if (e.target.id === "heal-reset") {
    selfHealReset();
    refreshHealUI({ alive: 3, kills: 0, respawns: 0 });
  }
});

// ----- Pod Scaling UI -----

function refreshScaleUI({ replicas, cpu, decision, max, min }) {
  const r = document.getElementById("scale-replicas");
  const bar = document.getElementById("scale-bar");
  const cpuEl = document.getElementById("scale-cpu");
  const dec = document.getElementById("scale-decision");
  const toast = document.getElementById("scale-toast");
  if (r) r.textContent = `${replicas} / ${max}`;
  if (bar) {
    bar.style.width = (replicas / max) * 100 + "%";
    bar.classList.remove("warn", "danger");
    if (replicas >= max) bar.classList.add("danger");
    else if (replicas >= max * 0.7) bar.classList.add("warn");
  }
  if (cpuEl) {
    cpuEl.textContent = Math.round(cpu) + "%";
    cpuEl.style.color =
      cpu > 80
        ? "var(--accent-rose)"
        : cpu > 60
          ? "var(--accent-amber)"
          : "var(--accent-green)";
  }
  if (dec) {
    dec.textContent = decision;
    dec.className = "stat-value small";
    if (decision === "scale up") dec.style.color = "var(--accent-cyan)";
    else if (decision === "scale down") dec.style.color = "var(--accent-amber)";
    else dec.style.color = "var(--fg-secondary)";
  }
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (replicas >= max) {
      toast.textContent = `Hit max replicas (${max}). Time to bump maxReplicas — or add a node.`;
      toast.classList.add("show", "full");
    } else if (replicas > min && cpu < 30) {
      toast.textContent = `Scaling down — load decreased, K8s retiring extra pods.`;
      toast.classList.add("show", "win");
    } else if (decision === "scale up") {
      toast.textContent = `Scale-up triggered. CPU was above 70% target.`;
      toast.classList.add("show", "win");
    }
  }
}

// ----- Deploy Race UI -----

function refreshDeployRaceUI(p) {
  const m = document.getElementById("dr-manual");
  const d = document.getElementById("dr-docker");
  const k = document.getElementById("dr-kube");
  const e = document.getElementById("dr-elapsed");
  const toast = document.getElementById("dr-toast");

  if (p.idle) {
    if (m) m.textContent = "0 / 10";
    if (d) d.textContent = "0 / 10";
    if (k) k.textContent = "0 / 10";
    if (e) e.textContent = "— s";
    if (toast) toast.classList.remove("show", "win", "full");
    return;
  }
  if (m) m.textContent = `${Math.floor(p.manual)} / ${p.target}`;
  if (d) d.textContent = `${Math.floor(p.docker)} / ${p.target}`;
  if (k) k.textContent = `${Math.floor(p.kubernetes)} / ${p.target}`;
  if (e) e.textContent = p.elapsed.toFixed(1) + " s";

  if (p.done && toast) {
    toast.textContent = `Kubernetes finished first. Manual still has ${10 - Math.floor(p.manual)} deploys to go. This is what GitOps + automation buys you.`;
    toast.classList.add("show", "win");
  }
}

document.addEventListener("click", (e) => {
  if (e.target.id === "deploy-race-start") {
    deployRaceStart(refreshDeployRaceUI);
  }
  if (e.target.id === "deploy-race-reset") {
    deployRaceReset();
    refreshDeployRaceUI({ idle: true });
  }

  // Rolling deploy
  if (e.target.id === "roll-deploy") {
    rollingDeployStart();
  }
  if (e.target.id === "roll-reset") {
    rollingDeployReset();
    refreshRollingUI({ total: 4, v1: 4, v2: 0 });
  }

  // Traffic wave
  if (e.target.id === "wave-start") trafficWaveStart();
  if (e.target.id === "wave-stop") trafficWaveStop();
  if (e.target.id === "wave-reset") {
    trafficWaveReset();
    refreshTrafficWaveUI({ load: 0, replicas: 2, served: 0, dropped: 0 });
  }
});

// ----- Rolling Deploy UI -----

function refreshRollingUI(s) {
  const v1 = document.getElementById("roll-v1");
  const v2 = document.getElementById("roll-v2");
  const total = document.getElementById("roll-total");
  const bar = document.getElementById("roll-bar");
  const toast = document.getElementById("roll-toast");
  if (v1) v1.textContent = s.v1;
  if (v2) v2.textContent = s.v2;
  if (total) total.textContent = s.total;
  if (bar) {
    bar.style.width = (s.v2 / 4) * 100 + "%";
    bar.style.background = "var(--accent-green)";
  }
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (s.v2 === 4 && s.v1 === 0) {
      toast.textContent = `Rollout complete. 4 pods on v1.4.3. Zero requests dropped during the change.`;
      toast.classList.add("show", "win");
    } else if (s.v2 > 0 && s.v1 > 0) {
      toast.textContent = `Mid-rollout: ${s.v1} pod${s.v1 === 1 ? "" : "s"} on v1, ${s.v2} on v2. Traffic split across both.`;
      toast.classList.add("show", "full");
    }
  }
}

// ----- Traffic Wave UI -----

function refreshTrafficWaveUI(s) {
  const load = document.getElementById("wave-load");
  const loadBar = document.getElementById("wave-load-bar");
  const reps = document.getElementById("wave-replicas");
  const served = document.getElementById("wave-served");
  const dropped = document.getElementById("wave-dropped");
  const toast = document.getElementById("wave-toast");
  if (load) load.textContent = Math.round(s.load) + "%";
  if (loadBar) {
    loadBar.style.width = s.load + "%";
    loadBar.classList.remove("warn", "danger");
    if (s.load > 80) loadBar.classList.add("danger");
    else if (s.load > 60) loadBar.classList.add("warn");
  }
  if (reps) reps.textContent = `${s.replicas} / 10`;
  if (served) served.textContent = s.served || 0;
  if (dropped) {
    dropped.textContent = s.dropped || 0;
    dropped.style.color =
      s.dropped > 0 ? "var(--accent-rose)" : "var(--fg-primary)";
  }
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (s.dropped > 5) {
      toast.textContent = `${s.dropped} requests dropped — HPA is reacting. After it scales up, drops stop.`;
      toast.classList.add("show", "full");
    } else if (s.served > 50 && s.dropped === 0) {
      toast.textContent = `${s.served} requests served, 0 dropped. HPA is keeping up.`;
      toast.classList.add("show", "win");
    }
  }
}

// ----- Chaos game UI -----

function refreshChaosUI({ aliveNodes, totalPods, evicted, rescheduled }) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("chaos-nodes", `${aliveNodes} / 2`);
  set("chaos-evicted", evicted);
  set("chaos-resched", rescheduled);
  set("chaos-total", totalPods);
  const toast = document.getElementById("chaos-toast");
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (aliveNodes === 0) {
      toast.textContent = `All nodes down. Pods cannot be scheduled. This is why we have at least 2 nodes — and ideally 3.`;
      toast.classList.add("show", "full");
    } else if (aliveNodes === 1 && evicted > 0) {
      toast.textContent = `Node down. ${rescheduled} pods migrated to the surviving node. Cluster stayed up.`;
      toast.classList.add("show", "win");
    }
  }
}

document.addEventListener("click", (e) => {
  if (e.target.id === "chaos-kill-1") chaosKillNode(0);
  if (e.target.id === "chaos-kill-2") chaosKillNode(1);
  if (e.target.id === "chaos-restore") {
    chaosRestoreNode(0);
    chaosRestoreNode(1);
    chaosReset();
    refreshChaosUI({
      aliveNodes: 2,
      totalPods: 12,
      evicted: 0,
      rescheduled: 0,
    });
  }
});

// ----- Canary game UI -----

function refreshCanaryUI({ pct, v1Count, v2Count, trafficV1, trafficV2 }) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("canary-v1pods", v1Count);
  set("canary-v2pods", v2Count);
  set("canary-traffic-v1", trafficV1);
  set("canary-traffic-v2", trafficV2);
  const toast = document.getElementById("canary-toast");
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (pct === 100) {
      toast.textContent = `100% on v2. Cutover complete. v1 can now be torn down.`;
      toast.classList.add("show", "win");
    } else if (pct > 0 && pct < 100) {
      toast.textContent = `${pct}% canary. Watch error rates closely — roll back instantly if anything spikes.`;
      toast.classList.add("show", "full");
    }
  }
}

document.addEventListener("click", (e) => {
  const jumpTo = (v) => {
    canarySetPct(v);
    const slider = document.getElementById("canary-slider");
    const lbl = document.getElementById("canary-pct-label");
    if (slider) slider.value = v;
    if (lbl) lbl.textContent = v + "%";
  };
  if (e.target.id === "canary-jump-10") jumpTo(10);
  if (e.target.id === "canary-jump-50") jumpTo(50);
  if (e.target.id === "canary-jump-100") jumpTo(100);
  if (e.target.id === "canary-reset") {
    canaryReset();
    jumpTo(0);
  }
});

// ----- Service Routing game UI -----

function refreshSvcUI() {
  const cnt = document.getElementById("svc-count");
  if (cnt) cnt.textContent = svcPodCount();
  const toast = document.getElementById("svc-toast");
  if (toast) {
    toast.classList.remove("show", "win", "full");
    const c = svcPodCount();
    if (c === 0) {
      toast.textContent = `No pods. Service has no endpoints. Requests will fail.`;
      toast.classList.add("show", "full");
    } else if (c >= 8) {
      toast.textContent = `8 pods backing one Service. Plenty of capacity, automatic round-robin.`;
      toast.classList.add("show", "win");
    }
  }
}

document.addEventListener("click", (e) => {
  if (e.target.id === "svc-add") {
    svcAddPod();
    refreshSvcUI();
  }
  if (e.target.id === "svc-remove") {
    svcRemovePod();
    refreshSvcUI();
  }
  if (e.target.id === "svc-kill") {
    svcKillRandom();
    refreshSvcUI();
    setTimeout(refreshSvcUI, 1200); // after respawn
  }
  if (e.target.id === "svc-reset") {
    svcReset();
    refreshSvcUI();
  }
});

// ----- Edge-to-pod traffic flow UI -----

function refreshEdgeUI(s) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("edge-cf", s.cloudflare || 0);
  set("edge-blocked", s.blocked || 0);
  set("edge-pods", s.pods || 0);
  set("edge-resp", s.responses || 0);
  const toast = document.getElementById("edge-toast");
  if (toast) {
    toast.classList.remove("show", "win", "full");
    if (s.blocked > 10) {
      toast.textContent = `${s.blocked} malicious requests blocked at Cloudflare. Your cluster never saw them.`;
      toast.classList.add("show", "win");
    } else if (s.responses > 20) {
      toast.textContent = `${s.responses} responses returned. Round-trip path: in via Kong, out via Kong, all sub-second.`;
      toast.classList.add("show", "win");
    }
  }
}

document.addEventListener("click", (e) => {
  if (e.target.id === "edge-send") edgeSend();
  if (e.target.id === "edge-burst") edgeBurst(25);
  if (e.target.id === "edge-ddos") edgeDDoS();
  if (e.target.id === "edge-reset") {
    edgeReset();
    refreshEdgeUI({ cloudflare: 0, blocked: 0, pods: 0, responses: 0 });
  }
});

// ----- Cluster topology namespace picker -----

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".ns-btn");
  if (btn) {
    document
      .querySelectorAll(".ns-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const ns = btn.dataset.ns;
    topologyHighlight(ns);
    const showing = document.getElementById("topo-showing");
    if (showing) {
      const counts = {
        all: "92 pods",
        "kube-system": "18 pods",
        monitoring: "13 pods",
        argocd: "9 pods",
        kong: "7 pods",
        kyverno: "5 pods",
        "dev-007": "5 pods",
        "stg-007": "5 pods",
        n8n: "5 pods",
        keycloak: "4 pods",
        vault: "3 pods",
        other: "18 pods",
      };
      showing.textContent =
        (ns === "all" ? "All " : ns + " · ") + (counts[ns] || "");
    }
  }
});

// ----- Pipeline animation ------------------------------------------

function runPipelineAnimation() {
  const stages = document.querySelectorAll(".pipeline-stage");
  const arrows = document.querySelector(".pipeline");
  if (!stages.length) return;
  arrows?.classList.add("running");
  stages.forEach((s, i) => {
    setTimeout(() => {
      stages.forEach((x) => x.classList.remove("lit"));
      s.classList.add("lit");
    }, i * 600);
  });
  setTimeout(
    () => {
      stages.forEach((s) => s.classList.remove("lit"));
      arrows?.classList.remove("running");
    },
    stages.length * 600 + 800,
  );
}

// ----- Keyboard ----------------------------------------------------

document.addEventListener("keydown", (e) => {
  // Close any open overlay first on Esc
  if (e.key === "Escape") {
    if (helpOverlay.classList.contains("visible"))
      helpOverlay.classList.remove("visible");
    else if (overviewGrid.classList.contains("visible"))
      overviewGrid.classList.remove("visible");
    else if (
      document.getElementById("demo-overlay").classList.contains("visible")
    ) {
      document.getElementById("demo-overlay").classList.remove("visible");
    }
    return;
  }

  // Dismiss help on any key
  if (helpOverlay.classList.contains("visible")) {
    helpOverlay.classList.remove("visible");
    return;
  }

  switch (e.key) {
    case "ArrowRight":
    case " ":
    case "PageDown":
      e.preventDefault();
      next();
      break;
    case "ArrowLeft":
    case "PageUp":
      e.preventDefault();
      prev();
      break;
    case "Home":
      showSlide(0);
      break;
    case "End":
      showSlide(slides.length - 1);
      break;
    case "s":
    case "S":
      state.notesVisible = !state.notesVisible;
      notesPanel.classList.toggle("visible", state.notesVisible);
      break;
    case "o":
    case "O":
      toggleOverview();
      break;
    case "d":
    case "D":
      document.getElementById("demo-overlay").classList.add("visible");
      window.dispatchEvent(new CustomEvent("demo:opened"));
      break;
    case "f":
    case "F":
      toggleFullscreen();
      break;
    case "?":
      helpOverlay.classList.add("visible");
      break;
    default:
      // numeric jump
      if (/^[0-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (n === 0) showSlide(slides.length - 1);
      }
  }
});

function toggleOverview() {
  if (overviewGrid.classList.contains("visible")) {
    overviewGrid.classList.remove("visible");
    return;
  }
  overviewGrid.innerHTML = "";
  slides.forEach((slide, i) => {
    const tile = document.createElement("div");
    tile.className = "overview-tile" + (i === state.index ? " current" : "");
    tile.dataset.color = slide.dataset.color || "teal";
    const headlineEl = slide.querySelector(
      ".headline, .mega, .mega-statement, .qa-text",
    );
    const headline = headlineEl
      ? headlineEl.textContent.trim().slice(0, 60)
      : "";
    tile.innerHTML = `
      <div class="tile-section">${slide.dataset.section || ""}</div>
      <div class="tile-headline">${escapeHtml(headline)}</div>
      <div class="tile-num">${i + 1}</div>
    `;
    tile.style.setProperty(
      "--accent",
      getColorValue(slide.dataset.color || "teal"),
    );
    tile.addEventListener("click", () => {
      overviewGrid.classList.remove("visible");
      showSlide(i);
    });
    overviewGrid.appendChild(tile);
  });
  overviewGrid.classList.add("visible");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// ----- Touch nav (mobile-friendly) ---------------------------------

let touchStartX = 0;
document.addEventListener(
  "touchstart",
  (e) => {
    touchStartX = e.touches[0].clientX;
  },
  { passive: true },
);
document.addEventListener(
  "touchend",
  (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) next();
    else prev();
  },
  { passive: true },
);

// ----- Boot --------------------------------------------------------

prepareCodeLines();
showSlide(0);

// First-load hint: open help once
setTimeout(() => {
  if (!sessionStorage.getItem("docker-deck-seen-help")) {
    helpOverlay.classList.add("visible");
    sessionStorage.setItem("docker-deck-seen-help", "1");
  }
}, 800);
