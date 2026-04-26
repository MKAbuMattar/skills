#!/usr/bin/env bash
#
# compute-score.sh — Aggregate Sonar + Grype + repo-policy results into a
# single 0–100 score plus a list of pass/fail policy alignments.
#
# Inputs:
#   $1   sonar-report.json   (from /api/qualitygates/project_status; can be missing → CodeQuality 0)
#   $2   grype-report.json   (from `grype -o json`; can be missing → Security 0)
#
# Outputs:
#   score.json     machine-readable: aggregate, components, alignments
#   scorecard.md   human-readable Markdown report
#
# Exit code:
#   0  always (the *gate* logic — comparing to threshold — lives in the pipeline,
#              not in this script, so re-runs and dry-runs are cheap)
#
# Tunables — override via env vars:
#   SCORE_W_QUALITY        default 0.35
#   SCORE_W_COVERAGE       default 0.25
#   SCORE_W_SECURITY       default 0.30
#   SCORE_W_HYGIENE        default 0.10
#   GITFLOW_BRANCH_REGEX   default '^(main|develop|feature/.+|release/.+|hotfix/.+)$'
#   GRYPE_CONFIG           default ./grype.yaml
#
# Cross-platform: Linux, macOS, Windows (Git Bash / WSL). Requires bash 4+, jq.

set -euo pipefail

if [ -t 1 ]; then
    GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
    GREEN=''; RED=''; YELLOW=''; NC=''
fi
readonly GREEN RED YELLOW NC

usage() {
    cat <<EOF
Usage: $(basename "$0") [-h|--help] [<sonar-report.json>] [<grype-report.json>]

Aggregate Sonar + Grype + repo-policy results into a 0–100 score plus
pass/fail policy alignments. Writes score.json and scorecard.md to the
current directory.

ARGUMENTS:
    sonar-report.json   default 'sonar-report.json'  (missing → CodeQuality 0)
    grype-report.json   default 'grype-report.json'  (missing → Security 0)

OPTIONS:
    -h, --help          Show this help and exit

ENV TUNABLES:
    SCORE_W_QUALITY     default 0.35
    SCORE_W_COVERAGE    default 0.25
    SCORE_W_SECURITY    default 0.30
    SCORE_W_HYGIENE     default 0.10
    GITFLOW_BRANCH_REGEX default '^(main|develop|feature/.+|release/.+|hotfix/.+)\$'
    GRYPE_CONFIG        default './grype.yaml'

EXIT CODES:
    0   always (gate logic — comparing to threshold — lives in the pipeline,
        not here, so re-runs and dry-runs are cheap)

EXAMPLES:
    $(basename "$0") sonar-report.json grype-report.json
    SCORE_W_SECURITY=0.50 $(basename "$0")
EOF
    exit "${1:-0}"
}

case "${1:-}" in -h|--help) usage 0 ;; esac

SONAR_REPORT="${1:-sonar-report.json}"
GRYPE_REPORT="${2:-grype-report.json}"

W_Q="${SCORE_W_QUALITY:-0.35}"
W_C="${SCORE_W_COVERAGE:-0.25}"
W_S="${SCORE_W_SECURITY:-0.30}"
W_H="${SCORE_W_HYGIENE:-0.10}"

BRANCH_REGEX="${GITFLOW_BRANCH_REGEX:-^(main|develop|feature/.+|release/.+|hotfix/.+)$}"
GRYPE_CFG="${GRYPE_CONFIG:-grype.yaml}"

# ─── Helpers ─────────────────────────────────────────────────────────────
require() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: $1 not in PATH" >&2; exit 1; }; }
require jq

clamp() {
    local v="$1" lo="$2" hi="$3"
    awk -v v="$v" -v lo="$lo" -v hi="$hi" 'BEGIN{ if(v<lo)v=lo; if(v>hi)v=hi; printf("%.2f", v) }'
}

floor_int() { awk -v v="$1" 'BEGIN{ printf("%d", int(v+0.0001)) }'; }

main() {
# ─── 1. CodeQuality (from Sonar JSON) ────────────────────────────────────
quality_score=0
coverage_score=0

if [ -f "$SONAR_REPORT" ]; then
    # Each Sonar metric is in projectStatus.conditions[]. The fields we care
    # about have metricKey of new_*_rating / new_coverage / new_duplicated_lines_density.
    # Ratings: 1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E.
    rating_map='{"1":100,"2":80,"3":60,"4":40,"5":20}'

    rel=$(jq -r --argjson m "$rating_map" '
        (.projectStatus.conditions[]? | select(.metricKey=="new_reliability_rating") | .actualValue) // "1"
        | $m[.] // 100' "$SONAR_REPORT")
    sec=$(jq -r --argjson m "$rating_map" '
        (.projectStatus.conditions[]? | select(.metricKey=="new_security_rating") | .actualValue) // "1"
        | $m[.] // 100' "$SONAR_REPORT")
    main=$(jq -r --argjson m "$rating_map" '
        (.projectStatus.conditions[]? | select(.metricKey=="new_maintainability_rating") | .actualValue) // "1"
        | $m[.] // 100' "$SONAR_REPORT")
    dup_pct=$(jq -r '
        (.projectStatus.conditions[]? | select(.metricKey=="new_duplicated_lines_density") | .actualValue) // "0"
        ' "$SONAR_REPORT")
    cov_pct=$(jq -r '
        (.projectStatus.conditions[]? | select(.metricKey=="new_coverage") | .actualValue) // "0"
        ' "$SONAR_REPORT")

    dup_score=$(awk -v d="$dup_pct" 'BEGIN{ s=(1 - d/10.0)*100; if(s<0)s=0; if(s>100)s=100; printf("%.2f", s) }')
    quality_score=$(awk -v r="$rel" -v s="$sec" -v m="$main" -v d="$dup_score" \
        'BEGIN{ printf("%.2f",(r+s+m+d)/4.0) }')

    # Coverage piecewise-linear: 0→0, 50→30, 70→60, 80→80, 90+→100.
    coverage_score=$(awk -v c="$cov_pct" 'BEGIN{
        if(c<=0)            s=0;
        else if(c<=50)      s=30 * c/50;
        else if(c<=70)      s=30 + 30 * (c-50)/20;
        else if(c<=80)      s=60 + 20 * (c-70)/10;
        else if(c<=90)      s=80 + 20 * (c-80)/10;
        else                s=100;
        printf("%.2f", s)
    }')
else
    echo "WARN: $SONAR_REPORT not found — CodeQuality and Coverage default to 0" >&2
fi

# ─── 2. Security (from Grype JSON) ────────────────────────────────────────
crit=0; high=0; med=0; low=0
security_score=0

if [ -f "$GRYPE_REPORT" ]; then
    crit=$(jq '[.matches[]? | select(.vulnerability.severity=="Critical")] | length' "$GRYPE_REPORT")
    high=$(jq '[.matches[]? | select(.vulnerability.severity=="High")]     | length' "$GRYPE_REPORT")
    med=$( jq '[.matches[]? | select(.vulnerability.severity=="Medium")]   | length' "$GRYPE_REPORT")
    low=$( jq '[.matches[]? | select(.vulnerability.severity=="Low")]      | length' "$GRYPE_REPORT")

    security_score=$(awk -v c="$crit" -v h="$high" -v m="$med" -v l="$low" 'BEGIN{
        # Any critical zeros the score.
        cmin=(c>=1)?1:0;
        s=100 - 100*cmin - 25*h - 5*m - 1*l;
        if(s<0) s=0; if(s>100) s=100;
        printf("%.2f", s)
    }')
else
    echo "WARN: $GRYPE_REPORT not found — Security defaults to 0" >&2
fi

# ─── 3. ReleaseHygiene (repo policy probes, 20 pts each) ──────────────────
hygiene=0
hyg_cc_pct=0
hyg_changelog=false
hyg_signed=false
hyg_branch=false
hyg_squashed=false

# 3a. Last 50 commits ≥ 90% Conventional Commits.
if git rev-parse --git-dir >/dev/null 2>&1; then
    total=$(git log -50 --pretty=%s 2>/dev/null | wc -l | tr -d ' ')
    if [ "$total" -gt 0 ]; then
        ok=$(git log -50 --pretty=%s 2>/dev/null \
            | grep -cE '^(feat|fix|perf|refactor|docs|test|build|ci|chore|revert|style)(\([^)]+\))?!?: .+' \
            || true)
        hyg_cc_pct=$(awk -v o="$ok" -v t="$total" 'BEGIN{ printf("%d", (o*100)/t) }')
        [ "$hyg_cc_pct" -ge 90 ] && hygiene=$((hygiene + 20))
    fi
fi

# 3b. CHANGELOG.md exists and was touched in the last 30 days.
if [ -f CHANGELOG.md ]; then
    if [ -n "$(find CHANGELOG.md -mtime -30 2>/dev/null)" ]; then
        hyg_changelog=true
        hygiene=$((hygiene + 20))
    fi
fi

# 3c. Image was signed in this run (cosign produced a signature reference).
if [ -f image.digest ] && command -v cosign >/dev/null 2>&1; then
    DIGEST=$(cat image.digest)
    if cosign verify --key "${COSIGN_PUBLIC_KEY:-/dev/null}" "${FULL_IMAGE:-localhost/x}@${DIGEST}" >/dev/null 2>&1; then
        hyg_signed=true
        hygiene=$((hygiene + 20))
    fi
fi

# 3d. Branch matches the Gitflow regex.
if git rev-parse --git-dir >/dev/null 2>&1; then
    branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    if [ -n "$branch" ] && printf '%s' "$branch" | grep -qE "$BRANCH_REGEX"; then
        hyg_branch=true
        hygiene=$((hygiene + 20))
    fi
fi

# 3e. Last merge commit was a squash or rebase (no second parent).
if git rev-parse --git-dir >/dev/null 2>&1; then
    parents=$(git log -1 --pretty=%P HEAD 2>/dev/null | wc -w | tr -d ' ')
    if [ "$parents" -le 1 ]; then
        hyg_squashed=true
        hygiene=$((hygiene + 20))
    fi
fi

# ─── 4. Aggregate ─────────────────────────────────────────────────────────
aggregate=$(awk -v q="$quality_score" -v c="$coverage_score" -v s="$security_score" -v h="$hygiene" \
    -v wq="$W_Q" -v wc="$W_C" -v ws="$W_S" -v wh="$W_H" \
    'BEGIN{ printf("%.2f", q*wq + c*wc + s*ws + h*wh) }')
aggregate_int=$(floor_int "$aggregate")

# ─── 5. Alignments (pass / fail) ──────────────────────────────────────────
alignments_passed=0
alignments_failed=0
alignment_lines=()

check_align() {
    local name="$1" passed="$2" detail="${3:-}"
    if [ "$passed" = "true" ]; then
        alignments_passed=$((alignments_passed + 1))
        alignment_lines+=("- ✅ ${name}${detail:+ (${detail})}")
    else
        alignments_failed=$((alignments_failed + 1))
        alignment_lines+=("- ❌ ${name}${detail:+ (${detail})}")
    fi
}

# License present
if [ -f LICENSE ] || [ -f LICENSE.md ] || [ -f LICENSE.txt ]; then
    check_align "LICENSE file present" true
else
    check_align "LICENSE file present" false
fi

# README has a Pipeline section
if [ -f README.md ] && grep -qE '^## *Pipeline' README.md; then
    check_align "README has a Pipeline section" true
else
    check_align "README has a Pipeline section" false
fi

# Conventional commits ≥ 90%
if [ "$hyg_cc_pct" -ge 90 ]; then
    check_align "Last 50 commits ≥ 90% Conventional" true "${hyg_cc_pct}%"
else
    check_align "Last 50 commits ≥ 90% Conventional" false "${hyg_cc_pct}% — below 90%"
fi

# Branch matches Gitflow regex
if [ "$hyg_branch" = "true" ]; then
    check_align "Branch follows Gitflow regex" true "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
else
    check_align "Branch follows Gitflow regex" false "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
fi

# Image signed
if [ "$hyg_signed" = "true" ]; then
    check_align "Image is signed by cosign" true
else
    check_align "Image is signed by cosign" false "no verifiable signature"
fi

# SBOM exists
if [ -s sbom.cdx.json ]; then
    check_align "SBOM exists for this build" true
else
    check_align "SBOM exists for this build" false "sbom.cdx.json missing or empty"
fi

# No CVEs ignored without a comment in grype.yaml
if [ -f "$GRYPE_CFG" ]; then
    total_ignores=$(grep -cE '^\s*-\s*vulnerability:' "$GRYPE_CFG" || true)
    commented=$(awk '/^\s*#/{c=NR; next} /^\s*-\s*vulnerability:/{ if(NR-c<=2) hit++ } END{print hit+0}' "$GRYPE_CFG")
    if [ "$total_ignores" -eq 0 ] || [ "$commented" -eq "$total_ignores" ]; then
        check_align "No CVEs ignored without comment" true "$total_ignores ignores, all annotated"
    else
        check_align "No CVEs ignored without comment" false "$((total_ignores - commented)) without comment"
    fi
else
    check_align "No CVEs ignored without comment" true "no grype.yaml"
fi

# Squashed/rebased merges only
if [ "$hyg_squashed" = "true" ]; then
    check_align "HEAD is a squashed/rebased merge" true
else
    check_align "HEAD is a squashed/rebased merge" false "HEAD has multiple parents"
fi

# ─── 6. Write JSON ────────────────────────────────────────────────────────
cat > score.json <<JSON
{
  "aggregate": ${aggregate_int},
  "aggregate_raw": ${aggregate},
  "components": {
    "code_quality":   ${quality_score},
    "coverage":       ${coverage_score},
    "security":       ${security_score},
    "release_hygiene": ${hygiene}
  },
  "weights": {
    "code_quality":    ${W_Q},
    "coverage":        ${W_C},
    "security":        ${W_S},
    "release_hygiene": ${W_H}
  },
  "vulnerabilities": {
    "critical": ${crit},
    "high":     ${high},
    "medium":   ${med},
    "low":      ${low}
  },
  "alignments_passed": ${alignments_passed},
  "alignments_failed": ${alignments_failed}
}
JSON

# ─── 7. Write Markdown scorecard ──────────────────────────────────────────
verdict_line=""
if [ "$alignments_failed" -gt 0 ]; then
    verdict_line="**Result:** ❌ Failing — ${alignments_failed} alignment check(s) failed."
elif [ "$aggregate_int" -lt 70 ]; then
    verdict_line="**Result:** ❌ Failing — score ${aggregate_int} < 70 threshold."
else
    verdict_line="**Result:** ✅ Passing."
fi

{
    echo "# Build Scorecard"
    echo
    echo "## Score: **${aggregate_int} / 100**"
    echo
    echo "| Axis           | Score  | Weight | Contribution |"
    echo "| -------------- | ------ | ------ | ------------ |"
    awk -v q="$quality_score"  -v wq="$W_Q" 'BEGIN{ printf("| CodeQuality    | %5.1f  | %.2f  | %5.1f        |\n", q,  wq, q*wq) }'
    awk -v c="$coverage_score" -v wc="$W_C" 'BEGIN{ printf("| Coverage       | %5.1f  | %.2f  | %5.1f        |\n", c,  wc, c*wc) }'
    awk -v s="$security_score" -v ws="$W_S" 'BEGIN{ printf("| Security       | %5.1f  | %.2f  | %5.1f        |\n", s,  ws, s*ws) }'
    awk -v h="$hygiene"        -v wh="$W_H" 'BEGIN{ printf("| ReleaseHygiene | %5.1f  | %.2f  | %5.1f        |\n", h,  wh, h*wh) }'
    echo "| **Total**      |        |        | **${aggregate}**     |"
    echo
    echo "## Vulnerabilities (Grype)"
    echo
    echo "| Severity | Count |"
    echo "| -------- | ----- |"
    echo "| Critical | ${crit} |"
    echo "| High     | ${high} |"
    echo "| Medium   | ${med}  |"
    echo "| Low      | ${low}  |"
    echo
    echo "## Alignments (${alignments_passed} of $((alignments_passed + alignments_failed)) passing)"
    echo
    for line in "${alignment_lines[@]}"; do echo "$line"; done
    echo
    echo "$verdict_line"
} > scorecard.md

# ─── 8. Print summary to stdout ───────────────────────────────────────────
if [ "$alignments_failed" -gt 0 ]; then
    color="$RED"
elif [ "$aggregate_int" -ge 70 ]; then
    color="$GREEN"
else
    color="$YELLOW"
fi

echo
echo "============================================================"
echo "Build Scorecard"
echo "============================================================"
printf "Score:           %b%s/100%b\n" "$color" "$aggregate_int" "$NC"
printf "  CodeQuality:   %5.1f × %s = %5.1f\n" "$quality_score"  "$W_Q" "$(awk -v q="$quality_score" -v w="$W_Q" 'BEGIN{printf("%.1f",q*w)}')"
printf "  Coverage:      %5.1f × %s = %5.1f\n" "$coverage_score" "$W_C" "$(awk -v q="$coverage_score" -v w="$W_C" 'BEGIN{printf("%.1f",q*w)}')"
printf "  Security:      %5.1f × %s = %5.1f\n" "$security_score" "$W_S" "$(awk -v q="$security_score" -v w="$W_S" 'BEGIN{printf("%.1f",q*w)}')"
printf "  ReleaseHyg.:   %5.1f × %s = %5.1f\n" "$hygiene"        "$W_H" "$(awk -v q="$hygiene"        -v w="$W_H" 'BEGIN{printf("%.1f",q*w)}')"
echo
echo "Vulnerabilities: critical=${crit} high=${high} medium=${med} low=${low}"
echo "Alignments:      ${alignments_passed} passed, ${alignments_failed} failed"
echo "============================================================"
echo "Outputs: score.json, scorecard.md"
}

main "$@"
