// presentation.js — slide controller for the interactive deck framework.
//
// THIS FILE IS THE FRAMEWORK ONLY. It provides:
//   - slide navigation (← / → / Space / Home / End / overview grid)
//   - build-step framework (`[data-build]` progressive reveals, `.highlight-lines`)
//   - scene activation (calls `activateScene(name, color)` on the active slide)
//   - overlays: help (`?`), notes panel (`S`), overview (`O`), demo modal (`D`)
//   - browser fullscreen toggle (`F`)
//
// PER-SCENE UI WIRING (slider events, button clicks, stat tile updates) is
// authored per deck. See `references/scene-wiring.md` for the integration
// contract. Add per-scene wiring at the bottom of this file under the
// "PER-DECK WIRING" section.

import { activateScene, setActiveAccent, resetActiveScene } from "./scenes.js";

// ─── DOM references ──────────────────────────────────────────────────

const slides = Array.from(document.querySelectorAll(".slide"));
const sectionLabel = document.getElementById("section-label");
const slideCounter = document.getElementById("slide-counter");
const progressFill = document.getElementById("progress-fill");
const notesPanel = document.getElementById("notes-panel");
const helpOverlay = document.getElementById("help-overlay");
const overviewGrid = document.getElementById("overview-grid");
const demoOverlay = document.getElementById("demo-overlay");

// ─── State ───────────────────────────────────────────────────────────

const state = {
  index: 0,
  buildStep: 0,
  notesOpen: false,
  helpOpen: false,
  overviewOpen: false,
  demoOpen: false,
};

// ─── Build-step framework ────────────────────────────────────────────
//
// A slide can have `[data-build]` children that reveal one-at-a-time on →,
// and `.highlight-lines` code blocks that highlight the next line on →.
// Both are exhausted before → advances to the next slide.

function getBuildCount(slideEl) {
  const buildItems = slideEl.querySelectorAll("[data-build]").length;
  const highlightLines = slideEl.querySelectorAll(
    ".highlight-lines .hl-line",
  ).length;
  return buildItems + highlightLines;
}

function applyBuildStep(slide, step) {
  // Reveal data-build items up to step `step` (1-indexed).
  const buildItems = Array.from(slide.querySelectorAll("[data-build]"));
  buildItems.forEach((el, i) => {
    el.classList.toggle("revealed", i < step);
  });

  // Highlight code lines up to step (after build items are exhausted).
  const linesPerSlide = slide.querySelectorAll(".highlight-lines .hl-line");
  const remaining = step - buildItems.length;
  linesPerSlide.forEach((el, i) => {
    el.classList.toggle("active", i < remaining);
  });
}

function prepareCodeLines() {
  // Wrap each line in a code block with `.highlight-lines` in a span.
  document.querySelectorAll(".highlight-lines code").forEach((codeEl) => {
    if (codeEl.dataset.prepared) return;
    const lines = codeEl.innerHTML.split("\n");
    codeEl.innerHTML = lines
      .map((ln) => `<span class="hl-line">${ln}</span>`)
      .join("\n");
    codeEl.dataset.prepared = "1";
  });
}

// ─── Slide rendering ─────────────────────────────────────────────────

function showSlide(idx) {
  state.index = Math.max(0, Math.min(slides.length - 1, idx));
  state.buildStep = 0;

  slides.forEach((s, i) => {
    s.classList.toggle("active", i === state.index);
  });

  const slide = slides[state.index];
  applyBuildStep(slide, 0);

  // Section label + slide counter
  sectionLabel.textContent = slide.dataset.section || "";
  slideCounter.textContent = `${state.index + 1} / ${slides.length}`;

  // Progress bar
  const pct = ((state.index + 1) / slides.length) * 100;
  progressFill.style.width = `${pct}%`;

  // Section accent color → CSS custom property + scene
  const colorKey = slide.dataset.color || "teal";
  document.documentElement.style.setProperty(
    "--accent",
    `var(--accent-${colorKey})`,
  );

  // Activate the slide's scene (or none)
  const sceneName = slide.dataset.scene;
  if (sceneName) {
    activateScene(sceneName, colorKey);
  } else {
    setActiveAccent(colorKey);
  }

  // Speaker notes
  const notes = slide.querySelector("aside.notes");
  notesPanel.innerHTML = notes ? notes.innerHTML : "";

  // Auto-exit fullscreen-scene mode on slide change
  document.querySelectorAll(".fullscreen-scene-active").forEach((el) => {
    el.classList.remove("fullscreen-scene-active");
  });
}

function next() {
  const slide = slides[state.index];
  const buildCount = getBuildCount(slide);
  if (state.buildStep < buildCount) {
    state.buildStep++;
    applyBuildStep(slide, state.buildStep);
    return;
  }
  showSlide(state.index + 1);
}

function prev() {
  const slide = slides[state.index];
  if (state.buildStep > 0) {
    state.buildStep--;
    applyBuildStep(slide, state.buildStep);
    return;
  }
  showSlide(state.index - 1);
}

// ─── Overlays ────────────────────────────────────────────────────────

function toggleHelp() {
  state.helpOpen = !state.helpOpen;
  helpOverlay.classList.toggle("open", state.helpOpen);
}

function toggleNotes() {
  state.notesOpen = !state.notesOpen;
  notesPanel.classList.toggle("open", state.notesOpen);
}

function toggleOverview() {
  state.overviewOpen = !state.overviewOpen;
  overviewGrid.classList.toggle("open", state.overviewOpen);
  if (state.overviewOpen) renderOverview();
}

function toggleDemo() {
  state.demoOpen = !state.demoOpen;
  if (demoOverlay) demoOverlay.classList.toggle("open", state.demoOpen);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}

function renderOverview() {
  overviewGrid.innerHTML = "";
  slides.forEach((s, i) => {
    const tile = document.createElement("button");
    tile.className = "overview-tile";
    tile.dataset.color = s.dataset.color || "teal";
    const heading = s.querySelector("h1, h2, h3");
    tile.innerHTML = `
      <span class="overview-num">${i + 1}</span>
      <span class="overview-title">${heading ? heading.textContent : "(slide)"}</span>
    `;
    tile.addEventListener("click", () => {
      toggleOverview();
      showSlide(i);
    });
    overviewGrid.appendChild(tile);
  });
}

// ─── Keyboard ────────────────────────────────────────────────────────

function onKey(ev) {
  // If any overlay is open, dismiss it on any key (except modifiers).
  if (state.helpOpen) {
    state.helpOpen = false;
    helpOverlay.classList.remove("open");
    if (ev.key !== "Escape") return;
  }

  switch (ev.key) {
    case "ArrowRight":
    case " ":
    case "PageDown":
      ev.preventDefault();
      next();
      break;
    case "ArrowLeft":
    case "PageUp":
      ev.preventDefault();
      prev();
      break;
    case "Home":
      ev.preventDefault();
      showSlide(0);
      break;
    case "End":
      ev.preventDefault();
      showSlide(slides.length - 1);
      break;
    case "?":
      ev.preventDefault();
      toggleHelp();
      break;
    case "S":
    case "s":
      toggleNotes();
      break;
    case "O":
    case "o":
      toggleOverview();
      break;
    case "F":
    case "f":
      toggleFullscreen();
      break;
    case "D":
    case "d":
      toggleDemo();
      break;
    case "Escape":
      if (state.demoOpen) toggleDemo();
      else if (state.overviewOpen) toggleOverview();
      else if (state.notesOpen) toggleNotes();
      break;
    case "R":
    case "r":
      resetActiveScene();
      break;
  }
}

document.addEventListener("keydown", onKey);

// ─── Fullscreen-scene toggle (per-slide) ─────────────────────────────
//
// Slides that opt in have a `<button data-fullscreen-scene>Toggle</button>`.
// Clicking it adds `.fullscreen-scene-active` to the slide so CSS overrides
// position the panels into a bottom bar.

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-fullscreen-scene]");
  if (!btn) return;
  const slide = btn.closest(".slide");
  slide?.classList.toggle("fullscreen-scene-active");
});

// ─── Boot ────────────────────────────────────────────────────────────

prepareCodeLines();
showSlide(0);

// ─── PER-DECK WIRING ─────────────────────────────────────────────────
//
// Add per-scene UI handlers below — slider input listeners, button
// click handlers, stat-tile updaters fed by `setOnChange` callbacks
// from the scene factories.
//
// See `references/scene-wiring.md` for the full integration contract.
//
// Example shape:
//
//   import { getScene } from "./scenes.js";
//   const myScene = getScene("my-scene");
//   if (myScene) {
//     myScene.setOnChange((state) => {
//       document.querySelector("#my-scene-counter").textContent = state.count;
//     });
//     document.querySelector("#my-scene-button")?.addEventListener("click", () => {
//       myScene.trigger();
//     });
//   }
