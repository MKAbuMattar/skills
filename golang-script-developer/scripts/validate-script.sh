#!/usr/bin/env bash
# Score a Go program against the golang-script-developer checklist.
#
# Usage: bash validate-script.sh <main.go>
#
# Checks (each pass = 1 point, total / 14 → percent):
#   1.  Top-of-file package doc comment
#   2.  Uses log/slog for structured logging
#   3.  Wraps errors with %w (fmt.Errorf "...: %w")
#   4.  Uses errors.Is or errors.As for inspection
#   5.  Uses signal.NotifyContext for SIGINT/SIGTERM
#   6.  Uses context.Context as a parameter (not stored on a struct)
#   7.  Defines exit-code constants or a typed exit error
#   8.  Uses path/filepath (not path) for filesystem paths
#   9.  No use of deprecated ioutil
#  10.  No use of panic outside _test.go (heuristic)
#  11.  Uses flag, cobra, or urfave-cli for argv
#  12.  Has main() and a separate run() function (or equivalent)
#  13.  Logs to stderr (slog default, or explicit os.Stderr writer)
#  14.  Uses CGO_ENABLED=0-friendly stdlib only (heuristic: no C imports)

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: bash validate-script.sh <main.go>" >&2
  exit 2
fi

src="$1"
if [[ ! -f "$src" ]]; then
  echo "error: file not found: $src" >&2
  exit 2
fi

content=$(cat "$src")
total=14
passed=0
report=()

check() {
  local name="$1" pattern="$2" inverted="${3:-no}"
  local matched="no"
  if echo "$content" | grep -qE -- "$pattern"; then
    matched="yes"
  fi
  if [[ "$inverted" == "yes" ]]; then
    if [[ "$matched" == "no" ]]; then
      report+=("✓ $name")
      passed=$((passed + 1))
    else
      report+=("✗ $name")
    fi
  else
    if [[ "$matched" == "yes" ]]; then
      report+=("✓ $name")
      passed=$((passed + 1))
    else
      report+=("✗ $name")
    fi
  fi
}

# 1. package doc comment (// Package ...)
check "package doc comment" "^// Package "

# 2. log/slog
check "uses log/slog" '"log/slog"'

# 3. fmt.Errorf with %w
check "wraps errors with %w" 'fmt\.Errorf\("[^"]*: %w"'

# 4. errors.Is / errors.As
check "uses errors.Is or errors.As" "errors\.(Is|As)"

# 5. signal.NotifyContext
check "uses signal.NotifyContext" "signal\.NotifyContext"

# 6. context.Context as parameter
check "uses context.Context parameter" "ctx context\.Context|context\.Context\b"

# 7. exit-code constants or typed exit error
check "defines exit codes" "exit(OK|Generic|Usage|Interrupt)|ExitError|exitError"

# 8. path/filepath (not path) — only required if the program does fs path work; pass if no path ops at all
if echo "$content" | grep -qE 'filepath\.(Join|Dir|Base|Walk|Rel)|"path"'; then
  check "uses path/filepath for fs paths" '"path/filepath"|filepath\.(Join|Dir|Base|Walk|Rel)'
else
  report+=("✓ uses path/filepath for fs paths (n/a — no path ops)")
  passed=$((passed + 1))
fi

# 9. no ioutil
check "no ioutil usage" '"io/ioutil"|ioutil\.' yes

# 10. no panic in non-test code (rough)
check "no panic in non-test code" '\bpanic\(' yes

# 11. flag / cobra / urfave-cli
check "uses flag, cobra, or urfave-cli" '"flag"|cobra|urfave/cli'

# 12. main + run separation (order-independent)
if echo "$content" | grep -qE '^func main\(' && echo "$content" | grep -qE '^func run\('; then
  report+=("✓ has main and run separation")
  passed=$((passed + 1))
else
  report+=("✗ has main and run separation")
fi

# 13. logs to stderr
check "logs to stderr" "os\.Stderr|slog\.New\(slog\.New(Text|JSON)Handler\(os\.Stderr"

# 14. no cgo C import
check "no cgo (CGO_ENABLED=0 friendly)" '"C"' yes

pct=$(( passed * 100 / total ))

echo
echo "============================================================"
echo "Go Script Validation: $src"
echo "============================================================"
for line in "${report[@]}"; do
  echo "$line"
done
echo "============================================================"
echo "Score: $pct% ($passed / $total checks)"
echo "============================================================"

if [[ $pct -ge 90 ]]; then
  exit 0
fi
exit 1
