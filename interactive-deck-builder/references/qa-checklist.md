# Pre-talk QA checklist

Walk this list before the session. The deck is half the artifact; the talk depends on the scenes working live.

## Visual

- [ ] Title slide loads with the scene rendering.
- [ ] Each section divider shows an aurora gradient in the **right** colour for that section.
- [ ] Section accent appears in: kicker text, progress-bar fill, code-block highlight border.
- [ ] Slide counter ticks correctly when navigating with arrows.
- [ ] No 5+ bullet lists.
- [ ] No `position: absolute` overflow on scene slides at 1366 × 768.

## Navigation

- [ ] `→` / `Space` advance.
- [ ] `←` / `PageUp` go back.
- [ ] `Home` jumps to slide 1.
- [ ] `End` jumps to last slide.
- [ ] `?` shows the help card; any key dismisses.
- [ ] `O` shows the overview grid; click a tile jumps there.
- [ ] `S` toggles speaker notes panel.
- [ ] `F` toggles browser fullscreen.
- [ ] `D` opens the demo modal (if present); `Esc` closes it.

## Build steps

- [ ] On code slides with `.highlight-lines`, each `→` highlights the next line before advancing.
- [ ] On layered slides (e.g., a tier list, a build-up explanation), `→` reveals each layer one at a time before advancing.
- [ ] Interactive button + bullet pairs reveal the next bullet when the button is clicked.

## Scenes (test each)

For every slide with `data-scene="..."`:

- [ ] Scene renders behind the slide content.
- [ ] Controls (buttons, sliders) are responsive.
- [ ] Stats update live as you interact.
- [ ] Toast / hint messages appear at threshold conditions and clear when state goes back to normal.
- [ ] **Fullscreen toggle button** works:
  - [ ] Click → panels collapse to bottom bar, button label flips to "Exit".
  - [ ] In fullscreen, all controls + stats remain on screen (no overflow).
  - [ ] `Esc` exits fullscreen.
  - [ ] Navigating away auto-exits fullscreen.
- [ ] Reset button restores initial state.

## Per-scene behaviour

For each interactive scene, verify the specific interactions:

- [ ] **Click-to-destroy scenes**: click removes the object; respawn fires within the documented timeout.
- [ ] **Slider-driven scaling**: slider changes the count; visual matches the number; thresholds trigger state changes (color shifts, toast notifications).
- [ ] **Sequenced "Run X"** scenes: the action button kicks off the sequence; subsequent presses don't double-trigger.
- [ ] **Wave / load generator**: starting the wave makes load oscillate; reactive component responds; counters update.
- [ ] **Migration on failure**: triggering the failure relocates affected items; restoring the failed host brings it back.
- [ ] **Color-shift slider**: 0-100 shifts spectrum; intermediate values produce intermediate colors.
- [ ] **Service routing**: traffic flows; rerouting works; killing a peripheral redistributes traffic.
- [ ] **Multi-stage flow**: requests step through every stage; the response path returns through the same stages.

## Demo simulator (if present)

- [ ] Open with `D`.
- [ ] Each tab loads a different walkthrough.
- [ ] Step button runs one command at a time.
- [ ] Play button auto-advances with ~900 ms gap.
- [ ] Reset clears the terminal.
- [ ] Pause works during play.

## Performance

- [ ] Frame rate stays > 30 fps on a laptop screen.
- [ ] Switching between two consecutive scene slides does not crash or leak memory.
- [ ] Particle / object pools are reused, not re-allocated each spawn.
- [ ] Scene `teardown()` disposes all geometries / materials / textures.

## Speaker prep

- [ ] `SPEAKER-GUIDE.md` is up to date — re-run `python3 scripts/extract-speaker-notes.py <deck-dir>` after any HTML change.
- [ ] Live-data slides match what the discovery script returns _today_ — re-run before the session if more than a week old.
- [ ] Resources slide links work (open each in a new tab).

## Topic-fit

- [ ] Each scene's metaphor genuinely illustrates the concept it's paired with. (If a scene is "cool but unrelated", cut it.)
- [ ] Section accent colors match the narrative beat (red = problem / alarm, green = fundamentals / safety, blue = scale / depth, etc.). Don't reuse the same color for two adjacent sections.
- [ ] The deck's level of formality matches the audience (sales pitch ≠ classroom lecture ≠ conference talk).
- [ ] Any data baked in is current, accurate, and free of leaks (no internal hostnames, real customer names, employee names, etc.).

## Topic-specific add-ons

If your topic has its own pre-flight requirements, append them. Examples:

- **Sales pitch**: pricing slide accuracy, customer logo permissions, NDA-protected names redacted.
- **Conference talk**: speaker bio, sponsor logos correct, session abstract matches what's actually in the deck.
- **Classroom lecture**: pre-class survey results loaded if used, exercise prompts ready, code samples runnable.
- **Product demo**: backing services up and reachable, dummy account credentials ready, feature flags set to demo-mode.
- **Scientific viz**: data sources cited, error bars / confidence intervals where appropriate, methodology slide present.
