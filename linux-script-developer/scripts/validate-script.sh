#!/usr/bin/env bash
#
# validate-script.sh — Score a Bash script against the linux-script-developer
# best-practices checklist. Mirrors python-script-developer/scripts/validate-script.py.
#
# Usage:
#     scripts/validate-script.sh <script.sh>
#     scripts/validate-script.sh -v <script.sh>
#
# Exit codes:
#     0 — score >= 80%
#     1 — score < 80%
#     2 — file not found / bad arguments
#
# Cross-platform: Linux, macOS, Windows (Git Bash, WSL, MSYS2). Bash 4.0+.

set -euo pipefail

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; NC=''
fi

readonly SCRIPT_NAME="$(basename "$0")"
VERBOSE=false
PASS=0
FAIL=0
RESULTS=()

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS] <script.sh>

Validate a Bash script against the linux-script-developer best-practices checklist.

OPTIONS:
    -h, --help      Show this help and exit
    -v, --verbose   Print extra detail per check

EXIT CODES:
    0   Score >= 80%
    1   Score < 80%
    2   File not found or bad arguments

EXAMPLES:
    $SCRIPT_NAME my-script.sh
    $SCRIPT_NAME -v deploy.sh
EOF
    exit "${1:-0}"
}

record_pass() { PASS=$((PASS + 1)); RESULTS+=("PASS|$1|$2"); }
record_fail() { FAIL=$((FAIL + 1)); RESULTS+=("FAIL|$1|$2"); }

# Strip comments and HEREDOC bodies before pattern-matching, so check_* functions
# don't false-positive on documentation. We can't perfectly parse Bash with grep,
# but stripping `^[[:space:]]*#.*` lines covers most cases.
code_only() {
    grep -vE '^[[:space:]]*#' "$1" || true
}

check_shebang() {
    local first; first="$(head -n1 "$1")"
    case "$first" in
        '#!/usr/bin/env bash')
            record_pass "Shebang" "Uses #!/usr/bin/env bash" ;;
        '#!/bin/bash')
            record_fail "Shebang" "Uses #!/bin/bash (macOS ships old Bash 3.2 there — prefer #!/usr/bin/env bash)" ;;
        '#!/bin/sh')
            record_fail "Shebang" "Uses #!/bin/sh (POSIX sh, not Bash — many idioms won't work)" ;;
        '#!'*)
            record_fail "Shebang" "Unrecognized shebang: $first (use #!/usr/bin/env bash)" ;;
        *)
            record_fail "Shebang" "Missing shebang on line 1" ;;
    esac
}

check_strict_mode() {
    if grep -qE '^[[:space:]]*set[[:space:]]+-(euo[[:space:]]+pipefail|[a-zA-Z]*e[a-zA-Z]*u[a-zA-Z]*o[[:space:]]+pipefail)' "$1" \
       || (grep -qE '^[[:space:]]*set[[:space:]]+-e' "$1" \
           && grep -qE '^[[:space:]]*set[[:space:]]+-u' "$1" \
           && grep -qE '^[[:space:]]*set[[:space:]]+-o[[:space:]]+pipefail' "$1"); then
        record_pass "Strict mode" "set -euo pipefail enabled"
    elif grep -qE '^[[:space:]]*set[[:space:]]+-e' "$1"; then
        record_fail "Strict mode" "Has 'set -e' but missing -u and/or pipefail"
    else
        record_fail "Strict mode" "Missing 'set -euo pipefail'"
    fi
}

check_header_comment() {
    if head -n 12 "$1" | tail -n +2 | grep -qE '^#[^!]'; then
        record_pass "Header comment" "Has description comment near top"
    else
        record_fail "Header comment" "Missing description comment in first 12 lines"
    fi
}

check_usage_function() {
    if grep -qE '^(function[[:space:]]+)?usage[[:space:]]*\(\)' "$1"; then
        record_pass "Usage function" "usage() is defined"
    else
        record_fail "Usage function" "No usage() function found"
    fi
}

check_main_pattern() {
    local has_main has_call
    if grep -qE '^(function[[:space:]]+)?main[[:space:]]*\(\)' "$1"; then
        has_main=true
    else
        has_main=false
    fi
    if grep -qE '^[[:space:]]*main[[:space:]]+"\$@"[[:space:]]*$' "$1"; then
        has_call=true
    else
        has_call=false
    fi

    if "$has_main" && "$has_call"; then
        record_pass "Main pattern" "main() defined and invoked with \"\$@\""
    elif "$has_main"; then
        record_fail "Main pattern" "main() defined but not invoked with \"\$@\" at end of file"
    else
        record_fail "Main pattern" "No main() function found"
    fi
}

check_no_eval() {
    if code_only "$1" | grep -qE '(^|[^a-zA-Z0-9_])eval[[:space:]]'; then
        record_fail "Safe eval" "Uses 'eval' (avoid — high command-injection risk)"
    else
        record_pass "Safe eval" "No 'eval' usage"
    fi
}

check_hardcoded_paths() {
    local hits
    hits="$(code_only "$1" \
            | grep -nE '(^|[^a-zA-Z0-9_/])(/home/[a-zA-Z0-9_-]+|/Users/[a-zA-Z0-9_-]+)/' \
            | head -3 || true)"
    if [ -z "$hits" ]; then
        record_pass "No hardcoded paths" "No /home/<user> or /Users/<user> paths"
    else
        record_fail "No hardcoded paths" "Found hardcoded user-home paths (use SCRIPT_DIR or env vars)"
    fi
}

check_unquoted_positional_args() {
    # Strip balanced "..." and '...' strings from each non-comment line, then look
    # for bare $1..$9 in what remains. Whitelist contexts where Bash itself skips
    # word-splitting: `case $N in`, `[[ ... $N ... ]]`, and `local x=$N` / `var=$N`.
    local hits
    hits="$(awk '
        /^[[:space:]]*#/ { next }
        {
            line = $0
            gsub(/"[^"]*"/, "", line)
            gsub(/'\''[^'\'']*'\''/, "", line)
            if (match(line, /(^|[^$\\])\$[1-9]([^a-zA-Z0-9_]|$)/)) {
                print NR": "$0
            }
        }
    ' "$1" \
            | grep -vE '\bcase[[:space:]]+\$[1-9][[:space:]]+in\b' \
            | grep -vE '\[\[[[:space:]]+[^]]*\$[1-9]' \
            | grep -vE '(^|[[:space:]])(local[[:space:]]+)?[a-zA-Z_][a-zA-Z0-9_]*=\$[1-9]' \
            | head -5 || true)"
    if [ -z "$hits" ]; then
        record_pass "Quoted positional args" "No obviously unquoted \$1..\$9"
    else
        record_fail "Quoted positional args" "Possibly unquoted positional args (always use \"\$1\")"
    fi
}

check_color_tty_guard() {
    if grep -qE '\\033\[' "$1" || grep -qE '\\e\[' "$1"; then
        if grep -qE '\[[[:space:]]+-t[[:space:]]+[12][[:space:]]+\]' "$1"; then
            record_pass "Color TTY guard" "ANSI codes guarded by [ -t 1 ] / [ -t 2 ]"
        else
            record_fail "Color TTY guard" "Uses ANSI codes without [ -t 1 ] guard (will pollute pipes / CI logs)"
        fi
    else
        record_pass "Color TTY guard" "No ANSI codes used"
    fi
}

check_cross_platform_flags() {
    local issues=()
    code_only "$1" | grep -qE '\bgrep[[:space:]]+(-[a-zA-Z]*P|--perl-regexp)' && issues+=("grep -P (use -E)")
    code_only "$1" | grep -qE '\breadlink[[:space:]]+(-[a-zA-Z]*f|--canonicalize)' && issues+=("readlink -f (not on macOS)")
    code_only "$1" | grep -qE '\bdate[[:space:]]+-d[[:space:]]' && issues+=("date -d (GNU-only)")
    code_only "$1" | grep -qE '\bmktemp[[:space:]]+--suffix' && issues+=("mktemp --suffix (GNU-only)")
    code_only "$1" | grep -qE "\bsed[[:space:]]+-i[[:space:]]+['\"]" && issues+=("sed -i (use sed -i'' -e for portability)")
    code_only "$1" | grep -qE '\bxargs[[:space:]]+(--no-run-if-empty|-r[[:space:]])' && issues+=("xargs -r / --no-run-if-empty (GNU-only)")
    code_only "$1" | grep -qE '\bfind[[:space:]]+[^|]*-printf' && issues+=("find -printf (GNU-only)")

    if [ "${#issues[@]}" -eq 0 ]; then
        record_pass "Cross-platform" "No GNU-only flags detected"
    else
        record_fail "Cross-platform" "Found: ${issues[*]}"
    fi
}

check_error_redirection() {
    # At least one error message should go to stderr (>&2)
    if code_only "$1" | grep -qE '>&2'; then
        record_pass "Stderr for errors" "At least one diagnostic redirected to stderr"
    else
        record_fail "Stderr for errors" "No stderr redirection (>&2) — error messages should not pollute stdout"
    fi
}

print_results() {
    local script="$1"
    echo
    echo "============================================================"
    echo "Bash Script Validation: $script"
    echo "============================================================"
    for r in "${RESULTS[@]}"; do
        IFS='|' read -r status name msg <<<"$r"
        if [ "$status" = "PASS" ]; then
            printf "${GREEN}✓${NC} %-26s %s\n" "$name:" "$msg"
        else
            printf "${RED}✗${NC} %-26s %s\n" "$name:" "$msg"
        fi
    done

    local total=$((PASS + FAIL))
    local score=$((total > 0 ? PASS * 100 / total : 0))

    echo "============================================================"
    if [ "$score" -ge 90 ]; then
        printf "Score: ${GREEN}%d%%${NC} - Excellent\n" "$score"
    elif [ "$score" -ge 80 ]; then
        printf "Score: ${GREEN}%d%%${NC} - Good\n" "$score"
    elif [ "$score" -ge 60 ]; then
        printf "Score: ${YELLOW}%d%%${NC} - Needs improvement\n" "$score"
    else
        printf "Score: ${RED}%d%%${NC} - Poor\n" "$score"
    fi
    printf "Passed: %d / %d\n" "$PASS" "$total"
    echo "============================================================"

    [ "$score" -ge 80 ]
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
        echo -e "${RED}Error: missing <script.sh> argument${NC}" >&2
        usage 2
    fi

    local script="$1"
    if [ ! -f "$script" ]; then
        echo -e "${RED}Error: file not found: $script${NC}" >&2
        exit 2
    fi

    check_shebang                  "$script"
    check_strict_mode              "$script"
    check_header_comment           "$script"
    check_usage_function           "$script"
    check_main_pattern             "$script"
    check_unquoted_positional_args "$script"
    check_no_eval                  "$script"
    check_hardcoded_paths          "$script"
    check_color_tty_guard          "$script"
    check_cross_platform_flags     "$script"
    check_error_redirection        "$script"

    print_results "$script"
}

main "$@"
