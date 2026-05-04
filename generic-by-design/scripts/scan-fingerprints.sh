#!/usr/bin/env bash
# Scan a file or directory for organization-specific fingerprints.
#
# Usage: scan-fingerprints.sh <path> [--quiet]
#
# Categories scanned:
#   1. Cloud-vendor regions (structural regex)
#   2. Vendor SaaS (wordlist: data/vendor-saas.txt)
#   3. Cloud service abbreviations (wordlist: data/cloud-abbreviations.txt)
#   4. Hardcoded vendor URLs (structural regex)
#   5. Source-skill author attributions (wordlist: data/source-authors.txt)
#   6. Concept-author attributions (wordlist: data/concept-authors.txt)
#   7. Org / company names (wordlist: data/org-names.txt)
#   8. Internal filesystem paths (structural regex)
#   9. Stack-specific assertion phrases (structural regex)
#   10. Hardcoded scale fingerprints (structural regex)
#
# The wordlists in data/ are tool data — the scanner uses them to find leaks.
# Edit them to add patterns specific to your repo / history.
#
# Exit codes:
#   0 — no leaks found, or only legitimate hits (the script can't tell — review)
#   1 — at least one likely leak found
#   2 — usage / argument error

set -euo pipefail

if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

if [[ $# -lt 1 ]]; then
  echo "${RED}error:${NC} usage: $(basename "$0") <path> [--quiet]" >&2
  exit 2
fi

TARGET="$1"
QUIET="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"

if [[ ! -e "$TARGET" ]]; then
  echo "${RED}error:${NC} not found: $TARGET" >&2
  exit 2
fi
if [[ ! -d "$DATA_DIR" ]]; then
  echo "${RED}error:${NC} data directory not found: $DATA_DIR" >&2
  exit 2
fi

# Build the find expression
if [[ -d "$TARGET" ]]; then
  FIND_CMD=(find "$TARGET" -type f
    -not -path '*/.git/*'
    -not -path '*/node_modules/*'
    -not -path '*/.terraform/*'
    -not -path '*/dist/*'
    -not -path '*/build/*'
    -not -path '*/.next/*'
    -not -path '*/scripts/data/*'
    -not -name '*.lock'
    -not -name '*.lockb'
    -not -name 'package-lock.json'
    -not -name 'pnpm-lock.yaml'
    -not -name 'go.sum')
else
  FIND_CMD=(echo "$TARGET")
fi

total_hits=0

# Convert a wordlist file into a single grep alternation, ignoring blanks / comments.
wordlist_to_alternation() {
  local file="$1"
  if [[ ! -f "$file" ]]; then return 1; fi
  local items
  items="$(grep -vE '^\s*(#|$)' "$file" | tr '\n' '|' | sed 's/|$//')"
  if [[ -z "$items" ]]; then return 1; fi
  printf '%s\n' "$items"
}

# Print a hit block for a category.
report_hits() {
  local label="$1" hits="$2" hint="$3"
  if [[ -z "$hits" ]]; then return; fi
  local count
  count=$(echo "$hits" | wc -l | tr -d ' ')
  total_hits=$((total_hits + count))
  if [[ "$QUIET" != "--quiet" ]]; then
    echo
    echo "${YELLOW}── ${label} (${count})${NC}"
    [[ -n "$hint" ]] && echo "${BLUE}   ${hint}${NC}"
    echo "$hits" | head -20
    if [[ "$count" -gt 20 ]]; then
      echo "   ... ($((count - 20)) more not shown)"
    fi
  fi
}

# Scan with a structural regex.
scan_regex() {
  local label="$1" pattern="$2" hint="$3"
  local hits
  hits=$("${FIND_CMD[@]}" -print0 2>/dev/null \
    | xargs -0 grep -InE "$pattern" 2>/dev/null \
    || true)
  report_hits "$label" "$hits" "$hint"
}

# Scan with a wordlist (one of data/*.txt).
scan_wordlist() {
  local label="$1" wordlist="$2" hint="$3" word_boundary="${4:-yes}"
  local alt
  alt="$(wordlist_to_alternation "$wordlist")" || return 0
  local pattern
  if [[ "$word_boundary" == "yes" ]]; then
    pattern="\\b(${alt})\\b"
  else
    pattern="(${alt})"
  fi
  local hits
  hits=$("${FIND_CMD[@]}" -print0 2>/dev/null \
    | xargs -0 grep -InE "$pattern" 2>/dev/null \
    || true)
  report_hits "$label" "$hits" "$hint"
}

echo "${BLUE}Scanning ${TARGET} for fingerprints…${NC}"

# 1. Cloud-vendor regions (structural)
scan_regex \
  "Cloud-vendor regions (likely user-specific)" \
  '\b([a-z]{2}-(north|south|east|west|central|northeast|northwest|southeast|southwest)-[1-9])\b' \
  "Replace with <region> placeholder, drop, or rotate to a different cloud's region."

# 2. Vendor SaaS (wordlist)
scan_wordlist \
  "Vendor SaaS (mask if used as 'we use X' / 'our X' / hardcoded)" \
  "$DATA_DIR/vendor-saas.txt" \
  "Keep when listed as one option among many; mask when claimed as user's stack."

# 3. Cloud service abbreviations (wordlist)
scan_wordlist \
  "Cloud-vendor service abbreviations" \
  "$DATA_DIR/cloud-abbreviations.txt" \
  "Keep as 'object storage', 'managed Kubernetes', 'container registry', etc."

# 4. Hardcoded vendor URLs (structural)
scan_regex \
  "Hardcoded vendor URLs" \
  '(\.(myhuaweicloud|amazonaws|azure-?api|googleapis|oraclecloud|digitalocean)\.com|\.atlassian\.net|\.intra\.|\.internal\.|gitlab\.[a-z0-9-]+\.[a-z]+/)' \
  "Replace hostnames with example.com (RFC-2606 reserved)."

# 5. Source-skill author attributions (wordlist)
scan_wordlist \
  "Source-skill author attributions" \
  "$DATA_DIR/source-authors.txt" \
  "Drop. The artifact is now under the current author's name."

# 5b. Source-skill structural attribution patterns (regex)
scan_regex \
  "Source-skill attribution phrases (structural)" \
  '(adapted from [a-zA-Z][a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+|based on [a-zA-Z][a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+|upstream:\s*[a-zA-Z][a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+|Co-Authored-By:)' \
  "Drop the upstream attribution."

# 6. Concept-author attributions (wordlist)
scan_wordlist \
  "Concept-author attributions (drop the author, keep the concept)" \
  "$DATA_DIR/concept-authors.txt" \
  "Drop the author; keep the concept name."

# 7. Org / company names (wordlist)
scan_wordlist \
  "Org / company names" \
  "$DATA_DIR/org-names.txt" \
  "Replace with <your-org> / acme, or drop."

# 8. Internal filesystem paths (structural)
scan_regex \
  "Internal absolute filesystem paths" \
  '(/home/[a-zA-Z0-9_-]+/Work/|/Users/[a-zA-Z0-9_-]+/|C:\\Users\\)' \
  "Drop or replace with relative paths."

# 9. Stack-specific assertions (structural; high false-positive rate)
scan_regex \
  "Possible stack assertions (high false-positive rate; triage manually)" \
  '\b(we use|we run|our setup|our cluster|our stack|in our cluster|our cloud|our infra)\b' \
  "Keep only when the surrounding context is generic; mask when followed by a specific brand."

# 10. Hardcoded scale fingerprints (structural)
scan_regex \
  "Possible hardcoded scale fingerprints" \
  '\b([1-9][0-9]?\s+(namespaces|pods|replicas|HPAs|storage classes|ingresses)|10\.[0-9]+\.[0-9]+\.[0-9]+)\b' \
  "Real-looking specific numbers leak the user's actual cluster shape. Drop or use round placeholders."

# Summary
echo
echo "${BLUE}════════════════════════════════════════════${NC}"
if [[ "$total_hits" -eq 0 ]]; then
  echo "${GREEN}✓ no fingerprint patterns detected${NC}"
  echo "${BLUE}════════════════════════════════════════════${NC}"
  exit 0
else
  echo "${YELLOW}⚠ ${total_hits} potential fingerprint hits${NC}"
  echo "${BLUE}════════════════════════════════════════════${NC}"
  cat <<EOF

${BLUE}Next:${NC}
  1. Triage each hit with references/decision-matrix.md (keep vs mask).
  2. Apply replacements per references/replacement-conventions.md.
  3. Re-scan; aim for zero unintentional hits.
  4. Re-validate the artifact (its own validator / tests / build).

${BLUE}Customize the scanner:${NC}
  Wordlists live in scripts/data/. Add patterns specific to your repo:
    - data/vendor-saas.txt          (branded SaaS products)
    - data/cloud-abbreviations.txt  (vendor-specific service codes)
    - data/source-authors.txt       (your fork-source usernames)
    - data/concept-authors.txt      (book authors you cite)
    - data/org-names.txt            (your org / codenames)

${BLUE}Common false positives to expect:${NC}
  - Provider names in inclusive lists (multi-provider listings).
  - Tool names in 'e.g.' lists.
  - Industry-standard names (RFC numbers, spec names).
  - Trigger phrases in skill descriptions.
  - The actual subject of the artifact.

EOF
  exit 1
fi
