#!/usr/bin/env bash
# Score a Terraform module against the terraform-module-developer checklist.
#
# Usage: validate-module.sh <module-path>
#
# Checks (each pass = 1 point, total / 14 → percent):
#   1.  Module path exists and is a directory
#   2.  File count is exactly 9
#   3.  Directory count is exactly 2 (root + wrappers/)
#   4.  All 5 root files present (main.tf, variables.tf, outputs.tf, versions.tf, README.md)
#   5.  All 4 wrapper files present (wrappers/{main,variables,outputs,versions}.tf)
#   6.  No `list(any)` or `map(any)` in root variables.tf
#   7.  Every dynamic block has `iterator =`
#   8.  Every output uses `try(element(concat(...))`
#   9.  All variables in variables.tf share a common prefix
#  10.  versions.tf pins a real version (not `~>` or `latest`)
#  11.  README has BEGIN_TF_DOCS / END_TF_DOCS markers
#  12.  wrappers/variables.tf declares only `defaults` and `items`
#  13.  Resource block has `count = var.<prefix>_create ? 1 : 0`
#  14.  No extra `.tf` files (data.tf, locals.tf) in module root

set -euo pipefail

# Colors
if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

die() { printf '%serror:%s %s\n' "$RED" "$NC" "$1" >&2; exit 2; }

if [[ $# -ne 1 ]]; then
  die "usage: $(basename "$0") <module-path>"
fi

MODULE="$1"

if [[ ! -d "$MODULE" ]]; then
  die "module path is not a directory: $MODULE"
fi

passed=0
total=14
report=()

mark_pass() { passed=$((passed + 1)); report+=("✓ $1"); }
mark_fail() { report+=("✗ $1${2:+ — $2}"); }

# 1. Module path exists
mark_pass "module path exists"

# 2. File count
file_count="$(find "$MODULE" -maxdepth 2 -type f | wc -l | tr -d ' ')"
if [[ "$file_count" -eq 9 ]]; then
  mark_pass "file count = 9"
else
  mark_fail "file count = 9" "got $file_count"
fi

# 3. Directory count
dir_count="$(find "$MODULE" -maxdepth 2 -type d | wc -l | tr -d ' ')"
if [[ "$dir_count" -eq 2 ]]; then
  mark_pass "directory count = 2"
else
  mark_fail "directory count = 2" "got $dir_count"
fi

# 4. Root files present
root_missing=()
for f in main.tf variables.tf outputs.tf versions.tf README.md; do
  [[ -f "$MODULE/$f" ]] || root_missing+=("$f")
done
if [[ ${#root_missing[@]} -eq 0 ]]; then
  mark_pass "all 5 root files present"
else
  mark_fail "all 5 root files present" "missing: ${root_missing[*]}"
fi

# 5. Wrapper files present
wrap_missing=()
for f in main.tf variables.tf outputs.tf versions.tf; do
  [[ -f "$MODULE/wrappers/$f" ]] || wrap_missing+=("wrappers/$f")
done
if [[ ${#wrap_missing[@]} -eq 0 ]]; then
  mark_pass "all 4 wrapper files present"
else
  mark_fail "all 4 wrapper files present" "missing: ${wrap_missing[*]}"
fi

# 6. No list(any) / map(any) in root variables.tf (skip comment lines and heredoc descriptions)
if [[ -f "$MODULE/variables.tf" ]]; then
  # Strip comment lines, then check; this avoids false positives on docstrings
  if grep -vE '^\s*#' "$MODULE/variables.tf" | grep -qE '\b(list|map)\(any\)'; then
    mark_fail "no list(any) / map(any) in variables.tf" "use list(object({...})) with optional()"
  else
    mark_pass "no list(any) / map(any) in variables.tf"
  fi
else
  mark_fail "no list(any) / map(any) in variables.tf" "variables.tf missing"
fi

# 7. Every dynamic block has iterator =
if [[ -f "$MODULE/main.tf" ]]; then
  dyn_count="$(grep -cE '^\s*dynamic\s+"' "$MODULE/main.tf" || true)"
  iter_count="$(grep -cE '^\s*iterator\s*=' "$MODULE/main.tf" || true)"
  if [[ "$dyn_count" -eq 0 ]]; then
    mark_pass "dynamic blocks have iterator (n/a — none used)"
  elif [[ "$dyn_count" -le "$iter_count" ]]; then
    mark_pass "every dynamic block has iterator"
  else
    mark_fail "every dynamic block has iterator" "$dyn_count dynamic blocks, only $iter_count iterators"
  fi
else
  mark_fail "every dynamic block has iterator" "main.tf missing"
fi

# 8. Outputs use try(element(concat(...)))
if [[ -f "$MODULE/outputs.tf" ]]; then
  output_count="$(grep -cE '^\s*output\s+"' "$MODULE/outputs.tf" || true)"
  pattern_count="$(grep -cE 'try\s*\(\s*element\s*\(\s*concat' "$MODULE/outputs.tf" || true)"
  if [[ "$output_count" -eq 0 ]]; then
    mark_pass "outputs use try/element/concat (n/a — no outputs)"
  elif [[ "$output_count" -le "$pattern_count" ]]; then
    mark_pass "outputs use try/element/concat"
  else
    mark_fail "outputs use try/element/concat" "$output_count outputs, only $pattern_count using pattern"
  fi
else
  mark_fail "outputs use try/element/concat" "outputs.tf missing"
fi

# 9. Variable prefix consistency
if [[ -f "$MODULE/variables.tf" ]]; then
  # Extract first variable name; everything else should share the same prefix
  first_var="$(grep -oE '^variable\s+"[a-z_]+"' "$MODULE/variables.tf" | head -1 | grep -oE '"[a-z_]+"' | tr -d '"' || true)"
  if [[ -n "$first_var" ]]; then
    # Take everything before the last underscore as the prefix candidate
    prefix="${first_var%_*}"
    # Find variables that DON'T start with the prefix
    bad="$(grep -oE '^variable\s+"[a-z_]+"' "$MODULE/variables.tf" | grep -oE '"[a-z_]+"' | tr -d '"' | grep -v "^${prefix}_" || true)"
    if [[ -z "$bad" ]]; then
      mark_pass "variable prefix consistency ($prefix)"
    else
      mark_fail "variable prefix consistency" "non-prefixed: $(echo "$bad" | tr '\n' ' ')"
    fi
  else
    mark_fail "variable prefix consistency" "no variables found"
  fi
else
  mark_fail "variable prefix consistency" "variables.tf missing"
fi

# 10. versions.tf pins a real version
if [[ -f "$MODULE/versions.tf" ]]; then
  if grep -qE 'version\s*=\s*"~>' "$MODULE/versions.tf"; then
    mark_fail "versions.tf pins a real version" "uses ~> floating ref"
  elif grep -qE 'version\s*=\s*"(latest|HEAD)"' "$MODULE/versions.tf"; then
    mark_fail "versions.tf pins a real version" "uses 'latest' or 'HEAD'"
  elif grep -qE '>=\s*[0-9]+\.[0-9]+' "$MODULE/versions.tf"; then
    mark_pass "versions.tf pins a real version"
  else
    mark_fail "versions.tf pins a real version" "no >= constraint found"
  fi
else
  mark_fail "versions.tf pins a real version" "versions.tf missing"
fi

# 11. README has BEGIN_TF_DOCS / END_TF_DOCS markers
if [[ -f "$MODULE/README.md" ]]; then
  if grep -qF 'BEGIN_TF_DOCS' "$MODULE/README.md" && grep -qF 'END_TF_DOCS' "$MODULE/README.md"; then
    mark_pass "README has BEGIN_TF_DOCS / END_TF_DOCS markers"
  else
    mark_fail "README has BEGIN_TF_DOCS / END_TF_DOCS markers" "add the markers between Usage and Notes"
  fi
else
  mark_fail "README has BEGIN_TF_DOCS / END_TF_DOCS markers" "README.md missing"
fi

# 12. wrappers/variables.tf has only defaults + items, AND both are strictly typed (no `type = any`)
if [[ -f "$MODULE/wrappers/variables.tf" ]]; then
  vars="$(grep -oE '^variable\s+"[a-z_]+"' "$MODULE/wrappers/variables.tf" | grep -oE '"[a-z_]+"' | tr -d '"' | sort)"
  if [[ "$vars" == $'defaults\nitems' ]]; then
    # Now check that neither uses `type = any`
    if grep -E '^\s*type\s*=\s*any\s*$' "$MODULE/wrappers/variables.tf" >/dev/null; then
      mark_fail "wrappers/variables.tf has typed defaults + items" "uses 'type = any'; mirror root variables as optional() in object({...}) / map(object({...}))"
    else
      mark_pass "wrappers/variables.tf has typed defaults + items"
    fi
  else
    mark_fail "wrappers/variables.tf has only defaults + items" "found: $(echo "$vars" | tr '\n' ' ')"
  fi
else
  mark_fail "wrappers/variables.tf has typed defaults + items" "file missing"
fi

# 13. Resource has count = var.<prefix>_create ? 1 : 0
if [[ -f "$MODULE/main.tf" ]]; then
  if grep -qE 'count\s*=\s*var\.[a-z_]+_create\s*\?\s*1\s*:\s*0' "$MODULE/main.tf"; then
    mark_pass "resource has count = var.<prefix>_create ? 1 : 0"
  else
    mark_fail "resource has count = var.<prefix>_create ? 1 : 0" "missing or different shape"
  fi
else
  mark_fail "resource has count = var.<prefix>_create ? 1 : 0" "main.tf missing"
fi

# 14. No extra .tf files in module root
extra_root=()
while IFS= read -r f; do
  base="$(basename "$f")"
  case "$base" in
    main.tf|variables.tf|outputs.tf|versions.tf) ;;
    *) extra_root+=("$base") ;;
  esac
done < <(find "$MODULE" -maxdepth 1 -name "*.tf" -type f)
if [[ ${#extra_root[@]} -eq 0 ]]; then
  mark_pass "no extra .tf files in module root"
else
  mark_fail "no extra .tf files in module root" "extras: ${extra_root[*]}"
fi

# Report
pct=$((passed * 100 / total))
echo
echo "============================================================"
echo "Module Validation: $MODULE"
echo "============================================================"
for line in "${report[@]}"; do
  echo "$line"
done
echo "============================================================"
printf "Score: %d%% (%d / %d checks)\n" "$pct" "$passed" "$total"
echo "============================================================"

if [[ $pct -ge 90 ]]; then
  exit 0
fi
exit 1
