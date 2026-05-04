# Slide Types

A deck has roughly 50 slides across 8–9 sections. Below are the templates for each slide type, copy-paste ready.

Every slide is `<section class="slide" data-section="..." data-color="...">`. Optional: `data-scene="..."` for a Three.js scene to render behind the slide.

## Title slide (1 per deck)

```html
<section
  class="slide title-slide"
  data-section="Opening"
  data-color="teal"
  data-scene="particles"
>
  <div class="title-wrap">
    <h1 class="mega">Topic<br /><span class="dim">Subtitle</span></h1>
    <p class="subtitle">One-line elevator description</p>
  </div>
  <div class="presenter-footer">
    Audience hint · Press <kbd>?</kbd> for help
  </div>
  <aside class="notes">
    Welcome the room. One line: this is a starting point, not a deep dive — by
    the end you'll know X, Y, and Z.
  </aside>
</section>
```

## Goals slide

```html
<section class="slide" data-section="Opening" data-color="teal">
  <div class="content-wrap">
    <p class="kicker">WHY WE'RE HERE</p>
    <h2 class="headline">Goals for today</h2>
    <ul class="bullets stagger">
      <li><strong>Takeaway 1</strong> — short reason</li>
      <li><strong>Takeaway 2</strong> — short reason</li>
      <li><strong>Takeaway 3</strong> — short reason</li>
    </ul>
  </div>
  <aside class="notes">
    Three takeaways. If you leave with these, this hour was worth it.
  </aside>
</section>
```

## Section divider

```html
<section
  class="slide divider-slide"
  data-section="The Problem"
  data-color="red"
  data-scene="aurora"
>
  <div class="divider-wrap">
    <p class="part">PART 1</p>
    <h2 class="headline">The pain we're solving</h2>
  </div>
  <aside class="notes">Setup transition for one beat.</aside>
</section>
```

## Big statement (max 1–2 per section)

```html
<section
  class="slide big-statement"
  data-section="The Problem"
  data-color="red"
>
  <div class="content-wrap">
    <p class="kicker">THE INSIGHT</p>
    <h2 class="mega-statement">Bold claim<br />in five words</h2>
    <p class="subtitle muted">Optional supporting line.</p>
  </div>
  <aside class="notes">
    This is the single most important slide of the section. Land it slowly.
  </aside>
</section>
```

## Statement slide

```html
<section class="slide" data-section="..." data-color="...">
  <div class="content-wrap">
    <p class="kicker">CATEGORY</p>
    <h2 class="headline">A specific point</h2>
    <p class="subtitle muted">One sentence of supporting detail.</p>
  </div>
  <aside class="notes">...</aside>
</section>
```

## Framework / list

```html
<section class="slide" data-section="..." data-color="...">
  <div class="content-wrap">
    <p class="kicker">CATEGORY</p>
    <h2 class="headline">When to use X</h2>
    <ul class="bullets stagger check">
      <li>Reason 1</li>
      <li>Reason 2</li>
      <li>Reason 3</li>
      <li>Reason 4</li>
    </ul>
  </div>
  <aside class="notes">...</aside>
</section>
```

Variants: `.bullets.cross` (red Xs), `.bullets.numbered` (auto-counter), `.bullets.split-list` (mixed do/don't with `.do` / `.dont` per item), `.bullets.recap` (one per section, color-coded with `<span class="recap-dot teal">`).

## Code slide

```html
<section class="slide" data-section="..." data-color="...">
  <div class="content-wrap">
    <p class="kicker">CATEGORY</p>
    <h2 class="headline">A YAML / Dockerfile / command</h2>
    <p class="subtitle muted">One-line context.</p>
    <pre class="code-block"><code class="language-yaml">apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3</code></pre>
  </div>
  <aside class="notes">Walk it line by line.</aside>
</section>
```

For per-line highlighting (click → next line lights up), add `highlight-lines` class:

```html
<pre
  class="code-block highlight-lines"
><code class="language-docker">FROM node:20.11-alpine
WORKDIR /app
COPY package.json package-lock.json ./</code></pre>
```

The slide controller in `presentation.js` splits lines and drives a `.line.active` highlight per click before advancing to the next slide.

## Game slide

```html
<section
  class="slide game-slide has-fullscreen"
  data-section="..."
  data-color="..."
  data-scene="self-healing"
>
  <button class="fs-toggle" data-fs-toggle>▶ Play full-screen</button>
  <div class="content-wrap split game-wrap">
    <div class="left">
      <p class="kicker">CATEGORY</p>
      <h2 class="headline">Title<br />(short)</h2>
      <p class="subtitle muted">One-line description.</p>
      <!-- legend / picker / slider -->
      <div class="game-controls">
        <button class="action-btn big" id="game-action">▶ Action</button>
        <button class="action-btn ghost" id="game-reset">↺ Reset</button>
      </div>
    </div>
    <div class="right">
      <div class="stats-panel">
        <div class="stat">
          <div class="stat-label">Metric</div>
          <div class="stat-value" id="game-metric">0</div>
        </div>
        <!-- 3-4 stats -->
      </div>
      <p class="game-toast" id="game-toast"></p>
    </div>
  </div>
  <aside class="notes">
    How to demo this — what to click, what to point at.
  </aside>
</section>
```

## Recap

```html
<section class="slide" data-section="Closing" data-color="teal">
  <div class="content-wrap">
    <h2 class="headline">Recap</h2>
    <ul class="bullets recap stagger">
      <li>
        <span class="recap-dot teal"></span><strong>The why</strong> — short
        reason
      </li>
      <li>
        <span class="recap-dot red"></span><strong>The how</strong> — short
        reason
      </li>
      <li>
        <span class="recap-dot green"></span><strong>The takeaway</strong> —
        short reason
      </li>
    </ul>
  </div>
  <aside class="notes">
    Read each line. The dot color matches the originating section.
  </aside>
</section>
```

## Q&A

```html
<section
  class="slide qa-slide"
  data-section="Closing"
  data-color="teal"
  data-scene="aurora-soft"
>
  <div class="content-wrap center">
    <h2 class="qa-text">Questions?</h2>
    <p class="qa-hint">Press <kbd>D</kbd> for the demo simulator</p>
  </div>
  <aside class="notes">
    Open the floor. Repeat each question before answering.
  </aside>
</section>
```

## Speaker notes

Every slide must have an `<aside class="notes">...</aside>`. The runtime panel (`S` key) reads from this element. The `extract-speaker-notes.py` script also reads it to generate `SPEAKER-GUIDE.md`.
