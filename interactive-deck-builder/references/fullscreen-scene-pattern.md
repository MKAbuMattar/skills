# Fullscreen-Scene Pattern

Scene slides default to a side-by-side split (left: text + controls, right: stats panel). When the user wants the 3D scene to take over, they click the corner toggle — the panels collapse into a single bottom bar and the scene fills the screen.

## The toggle button

Every scene slide has this in its top-right corner:

```html
<button class="fs-toggle" data-fs-toggle>▶ Play full-screen</button>
```

When clicked, JS adds `.fullscreen-scene` to the slide and changes the button label.

## The handler (in `presentation.js`)

```js
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-fs-toggle]");
  if (!btn) return;
  const slide = btn.closest(".slide");
  if (!slide) return;
  const isFs = slide.classList.toggle("fullscreen-scene");
  btn.textContent = isFs ? "✕ Exit full-screen" : "▶ Play full-screen";
});

// Esc exits
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const fs = document.querySelector(".slide.fullscreen-scene");
    if (fs) {
      fs.classList.remove("fullscreen-scene");
      const btn = fs.querySelector("[data-fs-toggle]");
      if (btn) btn.textContent = "▶ Play full-screen";
    }
  }
});

// Auto-exit when navigating to another slide
function showSlide(idx) {
  document.querySelectorAll(".slide.fullscreen-scene").forEach((s) => {
    s.classList.remove("fullscreen-scene");
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

.slide.fullscreen-scene .content-wrap.split,
.slide.fullscreen-scene .content-wrap {
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
.slide.fullscreen-scene .left,
.slide.fullscreen-scene .right {
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
.slide.fullscreen-scene .left > .kicker,
.slide.fullscreen-scene .left > .headline,
.slide.fullscreen-scene .left > .subtitle {
  display: none;
}

.slide.fullscreen-scene .scene-controls {
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin: 0;
  flex-wrap: wrap;
}
.slide.fullscreen-scene .stats-panel {
  background: transparent;
  border: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 10px;
  align-items: end;
}
.slide.fullscreen-scene .stat {
  min-width: 0;
}
.slide.fullscreen-scene .stat-label,
.slide.fullscreen-scene .stat-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Toast floats above the bar */
.slide.fullscreen-scene .scene-toast {
  position: fixed;
  bottom: 200px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 80vw;
  pointer-events: none;
}
```

## Per-scene tweaks

If a scene has non-standard panels (vertical clocks, multi-row legends, big sliders with track marks), add per-scene overrides inside `.slide.fullscreen-scene[data-scene="<name>"] ...` selectors so they only apply to that scene.

Common cases:

- **Race-style scenes** (vertical stopwatch panel) → override to a horizontal grid.
- **Multi-tier legend** → override to a flex row that wraps.
- **Slider with track marks** → hide the marks, shrink the track height.

All overrides go inside `.slide.fullscreen-scene ...` selectors so they only apply when the slide is in fullscreen mode.

## Testing

Open every scene slide and toggle fullscreen. The bottom bar must:

1. Stay within viewport horizontally on a 1280-wide screen.
2. Show all controls and at least 3 stats without ellipsis.
3. Allow the slider / buttons to remain clickable.
4. Exit cleanly on Esc, on toggle button click, and on slide change.
