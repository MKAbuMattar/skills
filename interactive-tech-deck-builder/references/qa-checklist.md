# Pre-Talk QA Checklist

Walk this list before the session. The deck is half the artifact; the talk depends on the games working live.

## Visual

- [ ] Title slide loads with the particle field rendering.
- [ ] Each section divider (slides 4, 8, 12, 16, …) shows an aurora gradient in the **right** colour for that section.
- [ ] Section accent appears in: kicker text, progress-bar fill, code-block highlight border.
- [ ] Slide counter ticks correctly when navigating with arrows.
- [ ] No 5+ bullet lists.
- [ ] No `position: absolute` overflow on game slides at 1366 × 768.

## Navigation

- [ ] `→` / `Space` advance.
- [ ] `←` / `PageUp` go back.
- [ ] `Home` jumps to slide 1.
- [ ] `End` jumps to last slide.
- [ ] `?` shows the help card; any key dismisses.
- [ ] `O` shows the overview grid; click a tile jumps there.
- [ ] `S` toggles speaker notes panel.
- [ ] `F` toggles browser fullscreen.
- [ ] `D` opens the demo modal; `Esc` closes it.

## Build steps

- [ ] On code slides with `.highlight-lines`, each `→` highlights the next line before advancing.
- [ ] On the security tier slide, `→` reveals tiers one at a time before advancing.
- [ ] On the image-vs-container slide, the "Spawn container" button creates a new container in 3D AND reveals the next bullet.

## Games (test each)

For every slide with `data-scene="..."`:

- [ ] Scene renders behind the slide content.
- [ ] Controls (buttons, sliders) are responsive.
- [ ] Stats update live as you interact.
- [ ] Toast messages appear at threshold conditions and clear when state goes back to normal.
- [ ] **Fullscreen toggle button** works:
  - [ ] Click → panels collapse to bottom bar, button label flips to "Exit".
  - [ ] In fullscreen, all controls + stats remain on screen (no overflow).
  - [ ] `Esc` exits fullscreen.
  - [ ] Navigating away auto-exits fullscreen.
- [ ] Reset button restores initial state.

## Game-specific

- [ ] **self-healing**: clicking a pod kills it; new pod spawns within ~1.2 s.
- [ ] **pod-scaling**: slider drives pod count; CPU% colour shifts green → amber → rose.
- [ ] **rolling-deploy**: clicking "Deploy v2" replaces all 4 pods one at a time without going below 4 alive.
- [ ] **traffic-wave**: starting the wave makes load oscillate; HPA reacts; dropped count stays 0 once HPA catches up.
- [ ] **chaos**: killing a node arcs all 6 pods to the surviving node; restore button brings the dead node back.
- [ ] **canary**: slider 0 → 100 shifts pod colours red → green; particles colour-match per request.
- [ ] **service-routing**: add/remove pods rebalances traffic; killing a pod kicks off a respawn after ~1.1 s.
- [ ] **edge-to-pod**: "Send request" sends one particle through 6 stages and back. "DDoS" sends 50 hostile requests; ~85% blocked at the CDN/edge stage. Particles **actually reach the pods** (this was a real bug — confirm fix).
- [ ] **deploy-race**: race finishes with K8s first, Docker second, Manual still going. Clock matches the lane positions.
- [ ] **cluster-topology** (k8s only): namespace picker filters — all visible pods dim except the selected namespace's.

## Demo simulator

- [ ] Open with `D`.
- [ ] Each tab loads a different walkthrough.
- [ ] Step button runs one command at a time.
- [ ] Play button auto-advances with ~900 ms gap.
- [ ] Reset clears the terminal.
- [ ] Pause works during play.

## Performance

- [ ] Frame rate stays > 30 fps on a laptop screen.
- [ ] Switching between two consecutive game slides does not crash or leak memory.
- [ ] Particle pools are reused, not re-allocated each spawn.

## Speaker prep

- [ ] `SPEAKER-GUIDE.md` is up to date — re-run `python3 scripts/extract-speaker-notes.py <deck-dir>` after any HTML change.
- [ ] Live-data slides match what `kubectl get` returns *today* — re-discover before the session if more than a week old.
- [ ] Resources slide links work (open each in a new tab).
