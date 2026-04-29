#!/usr/bin/env bash
# Detect which languages a repo uses, for picking pre-commit hooks.
#
# Output: space-separated list of language tags on stdout, e.g. "node python shell".
# Exit code: 0 always (empty output is a valid "unknown" answer).
#
# Tags emitted (any combination):
#   node     — package.json present
#   python   — pyproject.toml | requirements*.txt | setup.py | setup.cfg | Pipfile
#   php      — composer.json
#   java     — pom.xml | build.gradle | build.gradle.kts | settings.gradle
#   go       — go.mod
#   rust     — Cargo.toml
#   ruby     — Gemfile
#   shell    — any *.sh under tracked files
#   terraform— any *.tf under tracked files
#   markdown — any *.md under tracked files
#
# Usage from the skill:
#   tags=$(bash scripts/detect-languages.sh)
#   case " $tags " in
#     *' node '*)   echo "Has Node" ;;
#   esac

set -euo pipefail

# Run from the git toplevel so relative paths work no matter where we're invoked from.
if ! toplevel="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "error: not inside a git repository" >&2
  exit 0   # empty output, but don't crash the caller
fi
cd "$toplevel"

tags=()

# Lockfile / manifest detection (cheap; just file presence).
[[ -f package.json       ]] && tags+=("node")
[[ -f composer.json      ]] && tags+=("php")
[[ -f go.mod             ]] && tags+=("go")
[[ -f Cargo.toml         ]] && tags+=("rust")
[[ -f Gemfile            ]] && tags+=("ruby")

# Python: any of several manifests count.
if [[ -f pyproject.toml || -f setup.py || -f setup.cfg || -f Pipfile ]]; then
  tags+=("python")
elif compgen -G "requirements*.txt" >/dev/null; then
  tags+=("python")
fi

# Java: Maven or Gradle build files.
if [[ -f pom.xml || -f build.gradle || -f build.gradle.kts || -f settings.gradle || -f settings.gradle.kts ]]; then
  tags+=("java")
fi

# Shell / Terraform / Markdown: scan tracked files (limited so huge repos stay fast).
# `git ls-files` is faster and respects .gitignore; falls back to `find` if outside git.
list_tracked() {
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git ls-files
  else
    find . -type f
  fi
}

tracked="$(list_tracked)"

if grep -qE '\.sh$' <<<"$tracked"; then
  tags+=("shell")
fi
if grep -qE '\.tf$' <<<"$tracked"; then
  tags+=("terraform")
fi
if grep -qE '\.md$' <<<"$tracked"; then
  tags+=("markdown")
fi

# Print unique tags, space-separated, in a stable order.
printf '%s\n' "${tags[@]}" | awk '!seen[$0]++' | tr '\n' ' ' | sed 's/ *$//'
echo
