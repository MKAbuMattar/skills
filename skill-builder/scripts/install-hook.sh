#!/usr/bin/env bash
#
# install-hook.sh — Install the task-tracker.py UserPromptSubmit hook into
# Claude Code's settings.json. Idempotent: re-running upgrades the path and
# leaves any other hooks intact.
#
# Usage:
#     bash scripts/install-hook.sh                    # install to ~/.claude/settings.json
#     bash scripts/install-hook.sh --project          # install to ./.claude/settings.local.json
#     bash scripts/install-hook.sh --uninstall        # remove the hook
#     bash scripts/install-hook.sh --dry-run          # show what would change
#     bash scripts/install-hook.sh -h
#
# Requires: bash 4.0+, python3 (for safe JSON merge).
# Cross-platform: Linux, macOS, Windows (Git Bash / WSL / MSYS2).

set -euo pipefail

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
readonly RED GREEN YELLOW BLUE NC

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_SCRIPT_PATH="$SCRIPT_DIR/task-tracker.py"
SCRIPT_NAME="$(basename "$0")"
MARKER="task-tracker.py"   # used to find existing entries on re-install

SCOPE="user"
ACTION="install"
DRY_RUN=false

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

Install the task-tracker UserPromptSubmit hook into Claude Code settings.

OPTIONS:
    -h, --help        Show this help and exit
    --project         Install to ./.claude/settings.local.json (project scope).
                      NOT RECOMMENDED — Claude Code rewrites settings.local.json
                      on every permission auto-grant and current versions can
                      strip the hooks block. Use the default (user scope) unless
                      you know what you're doing.
    --uninstall       Remove the hook
    --dry-run         Show the resulting JSON without writing it
    --history <path>  Override the history file the hook writes to
    --repeats <n>     Override the repeat threshold (default 3)

What it does:
    Adds a UserPromptSubmit hook that runs:
        python3 $HOOK_SCRIPT_PATH
    Existing hooks are preserved. The script is idempotent — running again
    upgrades any prior installation rather than duplicating it.

EXIT CODES:
    0   Success
    1   Generic error
    2   Bad arguments / python3 not found
EOF
    exit "${1:-0}"
}

err()  { echo -e "${RED}\xe2\x9c\x97${NC} $*" >&2; }
info() { echo -e "${BLUE}\xe2\x84\xb9${NC} $*"; }
ok()   { echo -e "${GREEN}\xe2\x9c\x93${NC} $*"; }
warn() { echo -e "${YELLOW}\xe2\x9a\xa0${NC} $*" >&2; }

main() {
    local override_history="" override_repeats=""
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -h|--help)     usage 0 ;;
            --project)     SCOPE="project"; shift ;;
            --uninstall)   ACTION="uninstall"; shift ;;
            --dry-run)     DRY_RUN=true; shift ;;
            --history)     override_history="${2:?}"; shift 2 ;;
            --repeats)     override_repeats="${2:?}"; shift 2 ;;
            *)             err "Unknown option: $1"; usage 2 ;;
        esac
    done

    command -v python3 >/dev/null 2>&1 || { err "python3 not found in PATH"; exit 2; }
    [ -f "$HOOK_SCRIPT_PATH" ] || { err "Hook script not found: $HOOK_SCRIPT_PATH"; exit 1; }

    # Resolve target settings file
    local settings_file
    if [ "$SCOPE" = "project" ]; then
        settings_file="$(pwd)/.claude/settings.local.json"
        warn "Project scope installs into settings.local.json, which Claude Code"
        warn "rewrites on every permission auto-grant. Current versions may strip"
        warn "the hooks block, leaving you with no working hook silently."
        warn "Recommended: re-run without --project to install into ~/.claude/settings.json"
        warn "(see references/hooks.md \"Gotcha: project-scope hook erased ...\")."
    else
        settings_file="$HOME/.claude/settings.json"
    fi

    info "Settings file:  $settings_file"
    info "Hook script:    $HOOK_SCRIPT_PATH"
    info "Action:         $ACTION"

    # Build the python merge program. Pass paths via env so we don't have to
    # escape them through bash → python.
    HOOK_SCRIPT_PATH="$HOOK_SCRIPT_PATH" \
    SETTINGS_FILE="$settings_file" \
    HOOK_MARKER="$MARKER" \
    HOOK_ACTION="$ACTION" \
    HOOK_DRY_RUN="$DRY_RUN" \
    OVERRIDE_HISTORY="$override_history" \
    OVERRIDE_REPEATS="$override_repeats" \
    python3 - <<'PY'
import json
import os
import shlex
import shutil
import sys
from pathlib import Path

settings_file = Path(os.environ["SETTINGS_FILE"])
hook_script   = os.environ["HOOK_SCRIPT_PATH"]
marker        = os.environ["HOOK_MARKER"]
action        = os.environ["HOOK_ACTION"]
dry_run       = os.environ.get("HOOK_DRY_RUN") == "true"
override_hist = os.environ.get("OVERRIDE_HISTORY", "")
override_rep  = os.environ.get("OVERRIDE_REPEATS", "")

# Build the command. Use python3 explicitly so the hook works regardless of
# the script's executable bit / shebang resolution.
env_prefix = ""
if override_hist:
    env_prefix += f"TASK_TRACKER_HISTORY={shlex.quote(override_hist)} "
if override_rep:
    env_prefix += f"TASK_TRACKER_REPEATS={shlex.quote(override_rep)} "

command = f"{env_prefix}python3 {shlex.quote(hook_script)}".strip()

# Load (or initialize) settings.json
if settings_file.exists():
    try:
        settings = json.loads(settings_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"✗ Could not parse {settings_file}: {e}", file=sys.stderr)
        sys.exit(1)
else:
    settings = {}

settings.setdefault("hooks", {})
settings["hooks"].setdefault("UserPromptSubmit", [])
ups = settings["hooks"]["UserPromptSubmit"]

def is_our_hook(h):
    return isinstance(h, dict) and h.get("type") == "command" and marker in (h.get("command") or "")

# Strip any prior copies (idempotency)
removed = 0
for group in list(ups):
    if not isinstance(group, dict):
        continue
    inner = group.get("hooks", []) or []
    kept = [h for h in inner if not is_our_hook(h)]
    removed += len(inner) - len(kept)
    if kept:
        group["hooks"] = kept
    else:
        ups.remove(group)

if action == "install":
    ups.append({
        "hooks": [
            {"type": "command", "command": command}
        ]
    })

# If UserPromptSubmit ended up empty, prune it (keeps the file tidy).
if not settings["hooks"]["UserPromptSubmit"]:
    settings["hooks"].pop("UserPromptSubmit", None)
if not settings["hooks"]:
    settings.pop("hooks", None)

new_text = json.dumps(settings, indent=2) + "\n"

if dry_run:
    print("\n--- merged settings (dry-run, not written) ---")
    print(new_text)
    sys.exit(0)

# Backup existing
if settings_file.exists():
    backup = settings_file.with_suffix(settings_file.suffix + ".bak")
    shutil.copy2(settings_file, backup)
    print(f"✓ Backed up existing settings to {backup}")

settings_file.parent.mkdir(parents=True, exist_ok=True)
tmp = settings_file.with_suffix(settings_file.suffix + ".tmp")
tmp.write_text(new_text, encoding="utf-8")
tmp.replace(settings_file)

if action == "install":
    msg = f"installed (removed {removed} stale entr{'y' if removed == 1 else 'ies'})" if removed else "installed"
    print(f"✓ Hook {msg}: {settings_file}")
    print(f"✓ Command: {command}")
else:
    print(f"✓ Hook removed (took out {removed} entr{'y' if removed == 1 else 'ies'}): {settings_file}")

PY

    if [ "$DRY_RUN" = "true" ]; then
        info "Dry-run only — nothing written."
        return 0
    fi

    if [ "$ACTION" = "install" ]; then
        cat <<EOF

${GREEN}Next steps:${NC}

  1. Restart your Claude Code session (or open a new one) so it picks up the hook.
  2. Try it: ask the same kind of task three times. On the third turn, Claude
     will be nudged to suggest packaging it as a skill via skill-builder.
  3. Tune behavior by passing env vars to the hook (re-run with --history /
     --repeats, or edit ~/.claude/settings.json directly).

To remove later:
  bash $SCRIPT_DIR/install-hook.sh --uninstall

EOF
    fi
}

main "$@"
