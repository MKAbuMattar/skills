#!/usr/bin/env bash
#
# new-deck.sh — Scaffold a new deck folder by copying the framework templates.
#
# Usage:
#     new-deck.sh <topic-name>
#         creates ./<topic-name>-presentation/ with the framework files,
#         a starter index.html, README, OUTLINE skeleton, and code-examples/.

set -euo pipefail

if [ -t 1 ]; then
    GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
    GREEN=''; YELLOW=''; NC=''
fi

if [ $# -ne 1 ]; then
    echo "usage: $0 <topic-name>" >&2
    echo "       e.g. $0 terraform-fundamentals" >&2
    exit 2
fi

TOPIC="$1"
DECK_DIR="${TOPIC}-presentation"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES="${SCRIPT_DIR}/../assets/templates"

if [ -d "$DECK_DIR" ]; then
    echo "error: $DECK_DIR already exists" >&2
    exit 1
fi

mkdir -p "$DECK_DIR/code-examples" "$DECK_DIR/assets" "$DECK_DIR/slides"

# Copy framework files
cp "${TEMPLATES}/styles.css"       "${DECK_DIR}/styles.css"
cp "${TEMPLATES}/presentation.js"  "${DECK_DIR}/presentation.js"
cp "${TEMPLATES}/scenes.js"        "${DECK_DIR}/scenes.js"
cp "${TEMPLATES}/demo.js"          "${DECK_DIR}/demo.js"
cp "${TEMPLATES}/index.html" "${DECK_DIR}/index.html"

# Minimal README
cat > "${DECK_DIR}/README.md" <<EOF
# ${TOPIC} — Presentation

Run with:

    python3 -m http.server 8765

then open http://localhost:8765/${DECK_DIR}/

Press \`?\` in the deck for keyboard help.

## Files

| File | Purpose |
|------|---------|
| index.html       | Deck — slides as <section> elements |
| styles.css       | Design system (shared across all decks) |
| presentation.js  | Slide controller, builds, keyboard nav |
| scenes.js        | Three.js scenes — registered by data-scene name |
| demo.js          | kubectl/CLI demo simulator |
| code-examples/   | YAML, Dockerfiles, etc. used on slides |
| OUTLINE.md       | Section-by-section structural map |
| SPEAKER-GUIDE.md | Per-slide talking points (auto-generated) |
EOF

# Empty OUTLINE skeleton
cat > "${DECK_DIR}/OUTLINE.md" <<EOF
# ${TOPIC} — Outline

## Sections

1. Opening (teal)
2. The Problem (red)
3. When to Use (purple)
4. Why We Need It (amber)
5. Fundamentals (green)
6. Security / Scaling (blue)
7. Our Cloud (cyan)
8. Your Cluster · Live (rose)
9. Closing (teal)
EOF

printf "${GREEN}✓${NC} created ${DECK_DIR}/\n"
printf "${YELLOW}next${NC}: edit ${DECK_DIR}/index.html, then\n"
printf "        cd ${DECK_DIR%/*}\n"
printf "        python3 -m http.server 8765\n"
