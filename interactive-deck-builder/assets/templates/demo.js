// demo.js — modal CLI / REPL playback simulator.
//
// Triggered by the `D` key (handled in presentation.js → toggleDemo).
// Shows a fake terminal that plays back scripted command + output sequences.
//
// THIS FILE IS THE FRAMEWORK + ONE PLACEHOLDER WALKTHROUGH. Author one
// walkthrough per scripted demo your deck wants. Each walkthrough is an
// array of "frames" — either a `{ say }` (narration text) or a
// `{ run, out, status }` (command + simulated output).
//
// To add a walkthrough:
//   1. Add an entry to the `WALKTHROUGHS` map below.
//   2. The framework auto-renders tabs / play / step / reset controls.

const WALKTHROUGHS = {
  // Replace this placeholder with your actual demos.
  example: {
    title: "Example walkthrough",
    frames: [
      { say: "Quick narration before the first command." },
      {
        run: "echo 'hello, world'",
        out: ["hello, world"],
        status: 0,
      },
      { say: "Then explain what just happened." },
      {
        run: "ls -la /tmp",
        out: [
          "total 0",
          "drwxrwxrwt  1 root root  0 Jan  1 00:00 .",
          "drwxr-xr-x  1 root root  0 Jan  1 00:00 ..",
        ],
        status: 0,
      },
      { say: "Wrap up the takeaway from this walkthrough." },
    ],
  },
};

// ─── DOM ─────────────────────────────────────────────────────────────

const overlay = document.getElementById("demo-overlay");
const modal = document.getElementById("demo-modal");

// ─── Modal renderer ──────────────────────────────────────────────────

function render() {
  if (!modal) return;
  const tabs = Object.keys(WALKTHROUGHS);
  modal.innerHTML = `
    <div class="demo-tabs">
      ${tabs
        .map(
          (k, i) => `
            <button data-tab="${k}" class="demo-tab ${i === 0 ? "active" : ""}">
              ${WALKTHROUGHS[k].title}
            </button>`,
        )
        .join("")}
    </div>
    <div class="demo-controls">
      <button data-act="step">Step</button>
      <button data-act="play">Play</button>
      <button data-act="pause">Pause</button>
      <button data-act="reset">Reset</button>
    </div>
    <div class="demo-terminal" id="demo-terminal"></div>
  `;
  loadTab(tabs[0]);
}

const state = {
  tab: null,
  index: 0,
  playing: false,
  timer: null,
};

function loadTab(name) {
  state.tab = name;
  state.index = 0;
  state.playing = false;
  clearTimeout(state.timer);
  modal.querySelectorAll(".demo-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  modal.querySelector("#demo-terminal").innerHTML = "";
}

function step() {
  if (!state.tab) return;
  const frames = WALKTHROUGHS[state.tab].frames;
  if (state.index >= frames.length) {
    state.playing = false;
    return;
  }
  const frame = frames[state.index];
  state.index++;

  const term = modal.querySelector("#demo-terminal");
  if (frame.say) {
    term.insertAdjacentHTML(
      "beforeend",
      `<div class="say">${escapeHtml(frame.say)}</div>`,
    );
  } else if (frame.run !== undefined) {
    const out = (frame.out || [])
      .map((l) => `<span class="out">${escapeHtml(l)}</span>`)
      .join("\n");
    const status = frame.status === 0 ? "ok" : "fail";
    term.insertAdjacentHTML(
      "beforeend",
      `<div class="frame ${status}">
         <span class="prompt">$</span>
         <span class="cmd">${escapeHtml(frame.run)}</span>
         ${out ? `\n${out}` : ""}
       </div>`,
    );
  }
  term.scrollTop = term.scrollHeight;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function play() {
  if (state.playing) return;
  state.playing = true;
  const tick = () => {
    if (!state.playing) return;
    step();
    if (state.index < WALKTHROUGHS[state.tab]?.frames.length) {
      state.timer = setTimeout(tick, 900);
    } else {
      state.playing = false;
    }
  };
  tick();
}

function pause() {
  state.playing = false;
  clearTimeout(state.timer);
}

// ─── Wire controls ───────────────────────────────────────────────────

if (modal) {
  render();
  modal.addEventListener("click", (ev) => {
    const tab = ev.target.closest(".demo-tab");
    if (tab) return loadTab(tab.dataset.tab);

    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "step") step();
    if (act === "play") play();
    if (act === "pause") pause();
    if (act === "reset") loadTab(state.tab);
  });
}
