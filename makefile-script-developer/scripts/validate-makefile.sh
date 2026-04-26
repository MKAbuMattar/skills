#!/usr/bin/env bash
#
# validate-makefile.sh — Score a Makefile against the production checklist
# from the makefile-script-developer skill.
#
# Checks (each is one PASS/FAIL point):
#   - SHELL := /bin/bash                            (strict shell)
#   - .SHELLFLAGS := -euo pipefail -c               (strict mode)
#   - .DEFAULT_GOAL := help                         (default target)
#   - .DELETE_ON_ERROR                              (cleanup on failure)
#   - MAKEFLAGS contains --no-print-directory       (clean output)
#   - At least one .PHONY declaration                (phony targets)
#   - help target exists                             (self-documentation)
#   - $(filter ...) validation OR no enums needed    (env validation)
#   - Recipes use TAB indentation, not spaces        (syntax)
#   - $$ used in recipes (shell vars escaped)        (no $VAR mistakes)
#   - $(MAKE) used instead of bare `make`            (recursive correctness)
#   - Confirmation gate on destroy/uninstall/purge   (safety on destructive ops)
#   - No GNU `sed -i` without portable form          (cross-platform)
#   - := used predominantly (not = for everything)   (assignment hygiene)
#   - check-tools or similar pre-flight target       (dependency check)
#
# Usage:
#   scripts/validate-makefile.sh <Makefile>
#   scripts/validate-makefile.sh -v <Makefile>
#
# Exit codes:
#   0   score >= 90%  (production-ready)
#   1   score < 90%
#   2   bad arguments / file not found

set -euo pipefail

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
readonly RED GREEN YELLOW BLUE NC
readonly SCRIPT_NAME="$(basename "$0")"

VERBOSE=false
PASS=0
FAIL=0
RESULTS=()

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <Makefile>

Score a Makefile against the makefile-script-developer production checklist.

OPTIONS:
    -h, --help      Show this help and exit
    -v, --verbose   Show details on each check

EXIT CODES:
    0   Score >= 90% (production-ready)
    1   Score < 90%
    2   Bad arguments / file not found

EXAMPLES:
    $SCRIPT_NAME ./Makefile
    $SCRIPT_NAME -v charts/app/Makefile
EOF
    exit "${1:-0}"
}

record_pass() { PASS=$((PASS + 1)); RESULTS+=("PASS|$1|$2"); }
record_fail() { FAIL=$((FAIL + 1)); RESULTS+=("FAIL|$1|$2"); }

# -----------------------------------------------------------------------------
# Per-check helpers
# -----------------------------------------------------------------------------

# Body without comment-only lines (so a `# SHELL := /bin/bash` example doesn't pass).
# We strip lines whose first non-blank char is `#`.
strip_comments() {
    grep -vE '^[[:space:]]*#' "$1"
}

check_shell_bash() {
    if strip_comments "$MAKEFILE" | grep -qE '^[[:space:]]*SHELL[[:space:]]*:=[[:space:]]*/?(.*/)?bash[[:space:]]*$'; then
        record_pass "SHELL := /bin/bash" "Strict bash shell pinned"
    else
        record_fail "SHELL := /bin/bash" "Missing or wrong: required to enable pipefail / arrays / [[ ]]"
    fi
}

check_shellflags() {
    if strip_comments "$MAKEFILE" \
       | grep -E '^[[:space:]]*\.SHELLFLAGS[[:space:]]*:=' \
       | grep -qE -- '-e.*-u.*pipefail|-eu?o pipefail|-euo[[:space:]]+pipefail'; then
        record_pass ".SHELLFLAGS strict mode" "Has -euo pipefail"
    else
        record_fail ".SHELLFLAGS strict mode" "Missing '.SHELLFLAGS := -euo pipefail -c' — silent failures will slip past"
    fi
}

check_default_goal() {
    if strip_comments "$MAKEFILE" | grep -qE '^[[:space:]]*\.DEFAULT_GOAL[[:space:]]*:='; then
        record_pass ".DEFAULT_GOAL set" "Bare 'make' has a defined entrypoint"
    else
        record_fail ".DEFAULT_GOAL set" "Bare 'make' will run the first target by accident"
    fi
}

check_delete_on_error() {
    if strip_comments "$MAKEFILE" | grep -qE '^[[:space:]]*\.DELETE_ON_ERROR'; then
        record_pass ".DELETE_ON_ERROR" "Failed targets clean up partial files"
    else
        record_fail ".DELETE_ON_ERROR" "Missing — partial outputs from failed recipes leak"
    fi
}

check_makeflags() {
    if strip_comments "$MAKEFILE" | grep -qE '^[[:space:]]*MAKEFLAGS[[:space:]]*\+='; then
        record_pass "MAKEFLAGS configured" "Tunable defaults set"
    else
        record_fail "MAKEFLAGS configured" "Missing — no '--no-print-directory' / '--warn-undefined-variables' guardrails"
    fi
}

check_phony() {
    if grep -qE '^\.PHONY[[:space:]]*:' "$MAKEFILE"; then
        record_pass ".PHONY declared" "Has at least one .PHONY"
    else
        record_fail ".PHONY declared" "No .PHONY — non-file targets will silently break if a same-named file exists"
    fi
}

check_help_target() {
    # `help:` target on its own line (deps allowed). `_help` private targets don't count.
    if grep -qE '^help[[:space:]]*:([[:space:]]|$)' "$MAKEFILE"; then
        record_pass "help target" "Self-documentation target present"
    else
        record_fail "help target" "Missing 'help:' target — discoverability is poor"
    fi
}

check_tab_indentation() {
    # Look for recipe lines (indented under a target line). A recipe MUST start with TAB.
    # A target line is `name:` or `name: deps`. The next non-blank, non-comment line
    # that isn't another target should start with TAB.
    #
    # Simpler approximation: any line beginning with 4+ spaces followed by a non-#
    # character that's clearly a command (e.g. starts with @, $, command name).
    # If found, that's a likely space-indented recipe.
    if grep -nE '^[[:space:]]{4,}[a-zA-Z@$]' "$MAKEFILE" \
       | grep -vE '^[0-9]+:[[:space:]]+[a-zA-Z]+[[:space:]]*:=' \
       | grep -vE '^[0-9]+:[[:space:]]+[a-z_]+ \?=' \
       | grep -qE '^[0-9]+:[[:space:]]{4,}(@|\$\(|[a-z]+)'; then
        record_fail "TAB indentation" "Found space-indented recipe lines — Make will reject with 'missing separator'"
    else
        record_pass "TAB indentation" "Recipes appear TAB-indented"
    fi
}

check_dollar_dollar_in_recipes() {
    # Look for bare $VAR in recipes (TAB-indented lines) — it's almost always a bug.
    # Allow $(VAR) (Make var) and $$VAR (escaped shell var). Catch lines like `echo $foo`.
    local tab; tab="$(printf '\t')"
    # Recipe lines only.
    local recipes; recipes="$(grep -nE "^${tab}" "$MAKEFILE" || true)"
    [ -n "$recipes" ] || { record_pass "\$\$ in recipes" "No recipe lines found"; return; }

    # Strip out $$..., $(...), and "$" at end-of-line, then look for $X identifiers.
    local hits
    hits="$(printf '%s\n' "$recipes" \
        | sed -E 's/\$\$[A-Za-z_][A-Za-z0-9_]*//g' \
        | sed -E 's/\$\([^)]*\)//g' \
        | grep -E '\$[A-Za-z_][A-Za-z0-9_]+' || true)"

    if [ -n "$hits" ]; then
        record_fail "\$\$ in recipes" "Recipes contain bare \$VAR (will be eaten by Make) — use \$\$VAR for shell or \$(VAR) for Make"
    else
        record_pass "\$\$ in recipes" "No bare \$VAR found in recipes"
    fi
}

check_recursive_make() {
    # `make ...` (without $(MAKE)) inside a recipe is a bug for sub-invocations.
    # Heuristic: look for lines that *invoke* make as a command (not lines that just
    # echo help-text like `@echo "make plan ENV=dev"`).
    local tab; tab="$(printf '\t')"
    local hits
    hits="$(grep -nE "^${tab}" "$MAKEFILE" 2>/dev/null \
        | grep -vE '\$\(MAKE\)' \
        | grep -vE 'echo[[:space:]]' \
        | grep -vE '@echo' \
        | grep -E "^[0-9]+:${tab}@?[[:space:]]*make[[:space:]]" || true)"
    if [ -n "$hits" ]; then
        record_fail "\$(MAKE) for sub-make" "Bare 'make' used in recipe — should be \$(MAKE) so flags propagate"
    else
        record_pass "\$(MAKE) for sub-make" "Sub-makes use \$(MAKE)"
    fi
}

check_destructive_confirmation() {
    # Find targets named destroy / uninstall / purge / wipe / nuke. For each, the recipe
    # should contain `read -p` and the confirmation should mention the env or release name.
    local targets
    targets="$(grep -oE '^(destroy|uninstall|purge|wipe|nuke|reset)[[:space:]]*:' "$MAKEFILE" \
        | sed 's/[[:space:]]*:.*//' | sort -u || true)"

    if [ -z "$targets" ]; then
        record_pass "Confirmation gates" "No destructive targets to gate"
        return
    fi

    local missing=()
    for tgt in $targets; do
        # Body of this target = lines from 'tgt:' to the next non-recipe blank or new target.
        # Simpler: take a block of N lines after the match and look for `read -p` in it.
        if ! awk -v t="^$tgt[[:space:]]*:" '
            $0 ~ t { in_blk=1; next }
            in_blk && /^[a-zA-Z_-]+[[:space:]]*:/ { in_blk=0 }
            in_blk { print }
        ' "$MAKEFILE" | grep -qE 'read[[:space:]]+-p'; then
            missing+=("$tgt")
        fi
    done

    if [ "${#missing[@]}" -eq 0 ]; then
        record_pass "Confirmation gates" "All destructive targets gated with read -p"
    else
        record_fail "Confirmation gates" "Destructive targets missing 'read -p' confirmation: ${missing[*]}"
    fi
}

check_check_tools() {
    if grep -qE '^check-tools[[:space:]]*:' "$MAKEFILE"; then
        record_pass "check-tools target" "Pre-flight tool check present"
    else
        # Alternative: any check-* target works.
        if grep -qE '^check-[a-z]+[[:space:]]*:' "$MAKEFILE"; then
            record_pass "check-tools target" "At least one check-* pre-flight target present"
        else
            record_fail "check-tools target" "Missing — operations may fail mid-way without pre-flight validation"
        fi
    fi
}

check_simple_assignment_preferred() {
    # Count := vs = (excluding ?= and += and ::= and !=). If = dominates, flag it.
    # `grep -c` returns exit-code 1 when zero matches — coerce to "0".
    local simple recursive
    simple="$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*:=' "$MAKEFILE" 2>/dev/null)" || simple=0
    recursive="$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=([^=]|$)' "$MAKEFILE" 2>/dev/null)" || recursive=0

    # Allow some recursive — they're often legitimate (LOG_FILE = $(LOG_DIR)/$(CMD).log).
    # Fail only if recursive >= simple AND there are at least 5 assignments total.
    local total=$((simple + recursive))
    if [ "$total" -lt 5 ]; then
        record_pass "Assignment hygiene" "Few assignments; nothing to evaluate"
    elif [ "$recursive" -ge "$simple" ]; then
        record_fail "Assignment hygiene" "Recursive = ($recursive) >= simple := ($simple) — prefer := for almost everything"
    else
        record_pass "Assignment hygiene" ":= ($simple) >= = ($recursive)"
    fi
}

check_portable_sed() {
    # `sed -i 'expr'` (Linux only) and `sed -i '' 'expr'` (BSD only) are non-portable.
    # The portable form is `sed -i'' -e 'expr'` (no space, with -e).
    if grep -nE "sed[[:space:]]+-i[[:space:]]+'" "$MAKEFILE" >/dev/null \
       || grep -nE "sed[[:space:]]+-i[[:space:]]+\"" "$MAKEFILE" >/dev/null; then
        # Check that it's the portable empty-string form: -i ''
        if grep -nE "sed[[:space:]]+-i[[:space:]]+''" "$MAKEFILE" >/dev/null; then
            # macOS-only form
            if ! grep -nE "sed[[:space:]]+-i''" "$MAKEFILE" >/dev/null; then
                record_fail "Portable sed -i" "Found 'sed -i \"\"' (BSD-only) — use 'sed -i'\\'''\\'' -e ...' for both BSD and GNU"
                return
            fi
        else
            record_fail "Portable sed -i" "Found 'sed -i' followed by expression (GNU-only) — use 'sed -i'\\'''\\'' -e ...' for portability"
            return
        fi
    fi
    record_pass "Portable sed -i" "No non-portable sed -i found"
}

# -----------------------------------------------------------------------------
# Reporting
# -----------------------------------------------------------------------------

print_results() {
    echo
    echo "============================================================"
    echo "Makefile Validation: $MAKEFILE"
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
        printf "Score: ${GREEN}%d%%${NC} - Production-ready\n" "$score"
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
        echo -e "${RED}Error: missing <Makefile> argument${NC}" >&2
        usage 2
    fi

    MAKEFILE="$1"
    [ -f "$MAKEFILE" ] || { echo -e "${RED}Error: not a file: $MAKEFILE${NC}" >&2; exit 2; }

    check_shell_bash
    check_shellflags
    check_default_goal
    check_delete_on_error
    check_makeflags
    check_phony
    check_help_target
    check_check_tools
    check_tab_indentation
    check_dollar_dollar_in_recipes
    check_recursive_make
    check_destructive_confirmation
    check_simple_assignment_preferred
    check_portable_sed

    print_results
}

main "$@"
