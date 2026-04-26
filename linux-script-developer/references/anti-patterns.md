# Bash Anti-Patterns

Load this when reviewing or refactoring an existing script, or before finalizing one you wrote. Each item shows the broken form and the fix, with the reason it matters.

## 1. No error handling

```bash
# BAD — failures pile up silently
#!/bin/bash
mkdir build
cp src/* build/
make

# GOOD
#!/usr/bin/env bash
set -euo pipefail
mkdir build
cp src/* build/
make
```

Without `set -e`, a `cp` failure won't stop the build, and you'll only find out when something downstream blows up with a confusing error.

## 2. Unquoted variables

```bash
# BAD — breaks on spaces, glob characters, or empty values
file=$1
cat $file

# GOOD
file="$1"
cat "$file"
```

`$1` containing `My Documents/file.txt` becomes three arguments to `cat` without quoting.

## 3. Hardcoded absolute paths

```bash
# BAD — only works on the author's machine
cd /home/alex/projects/myapp

# GOOD — relative to the script, with env-var override
cd "${SCRIPT_DIR}/.."
# or
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"
```

## 4. Missing input validation

```bash
# BAD — fails with "unbound variable" or creates a directory called "-rf"
PROJECT_NAME=$1
mkdir "$PROJECT_NAME"

# GOOD
if [ -z "${1:-}" ]; then
    echo "Error: PROJECT_NAME required" >&2
    usage 1
fi
PROJECT_NAME="$1"

# Reject suspicious values
[[ "$PROJECT_NAME" =~ ^[a-zA-Z0-9_-]+$ ]] \
    || { echo "Invalid name: $PROJECT_NAME" >&2; exit 2; }

mkdir -p "$PROJECT_NAME"
```

## 5. Silent destructive operations

```bash
# BAD — no warning, no confirmation
rm -rf /important/data

# GOOD — explicit confirmation, opt-out via flag
if [ "${FORCE:-false}" != "true" ]; then
    read -p "About to delete /important/data. Continue? (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled"; exit 0; }
fi
rm -rf /important/data
```

## 6. `eval` and unsafe `bash -c` with user input

```bash
# BAD — command injection if $USER_INPUT is "; rm -rf ~"
eval "echo $USER_INPUT"

# GOOD — pass as data, not code
printf '%s\n' "$USER_INPUT"
```

If you must run user-provided commands, use an explicit allowlist.

## 7. Ignoring exit codes after `&&` / `||` chains

```bash
# BAD — looks like it handles failure but exits 0 anyway
deploy && notify || echo "deploy failed"

# GOOD — propagate the failure
if ! deploy; then
    echo "deploy failed" >&2
    notify_failure
    exit 1
fi
notify_success
```

## 8. Monolithic scripts

```bash
# BAD — 200 lines of top-level code
echo "starting"
# ... lots of logic ...

# GOOD — small functions composed by main()
init()    { ...; }
build()   { ...; }
deploy()  { ...; }

main() {
    init
    build
    deploy
}
main "$@"
```

## 9. Color codes always on

```bash
# BAD — pollutes piped output and CI logs with \033[...
echo -e "\033[0;32m✓ done\033[0m"

# GOOD — only colorize a real terminal
if [ -t 1 ]; then
    GREEN='\033[0;32m'; NC='\033[0m'
else
    GREEN=''; NC=''
fi
echo -e "${GREEN}✓ done${NC}"
```

## 10. GNU-only flags without a fallback

```bash
# BAD — fails on macOS, BSD, busybox
sed -i 's/a/b/' file
grep -P '\d+' file
readlink -f script.sh

# GOOD — portable equivalents
sed -i'' -e 's/a/b/' file       # works on macOS and Linux
grep -E '[0-9]+' file
"$(cd "$(dirname "$0")" && pwd)"
```

See `cross-platform.md` for the full list.
