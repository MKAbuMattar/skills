# Data sources

Patterns for baking real data into the deck — CSV, JSON, REST API, SQL, kubectl, file scan, spreadsheet, log scrape, anything. The framework is topic-agnostic; the data source you pick matches your topic.

## Why bake in real data

A sales pitch reading "we have many customers" lands differently than "we have 4,217 customers, 38 of whom are Fortune-500". A lecture saying "the experiment had clear results" lands differently than "the effect held in 17 of 18 trials, p < 0.003". Real numbers grant the deck credibility before the audience reads anything else.

The pattern: discover the numbers BEFORE authoring slides. Run a discovery script, capture the output, paste the values directly into HTML or load them at deck-build time.

## The four discovery patterns

Pick the pattern that fits your data source.

### 1. CLI-tool discovery (kubectl, psql, redis-cli, git, custom CLIs)

For data accessible via command-line tools. The discovery script runs read-only commands and emits values you paste into the deck.

Preset scripts ship in `scripts/discover/`:

- `kubectl.sh` — Kubernetes cluster facts (nodes, pods, namespaces, HPAs, storage classes).
- `git-stats.sh` — repository facts (commits, contributors, files, languages).
- `npm-deps.sh` — dependency tree facts (count, top-level vs transitive, vulnerabilities).

Pattern for a custom CLI discovery:

```bash
#!/usr/bin/env bash
# scripts/discover/<my-tool>.sh
set -euo pipefail

echo "=== <topic> facts ==="
echo "metric_a: $(<my-tool> count items)"
echo "metric_b: $(<my-tool> list types | wc -l)"
echo "metric_c: $(<my-tool> describe foo | head -1)"
```

Run, pipe the output to a file, paste the numbers into `index.html`.

### 2. Structured-file discovery (CSV / JSON / TOML / YAML)

For data sitting in a flat file. Either parse at deck-build time or load at runtime in the browser.

#### Build-time (Python / Node / shell)

```bash
# scripts/discover/csv.sh
python3 -c "
import csv, sys
with open('$1') as f:
    rows = list(csv.DictReader(f))
print(f'rows: {len(rows)}')
print(f'unique_categories: {len(set(r[\"category\"] for r in rows))}')
"
```

Then bake the output values into HTML directly.

#### Runtime (in the browser)

For decks where the data is the subject — let JavaScript fetch the file and update DOM tiles:

```javascript
// presentation.js
async function loadData() {
  const r = await fetch("./data/dataset.csv");
  const text = await r.text();
  const rows = text
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.split(","));
  document.querySelector("#tile-rows").textContent = rows.length;
  document.querySelector("#tile-mean").textContent = (
    rows.reduce((s, r) => s + Number(r[2]), 0) / rows.length
  ).toFixed(2);
}
```

Place the file in `data/` next to the deck. The deck stays self-contained.

### 3. REST-API discovery

For data behind an HTTP endpoint.

#### Build-time

```bash
# scripts/discover/api.sh
set -euo pipefail
API_URL="${1:-https://api.example.com/stats}"
curl -fsSL "$API_URL" | jq '{
  total: .total,
  active: (.users | map(select(.active)) | length),
  countries: (.users | map(.country) | unique | length)
}'
```

Bake the output into the deck.

#### Runtime

```javascript
async function loadStats() {
  const r = await fetch("https://api.example.com/stats");
  const data = await r.json();
  // populate tiles
}
```

CORS caveat: runtime fetches need the API to allow your origin (`localhost:8765` during dev). Build-time fetches don't.

### 4. SQL discovery

For data in a database.

```bash
# scripts/discover/sql.sh
set -euo pipefail
psql -t -A -c "SELECT count(*) FROM users WHERE created_at > now() - interval '30 days'"
psql -t -A -c "SELECT count(distinct country) FROM users"
psql -t -A -c "SELECT avg(session_duration_seconds)::int FROM events"
```

Or use the database vendor's CLI (`mysql -e`, `sqlite3`, `redis-cli`, `mongosh --quiet --eval`).

Pipe to a `.txt` file. Paste the numbers into HTML.

## What to bake in

A deck section called "Your <subject> in numbers" works for any topic. Concrete examples:

| Topic               | Data source    | Tile examples                                        |
| ------------------- | -------------- | ---------------------------------------------------- |
| Sales pitch         | CRM API / SQL  | active customers, MRR, churn %, NPS, top countries   |
| Conference talk     | GitHub / npm   | repo stars, contributors, npm weekly downloads       |
| Classroom lecture   | survey CSV     | response count, mean / median, std dev, top response |
| Product demo        | analytics API  | DAU, retention curve, top feature usage              |
| Scientific viz      | experiment CSV | sample size, effect size, p-value, replication count |
| System architecture | kubectl / DB   | nodes, pods, namespaces, query throughput            |
| Open-source project | GitHub API     | stars / forks / contributors / monthly issues        |
| Story telling / art | curated facts  | dates, distances, counts grounded in the narrative   |

## How to display

Use the `dash-tile` pattern from the templates:

```html
<div class="dash-grid">
  <div class="dash-tile">
    <div class="dash-num">4,217</div>
    <div class="dash-label">customers</div>
    <div class="dash-sub">active in last 30 days</div>
  </div>
  <div class="dash-tile">
    <div class="dash-num">38</div>
    <div class="dash-label">Fortune-500</div>
    <div class="dash-sub">enterprise tier</div>
  </div>
  <!-- ... -->
</div>
```

The CSS in `styles.css` handles grid layout and accent-colored borders.

## Freshness

Data ages. Re-run the discovery script before any presentation. For a deck given more than once:

- Add a `Discovered: <date>` footer on each data-tile slide.
- Bake the date into the deck via the discovery script.
- Schedule a re-discovery run before each delivery (cron, calendar reminder, or a `make refresh` target).

## Anti-patterns

- **Hand-typing numbers without a discovery script.** They go stale silently. Always have a script that produces them.
- **Real numbers that are too specific.** "92 pods" reveals your actual environment in a way that looks like fingerprinting (see `generic-by-design` skill). For decks meant to be reused / shared, round to obviously-synthetic shapes (`~100 pods`) or replace with placeholders.
- **Relying on runtime fetches without offline fallback.** If the API is down during your talk, your deck falls back to "Loading…". Cache the values in HTML; refresh at deck-build time.
- **Mixing freshness windows across tiles.** If "active customers" is from yesterday and "MRR" is from last quarter, audiences notice. Run all discoveries together and date-stamp the section.
- **Discovery scripts that write to production.** Read-only ops only. Never `kubectl delete`, `DROP TABLE`, `git push`, etc. inside a discovery script.
