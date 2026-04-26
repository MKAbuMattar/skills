#!/usr/bin/env bash
#
# new-skill.sh — Scaffold a new Agent Skill folder following the agentskills.io spec.
#
# Creates:
#   <name>/
#     SKILL.md       — frontmatter + section skeleton
#     LICENSE        — MIT
#     references/    — empty (you add files as needed)
#     assets/templates/
#     assets/examples/
#     scripts/       — empty
#
# Usage:
#     scripts/new-skill.sh <skill-name> "<one-line description>"
#     scripts/new-skill.sh <skill-name> "<description>" --parent /path/to/skills-repo
#     scripts/new-skill.sh -h
#
# Cross-platform: Linux, macOS, Windows (Git Bash, WSL, MSYS2).

set -euo pipefail

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
readonly RED GREEN YELLOW BLUE NC

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"

PARENT="$(pwd)"
NAME=""
DESC=""

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME <skill-name> "<one-line description>" [OPTIONS]

Scaffold a new Agent Skill folder following the agentskills.io specification.

ARGUMENTS:
    skill-name      kebab-case name (lowercase, digits, single hyphens; ≤ 64 chars).
    description     One-line description for the SKILL.md frontmatter (≤ 1024 chars).

OPTIONS:
    -h, --help              Show this help and exit
    -p, --parent <dir>      Create the skill folder inside <dir>
                            (default: current working directory)

EXAMPLES:
    $SCRIPT_NAME pdf-tools "Extract text and tables from PDFs..."
    $SCRIPT_NAME csv-analyzer "..." --parent ~/Work/skills

EXIT CODES:
    0   Skill created successfully
    1   Generic error (folder already exists, write failure, etc.)
    2   Bad arguments / invalid name
EOF
    exit "${1:-0}"
}

err() { echo -e "${RED}✗${NC} $*" >&2; }
info() { echo -e "${BLUE}ℹ${NC} $*"; }
ok() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*" >&2; }

validate_name() {
    local name="$1"
    [ -n "$name" ] || { err "Name cannot be empty"; return 2; }
    [ "${#name}" -le 64 ] || { err "Name must be ≤ 64 chars (got ${#name})"; return 2; }
    [[ "$name" =~ ^[a-z0-9](-?[a-z0-9])*$ ]] \
        || { err "Name must be kebab-case: lowercase a-z, digits, single hyphens, no leading/trailing/consecutive hyphens"; return 2; }
    return 0
}

write_skill_md() {
    local target="$1" name="$2" desc="$3"
    local title
    title="$(printf '%s' "$name" | awk -F- '{ for (i=1;i<=NF;i++) printf "%s%s", toupper(substr($i,1,1)) substr($i,2), (i<NF?" ":"") }')"
    cat >"$target/SKILL.md" <<EOF
---
name: $name
description: $desc
license: MIT. See LICENSE for full terms.
metadata:
  author: $(git config user.name 2>/dev/null || echo "your-name")
  version: "1.0.0"
---

# $title

<!-- One-line tagline describing the domain. -->

## When to use

- The user asks for <PRIMARY_TASK>.
- The user wants to harden, refactor, or review existing <ARTIFACT_TYPE>.

## Required structure

<!-- Minimal canonical example. Do not omit hard requirements. -->

\`\`\`
<MINIMAL_WORKING_EXAMPLE>
\`\`\`

## Workflow

1. **<STEP_1_TITLE>.** <DESCRIPTION>
2. **<STEP_2_TITLE>.** Load \`references/<TOPIC>.md\` if <CONDITION>.
3. **Validate.** Run \`<VALIDATOR_COMMAND>\` and aim for ≥ <TARGET>%.

## Available resources

- \`assets/templates/<FILE>\` — <PURPOSE>.
- \`assets/examples/<FILE>\` — full reference implementation.
- \`scripts/<FILE>\` — <PURPOSE_AND_WHEN_TO_RUN>.
- \`references/<TOPIC>.md\` — load when <CONDITION>.

## Top gotchas (always inline — do not skip)

- **<GOTCHA_1>** — <CONCRETE_EXAMPLE_AND_FIX>.
- **<GOTCHA_2>** — <CONCRETE_EXAMPLE_AND_FIX>.

## What you DO

1. <IMPERATIVE_1>.
2. <IMPERATIVE_2>.

## What you do NOT do

- <ANTI_PATTERN_1>.
- <ANTI_PATTERN_2>.
EOF
}

write_license() {
    local target="$1"
    local repo_license="$SKILL_DIR/LICENSE"
    if [ -f "$repo_license" ]; then
        cp "$repo_license" "$target/LICENSE"
    else
        # Fallback minimal MIT
        local year; year="$(date +%Y)"
        local author; author="$(git config user.name 2>/dev/null || echo "Author")"
        cat >"$target/LICENSE" <<EOF
MIT License

Copyright (c) $year $author

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
EOF
    fi
}

main() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -h|--help)   usage 0 ;;
            -p|--parent) PARENT="${2:?--parent requires a directory}"; shift 2 ;;
            -*)          err "Unknown option: $1"; usage 2 ;;
            *)           if [ -z "$NAME" ]; then NAME="$1"
                         elif [ -z "$DESC" ]; then DESC="$1"
                         else err "Unexpected argument: $1"; usage 2; fi
                         shift ;;
        esac
    done

    if [ -z "$NAME" ] || [ -z "$DESC" ]; then
        err "Both <skill-name> and <description> are required"
        usage 2
    fi

    validate_name "$NAME" || exit 2

    if [ "${#DESC}" -gt 1024 ]; then
        err "Description must be ≤ 1024 chars (got ${#DESC})"
        exit 2
    fi
    if [ "${#DESC}" -lt 32 ]; then
        warn "Description is short (${#DESC} chars) — consider adding casual phrasings the user might type."
    fi

    [ -d "$PARENT" ] || { err "Parent directory not found: $PARENT"; exit 1; }

    local target="$PARENT/$NAME"
    if [ -e "$target" ]; then
        err "Path already exists: $target"
        exit 1
    fi

    info "Creating $target"
    mkdir -p "$target/references" \
             "$target/assets/templates" \
             "$target/assets/examples" \
             "$target/scripts"

    write_skill_md "$target" "$NAME" "$DESC"
    ok "Wrote $target/SKILL.md"

    write_license "$target"
    ok "Wrote $target/LICENSE"

    cat <<EOF

${GREEN}✓ Skill scaffolded:${NC} $target

Next steps:

  1. Edit $target/SKILL.md — fill in the placeholders.
     Keep the body under 200 lines / 5,000 tokens.
  2. Move detailed material into $target/references/<topic>.md
     and tell the agent WHEN to load each file from SKILL.md.
  3. Add starting templates to $target/assets/templates/,
     full examples to $target/assets/examples/,
     and any executables to $target/scripts/.
  4. Validate:

       bash $SKILL_DIR/scripts/validate-skill.sh "$target"

  5. Optimize the description with eval queries — see
     $SKILL_DIR/references/description-optimization.md

EOF
}

main "$@"
