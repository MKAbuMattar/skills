# Fullscreen-Game Pattern

Game slides default to a side-by-side split (left: text + controls, right: stats panel). When the user wants the 3D scene to take over, they click the corner toggle — the panels collapse into a single bottom bar and the scene fills the screen.

## The toggle button

Every game slide has this in its top-right corner:

```html
<button class="fs-toggle" data-fs-toggle>▶ Play full-screen</button>
```

When clicked, JS adds `.fullscreen-game` to the slide and changes the button label.

## The handler (in `presentation.js`)

```js
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-fs-toggle]");
  if (!btn) return;
  const slide = btn.closest(".slide");
  if (!slide) return;
  const isFs = slide.classList.toggle("fullscreen-game");
  btn.textContent = isFs ? "✕ Exit full-screen" : "▶ Play full-screen";
});

// Esc exits
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

// Auto-exit when navigating to another slide
function showSlide(idx) {
  document.querySelectorAll(".slide.fullscreen-game").forEach((s) => {
    s.classList.remove("fullscreen-game");
    const btn = s.querySelector("[data-fs-toggle]");
    if (btn) btn.textContent = "▶ Play full-screen";
  });
  /* ...rest of showSlide... */
}
```

## The CSS — non-trivial gotcha

Naïve fullscreen mode using `position: absolute` + flex causes the right panel to overflow the viewport because flex `flex: 1 1 auto` items don't shrink below their content's intrinsic width. **Use `position: fixed` + grid `minmax(0, ...)`** so panels can shrink:

```css
.fs-toggle {
  position: absolute;
  top: 30px;
  right: 130px;
  background: var(--bg-elev);
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 999px;
  cursor: pointer;
  z-index: 90;
  transition: all 0.2s;
}

.slide.fullscreen-game .content-wrap.split,
.slide.fullscreen-game .content-wrap {
  position: fixed; /* viewport-anchored, not slide-anchored */
  bottom: 22px;
  left: 22px;
  right: 22px;
  width: auto;
  max-width: none;
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr); /* shrinkable */
  gap: 14px;
  z-index: 60;
  pointer-events: none;
}
.slide.fullscreen-game .left,
.slide.fullscreen-game .right {
  pointer-events: auto;
  background: rgba(13, 13, 16, 0.82);
  backdrop-filter: blur(10px);
  border: 1px solid var(--fg-faint);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 0; /* CRITICAL — allows shrinking below intrinsic */
  overflow: hidden; /* CRITICAL — clips text that doesn't fit */
}

/* Hide narrative copy in fullscreen — keep only interactive controls */
.slide.fullscreen-game .left > .kicker,
.slide.fullscreen-game .left > .headline,
.slide.fullscreen-game .left > .subtitle,
.slide.fullscreen-game .race-legend,
.slide.fullscreen-game .ns-picker,
.slide.fullscreen-game .topology-info,
.slide.fullscreen-game .flow-stages {
  display: none;
}

.slide.fullscreen-game .game-controls {
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin: 0;
  flex-wrap: wrap;
}
.slide.fullscreen-game .stats-panel {
  background: transparent;
  border: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 10px;
  align-items: end;
}
.slide.fullscreen-game .stat {
  min-width: 0;
}
.slide.fullscreen-game .stat-label,
.slide.fullscreen-game .stat-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Race-clock (deploy-race, cold-start) collapses to horizontal too */
.slide.fullscreen-game .race-clock {
  background: transparent;
  border: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

/* Toast floats above the bar */
.slide.fullscreen-game .game-toast {
  position: fixed;
  bottom: 200px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 80vw;
  pointer-events: none;
}
```

## Per-game tweaks

A few games have non-standard panels and need extra overrides:

- **Density race / cold-start race** → `.race-clock` (vertical) → override to grid horizontal.
- **CVE Hunt** → `.tier-switcher` (vertical) → override to flex row, wrap.
- **Density Race** → `.mode-switcher` (3-button group) → override padding.
- **HPA Race / Traffic Wave** → `.load-control` (slider with track marks) → override to flex row, hide track marks.

All overrides are inside `.slide.fullscreen-game ...` selectors. See the bundled `styles.css` for the full block.

## Testing

Open every game slide and toggle fullscreen. The bottom bar must:

1. Stay within viewport horizontally on a 1280-wide screen.
2. Show all controls and at least 3 stats without ellipsis.
3. Allow the slider / buttons to remain clickable.
4. Exit cleanly on Esc, on toggle button click, and on slide change.
