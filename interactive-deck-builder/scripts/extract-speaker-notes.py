#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Extract <aside class="notes"> blocks from a deck's index.html and write a
SPEAKER-GUIDE.md alongside it.

Usage:
    python3 extract-speaker-notes.py <deck-dir>

Where <deck-dir> contains index.html. Output is written to
<deck-dir>/SPEAKER-GUIDE.md.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


HEADLINE_PROBES = [
    ("h1", "mega"),
    ("h2", "mega-statement"),
    ("h2", "headline"),
    ("h2", "qa-text"),
    ("h2", "flow-headline"),
]


def _strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _extract_first(html: str, tag: str, cls: str) -> str | None:
    m = re.search(
        rf'<{tag}[^>]*class="[^"]*\b{re.escape(cls)}\b[^"]*"[^>]*>(.*?)</{tag}>',
        html,
        re.DOTALL,
    )
    return _strip_tags(m.group(1)) if m else None


def _extract_notes(slide_html: str) -> str:
    m = re.search(r'<aside class="notes">(.*?)</aside>', slide_html, re.DOTALL)
    return _strip_tags(m.group(1)) if m else ""


def _extract_headline(slide_html: str) -> str:
    for tag, cls in HEADLINE_PROBES:
        h = _extract_first(slide_html, tag, cls)
        if h:
            return h
    return ""


def parse_deck(index_path: Path) -> list[dict]:
    html = index_path.read_text()
    slides = re.findall(
        r'<section class="slide[^"]*"[^>]*>(?:.*?)</section>', html, re.DOTALL
    )
    out = []
    for i, s in enumerate(slides, start=1):
        opening = re.search(r"<section[^>]*>", s)
        opening_str = opening.group(0) if opening else ""

        def _attr(name: str) -> str:
            m = re.search(rf'{name}="([^"]*)"', opening_str)
            return m.group(1) if m else ""

        out.append(
            {
                "n": i,
                "section": _attr("data-section"),
                "color": _attr("data-color"),
                "scene": _attr("data-scene"),
                "kicker": _extract_first(s, "p", "kicker") or _extract_first(s, "p", "part"),
                "headline": _extract_headline(s),
                "subtitle": _extract_first(s, "p", "subtitle"),
                "notes": _extract_notes(s),
            }
        )
    return out


def write_guide(slides: list[dict], deck_title: str, out_path: Path) -> None:
    lines: list[str] = [f"# {deck_title} — Speaker Guide", ""]
    lines.append(
        f"Per-slide talking points for {len(slides)} slides. "
        "Press <kbd>S</kbd> in the deck to toggle the same notes inline."
    )
    lines.append("")

    current_section = None
    for s in slides:
        if s["section"] != current_section:
            current_section = s["section"]
            lines.extend(["", f"## {current_section}", ""])

        title = s["headline"] or s["kicker"] or "(divider)"
        scene_tag = f' · _interactive: `{s["scene"]}`_' if s["scene"] else ""
        lines.append(f'### Slide {s["n"]} — {title}{scene_tag}')

        if s["kicker"] and s["headline"] and s["kicker"] != s["headline"]:
            lines.append(f'_{s["kicker"]}_')
        if s["subtitle"]:
            lines.append(f'> {s["subtitle"]}')
        lines.append("")

        if s["notes"]:
            lines.append(f'**Say:** {s["notes"]}')
        else:
            lines.append("**Say:** _(no notes — improvise from the slide)_")
        lines.append("")

    out_path.write_text("\n".join(lines))


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    deck_dir = Path(sys.argv[1]).resolve()
    index = deck_dir / "index.html"
    if not index.exists():
        print(f"error: {index} not found", file=sys.stderr)
        return 1

    slides = parse_deck(index)
    title = deck_dir.name.replace("-presentation", "").replace("-", " ").title()
    out = deck_dir / "SPEAKER-GUIDE.md"
    write_guide(slides, title, out)
    print(f"Wrote {out} — {len(slides)} slides")
    return 0


if __name__ == "__main__":
    sys.exit(main())
