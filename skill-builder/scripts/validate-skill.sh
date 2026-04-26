#!/usr/bin/env bash
#
# validate-skill.sh — Score a skill folder against the agentskills.io spec
# and best practices. Mirrors the per-skill validators (validate-script.sh /
# validate-script.py) used by linux-script-developer / python-script-developer.
#
# Usage:
#     scripts/validate-skill.sh <skill-dir>
#     scripts/validate-skill.sh -v <skill-dir>
#
# Checks:
#   - SKILL.md exists, has frontmatter, has body
#   - name: kebab-case ≤ 64 chars, matches folder name
#   - description: present, ≤ 1024 chars, contains imperative phrasing
#   - body: ≤ 500 lines, ~ ≤ 5,000 tokens
#   - license field present in frontmatter
#   - LICENSE file present
#   - referenced files (references/, assets/, scripts/) exist on disk
#   - reference files in references/ are mentioned in SKILL.md (load triggers)
#
# Exit codes:
#   0 — score ≥ 90%  (publish-ready)
#   1 — score < 90%
#   2 — bad arguments / skill folder not found

set -euo pipefail

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; NC=''
fi
readonly RED GREEN YELLOW NC
readonly SCRIPT_NAME="$(basename "$0")"

VERBOSE=false
PASS=0
FAIL=0
RESULTS=()

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <skill-dir>

Validate an Agent Skill folder against the agentskills.io spec and best practices.

OPTIONS:
    -h, --help      Show this help and exit
    -v, --verbose   Print details on each check

EXIT CODES:
    0   Score ≥ 90% (publish-ready)
    1   Score < 90%
    2   Bad arguments / skill folder not found

EXAMPLES:
    $SCRIPT_NAME ./my-skill
    $SCRIPT_NAME -v ../skills/csv-analyzer
EOF
    exit "${1:-0}"
}

record_pass() { PASS=$((PASS + 1)); RESULTS+=("PASS|$1|$2"); }
record_fail() { FAIL=$((FAIL + 1)); RESULTS+=("FAIL|$1|$2"); }

# -----------------------------------------------------------------------------
# Frontmatter parsing — extract the YAML block between '---' fences and pull
# top-level scalar fields. Multi-line values (block scalars) are supported.
# -----------------------------------------------------------------------------

extract_frontmatter() {
    awk '/^---[[:space:]]*$/ { c++; next } c==1 { print } c==2 { exit }' "$1"
}

extract_body() {
    awk '/^---[[:space:]]*$/ { c++; next } c==2 { print }' "$1"
}

# Pull a top-level scalar value. Supports plain `key: value`, quoted strings,
# and `key: >` / `key: |` block scalars (joined into one line for length checks).
fm_field() {
    local fm="$1" key="$2"
    printf '%s\n' "$fm" | awk -v k="$key" '
        BEGIN { found=0; block=""; mode="" }
        $0 ~ "^"k":[[:space:]]*[>|][[:space:]]*$" {
            found=1; mode="block"; next
        }
        $0 ~ "^"k":" {
            sub("^"k":[[:space:]]*","")
            # Strip surrounding quotes
            sub(/^"/,""); sub(/"$/,"")
            sub(/^'\''/,""); sub(/'\''$/,"")
            print
            found=1; exit
        }
        mode=="block" {
            if ($0 ~ /^[a-zA-Z_-]+:/) { exit }
            sub(/^[[:space:]]+/,"")
            block = (block ? block " " : "") $0
        }
        END { if (mode=="block" && found) print block }
    '
}

# -----------------------------------------------------------------------------
# Checks
# -----------------------------------------------------------------------------

check_skill_md_exists() {
    if [ -f "$SKILL_MD" ]; then
        record_pass "SKILL.md present" "Found at $SKILL_MD"
    else
        record_fail "SKILL.md present" "No SKILL.md at $SKILL_MD"
        return 1
    fi
}

check_frontmatter_present() {
    local first; first="$(head -n1 "$SKILL_MD")"
    if [ "$first" = "---" ]; then
        record_pass "Frontmatter fence" "SKILL.md opens with '---'"
    else
        record_fail "Frontmatter fence" "SKILL.md must start with '---' (got: $first)"
        return 1
    fi
    if extract_frontmatter "$SKILL_MD" | grep -qE '.'; then
        record_pass "Frontmatter content" "Non-empty YAML between fences"
    else
        record_fail "Frontmatter content" "Empty frontmatter"
        return 1
    fi
}

check_name_field() {
    local name="$1"
    if [ -z "$name" ]; then
        record_fail "name field" "Missing 'name:' in frontmatter"
        return
    fi
    if [ "${#name}" -gt 64 ]; then
        record_fail "name field" "name too long (${#name} > 64): $name"
        return
    fi
    if [[ "$name" =~ ^[a-z0-9](-?[a-z0-9])*$ ]]; then
        record_pass "name field" "Valid kebab-case: $name"
    else
        record_fail "name field" "Not kebab-case: $name (lowercase a-z, digits, single hyphens; no leading/trailing/consecutive hyphens)"
    fi
}

check_name_matches_folder() {
    local name="$1"
    local folder; folder="$(basename "$SKILL_DIR")"
    if [ "$name" = "$folder" ]; then
        record_pass "name matches folder" "name='$name' = folder='$folder'"
    else
        record_fail "name matches folder" "name='$name' but folder='$folder'"
    fi
}

check_description_field() {
    local desc="$1"
    if [ -z "$desc" ]; then
        record_fail "description field" "Missing 'description:' in frontmatter"
        return
    fi
    local len="${#desc}"
    if [ "$len" -gt 1024 ]; then
        record_fail "description field" "description too long ($len > 1024)"
        return
    fi
    if [ "$len" -lt 64 ]; then
        record_fail "description field" "description too short ($len chars) — list casual phrasings the user might type"
        return
    fi
    record_pass "description length" "${len} chars (≤ 1024)"

    # Check for imperative trigger phrasing
    if printf '%s' "$desc" | grep -qiE '\b(use this skill|use when|whenever)\b'; then
        record_pass "description phrasing" "Contains imperative trigger phrasing"
    else
        record_fail "description phrasing" "No imperative phrasing — start with 'Use this skill when...' or 'Use whenever...'"
    fi
}

check_license_field() {
    if [ -n "$LICENSE_FIELD" ]; then
        record_pass "license field" "Present: $LICENSE_FIELD"
    else
        record_fail "license field" "Missing 'license:' in frontmatter"
    fi
}

check_license_file() {
    if [ -f "$SKILL_DIR/LICENSE" ]; then
        record_pass "LICENSE file" "Present at $SKILL_DIR/LICENSE"
    else
        record_fail "LICENSE file" "Missing LICENSE file"
    fi
}

check_body_length() {
    local lines; lines="$(extract_body "$SKILL_MD" | wc -l)"
    local chars; chars="$(extract_body "$SKILL_MD" | wc -c)"
    local rough_tokens=$((chars / 4))

    if [ "$lines" -le 200 ]; then
        record_pass "Body lines" "$lines lines (target ≤ 200)"
    elif [ "$lines" -le 500 ]; then
        record_pass "Body lines" "$lines lines (≤ 500 spec limit; target ≤ 200)"
    else
        record_fail "Body lines" "$lines lines (> 500 spec limit) — move detail to references/"
    fi

    if [ "$rough_tokens" -le 5000 ]; then
        record_pass "Body tokens (est.)" "~${rough_tokens} tokens (target ≤ 5,000)"
    else
        record_fail "Body tokens (est.)" "~${rough_tokens} tokens (> 5,000) — move detail to references/"
    fi
}

# Find every relative path mentioned in SKILL.md that points at a bundled
# resource (references/, assets/, scripts/) and confirm the file exists.
check_referenced_files_exist() {
    local body; body="$(extract_body "$SKILL_MD")"
    local missing=()
    local refs
    # Strip any `references/<placeholder>` patterns first — those are docs/examples,
    # not real references. Also strip <angle-bracket> placeholders inline.
    refs="$(printf '%s' "$body" \
        | sed -E 's#(references|assets|scripts)/<[^>]+>##g' \
        | grep -oE '(\b|/)(references|assets|scripts)/[a-zA-Z0-9_./{}-]+' \
        | grep -vE '\{|\}' \
        | sort -u || true)"

    if [ -z "$refs" ]; then
        record_pass "Referenced files exist" "No bundled-file references found (or all in {brace} expansions)"
        return
    fi

    while IFS= read -r ref; do
        # Strip leading slash if any
        ref="${ref#/}"
        [ -e "$SKILL_DIR/$ref" ] || missing+=("$ref")
    done <<<"$refs"

    if [ "${#missing[@]}" -eq 0 ]; then
        record_pass "Referenced files exist" "All paths in SKILL.md resolve"
    else
        record_fail "Referenced files exist" "Missing: ${missing[*]}"
    fi
}

# Files that exist in references/ should be mentioned somewhere in SKILL.md
# with a load trigger ("Load X when ..." or "see X" etc).
check_reference_files_documented() {
    local refs_dir="$SKILL_DIR/references"
    [ -d "$refs_dir" ] || { record_pass "References documented" "No references/ directory"; return; }

    local body; body="$(extract_body "$SKILL_MD")"
    local undocumented=()
    while IFS= read -r f; do
        local rel="references/${f}"
        printf '%s' "$body" | grep -qF "$rel" || undocumented+=("$rel")
    done < <(cd "$refs_dir" && find . -type f -name '*.md' | sed 's|^\./||')

    if [ "${#undocumented[@]}" -eq 0 ]; then
        record_pass "References documented" "Every references/*.md is mentioned in SKILL.md"
    else
        record_fail "References documented" "Not mentioned in SKILL.md: ${undocumented[*]}"
    fi
}

check_canonical_subdirs() {
    # Best-practice layout: at least one of references/, assets/, scripts/.
    # Also: no `templates/` or `examples/` at top level (should be under assets/).
    local present=()
    [ -d "$SKILL_DIR/references" ] && present+=("references/")
    [ -d "$SKILL_DIR/assets" ]     && present+=("assets/")
    [ -d "$SKILL_DIR/scripts" ]    && present+=("scripts/")

    if [ "${#present[@]}" -eq 0 ]; then
        record_pass "Layout (no extra subdirs)" "Single-file skill — no bundled resources"
    else
        record_pass "Canonical subdirs" "${present[*]}"
    fi

    if [ -d "$SKILL_DIR/templates" ]; then
        record_fail "Layout convention" "Top-level 'templates/' should be 'assets/templates/'"
    fi
    if [ -d "$SKILL_DIR/examples" ]; then
        record_fail "Layout convention" "Top-level 'examples/' should be 'assets/examples/'"
    fi
}

# -----------------------------------------------------------------------------
# Reporting
# -----------------------------------------------------------------------------

print_results() {
    echo
    echo "============================================================"
    echo "Skill Validation: $SKILL_DIR"
    echo "============================================================"
    for r in "${RESULTS[@]}"; do
        IFS='|' read -r status name msg <<<"$r"
        if [ "$status" = "PASS" ]; then
            printf "${GREEN}✓${NC} %-28s %s\n" "$name:" "$msg"
        else
            printf "${RED}✗${NC} %-28s %s\n" "$name:" "$msg"
        fi
    done
    local total=$((PASS + FAIL))
    local score=$((total > 0 ? PASS * 100 / total : 0))
    echo "============================================================"
    if [ "$score" -ge 90 ]; then
        printf "Score: ${GREEN}%d%%${NC} - Publish-ready\n" "$score"
    elif [ "$score" -ge 70 ]; then
        printf "Score: ${YELLOW}%d%%${NC} - Needs work\n" "$score"
    else
        printf "Score: ${RED}%d%%${NC} - Major issues\n" "$score"
    fi
    printf "Passed: %d / %d\n" "$PASS" "$total"
    echo "============================================================"

    [ "$score" -ge 90 ]
}

main() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -h|--help)    usage 0 ;;
            -v|--verbose) VERBOSE=true; shift ;;
            -*)           echo "Unknown option: $1" >&2; usage 2 ;;
            *)            break ;;
        esac
    done

    if [ "$#" -lt 1 ]; then
        echo -e "${RED}Error: missing <skill-dir> argument${NC}" >&2
        usage 2
    fi

    SKILL_DIR="$(cd "$1" 2>/dev/null && pwd)" || { echo -e "${RED}Error: not a directory: $1${NC}" >&2; exit 2; }
    SKILL_MD="$SKILL_DIR/SKILL.md"

    check_skill_md_exists || { print_results; exit 1; }
    check_frontmatter_present || { print_results; exit 1; }

    local fm; fm="$(extract_frontmatter "$SKILL_MD")"
    local NAME DESC
    NAME="$(fm_field "$fm" name)"
    DESC="$(fm_field "$fm" description)"
    LICENSE_FIELD="$(fm_field "$fm" license)"

    check_name_field "$NAME"
    check_name_matches_folder "$NAME"
    check_description_field "$DESC"
    check_license_field
    check_license_file
    check_body_length
    check_canonical_subdirs
    check_referenced_files_exist
    check_reference_files_documented

    print_results
}

main "$@"
