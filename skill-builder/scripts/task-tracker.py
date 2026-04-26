#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""task-tracker.py — Claude Code UserPromptSubmit hook.

Records every user prompt to a rolling history file. When the current prompt
is "similar enough" to N-1 previous prompts (default N=3), it emits a
system-reminder that suggests using the `skill-builder` skill to capture the
recurring task as a reusable Agent Skill.

Wiring (in ~/.claude/settings.json):

    {
      "hooks": {
        "UserPromptSubmit": [{
          "hooks": [{
            "type": "command",
            "command": "python3 /abs/path/to/skill-builder/scripts/task-tracker.py"
          }]
        }]
      }
    }

Or run `bash skill-builder/scripts/install-hook.sh` to do this automatically.

Tuning via environment variables (optional):
  TASK_TRACKER_REPEATS    Threshold count (default: 3).
  TASK_TRACKER_THRESHOLD  Overlap-coefficient threshold (default: 0.3, range 0-1).
  TASK_TRACKER_WINDOW     Days of history to consider (default: 30).
  TASK_TRACKER_HISTORY    History file path (default: ~/.claude/skill-builder-history.jsonl).
  TASK_TRACKER_DEBUG      Set to "1" to log to ~/.claude/skill-builder-debug.log.

Stdlib-only — no install step.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

DEFAULT_HISTORY = Path.home() / ".claude" / "skill-builder-history.jsonl"
DEFAULT_REPEATS = 3
DEFAULT_THRESHOLD = 0.3
DEFAULT_WINDOW_DAYS = 30
COOLDOWN_SECONDS = 30 * 60   # don't re-suggest the same cluster within 30 min
MAX_HISTORY_LINES = 5000     # rotate file when it gets too big

STOPWORDS = frozenset(
    """
    a about after all also am an and any are as at be because been before being but
    by can do does did doing done dont each else few for from get got had has have
    having he her here him his how i if in into is it its just like make made may
    me might more most much my need needs new no none not now of off on once only or
    other our out over own please same say see she should so some still such than
    that the their them then there these they this those through to too try under
    up us use used using very want wants was we were what when where which while who
    why will with would yet you your okay ok bro hi hello thanks please write build
    create make give show tell help skill task script tool one two three four five
    six seven eight nine ten
    """.split()
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def debug(msg: str) -> None:
    if os.environ.get("TASK_TRACKER_DEBUG") == "1":
        log = Path.home() / ".claude" / "skill-builder-debug.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        with log.open("a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")


def stem(token: str) -> str:
    """Cheap suffix stripping. Catches plurals and -ing/-ed verb forms."""
    for suffix in ("ies", "ing", "ed", "es", "s"):
        if len(token) > len(suffix) + 2 and token.endswith(suffix):
            return token[: -len(suffix)]
    return token


def tokenize(text: str) -> set[str]:
    """Lowercase → drop punctuation → split → drop stopwords/short → stem."""
    if not text:
        return set()
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return {
        stem(t) for t in cleaned.split()
        if t not in STOPWORDS and len(t) > 2
    }


def overlap_coef(a: set[str], b: set[str]) -> float:
    """|A ∩ B| / min(|A|, |B|). 1.0 means one is a subset of the other."""
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def load_history(path: Path, window_days: int) -> list[dict]:
    if not path.exists():
        return []
    cutoff = time.time() - window_days * 86400
    entries: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("ts", 0) >= cutoff:
            entries.append(e)
    return entries


def append_history(path: Path, entry: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    # Rotate if file is huge
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
        if len(lines) > MAX_HISTORY_LINES:
            keep = lines[-MAX_HISTORY_LINES:]
            path.write_text("\n".join(keep) + "\n", encoding="utf-8")
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    # Read hook input. Claude Code passes JSON on stdin for UserPromptSubmit.
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        debug("malformed stdin, exiting silently")
        return 0

    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return 0

    repeats = env_int("TASK_TRACKER_REPEATS", DEFAULT_REPEATS)
    threshold = env_float("TASK_TRACKER_THRESHOLD", DEFAULT_THRESHOLD)
    window_days = env_int("TASK_TRACKER_WINDOW", DEFAULT_WINDOW_DAYS)
    history_path = Path(os.environ.get("TASK_TRACKER_HISTORY", str(DEFAULT_HISTORY)))

    current_tokens = tokenize(prompt)
    if len(current_tokens) < 3:
        # Too short to compare meaningfully — record and skip
        append_history(history_path, {"ts": time.time(), "prompt": prompt, "tokens": []})
        return 0

    past = load_history(history_path, window_days)

    similar: list[dict] = []
    for e in past:
        toks = set(e.get("tokens") or []) or tokenize(e.get("prompt", ""))
        if overlap_coef(current_tokens, toks) >= threshold:
            similar.append(e)

    # Always record the current prompt (even before deciding)
    append_history(history_path, {
        "ts": time.time(),
        "prompt": prompt,
        "tokens": sorted(current_tokens),
    })

    debug(f"prompt={prompt!r} tokens={len(current_tokens)} similar={len(similar)} threshold={threshold}")

    # We need at least (repeats - 1) similar past prompts; current makes it 'repeats'.
    if len(similar) < repeats - 1:
        return 0

    # Cooldown: if we already alerted within the last COOLDOWN_SECONDS for a
    # similar cluster, stay quiet so we don't nag.
    last_alert_ts = max((e.get("alerted_ts", 0) for e in similar), default=0)
    if last_alert_ts and (time.time() - last_alert_ts) < COOLDOWN_SECONDS:
        debug("cooldown active, skipping alert")
        return 0

    # Mark this prompt as the alert anchor so future similar prompts know
    append_history(history_path, {
        "ts": time.time(),
        "alerted_ts": time.time(),
        "prompt": prompt,
        "tokens": sorted(current_tokens),
        "marker": "alert",
    })

    # Pick the top shared tokens to suggest as a skill-name seed.
    shared_counts: dict[str, int] = {}
    for e in similar:
        toks = set(e.get("tokens") or []) or tokenize(e.get("prompt", ""))
        for t in toks & current_tokens:
            shared_counts[t] = shared_counts.get(t, 0) + 1
    top_tokens = sorted(shared_counts, key=lambda t: (-shared_counts[t], t))[:4]
    seed = "-".join(top_tokens) if top_tokens else "this-task"

    # UserPromptSubmit hook stdout is added to Claude's context as an
    # additional system-reminder before Claude responds.
    print(
        "<system-reminder>\n"
        f"The user has now asked a similar task {len(similar) + 1} times "
        f"(threshold: {repeats}). This is a strong signal that the task is "
        f"reusable and worth packaging.\n\n"
        f"Recommend the user use the `skill-builder` skill to capture this as "
        f"a reusable Agent Skill. Suggested name seed (kebab-case): `{seed}`. "
        f"Concretely, propose:\n\n"
        f"  bash skill-builder/scripts/new-skill.sh <skill-name> "
        f"\"<one-line imperative description with casual phrasings>\"\n\n"
        f"Then offer to fill in the SKILL.md body, references/, and any "
        f"templates based on the recurring patterns from the prior turns. "
        f"Do not auto-create the skill — confirm with the user first. If they "
        f"decline, drop the suggestion and proceed with the immediate task.\n"
        "</system-reminder>"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # never crash the hook chain
        debug(f"unexpected error: {e!r}")
        sys.exit(0)
