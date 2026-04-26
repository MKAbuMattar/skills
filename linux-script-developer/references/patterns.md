# Bash Patterns

Detailed patterns for production Bash. Load on demand from `SKILL.md` when implementing the matching case.

## Error handling

```bash
# Minimum: exit on error, undefined var, or pipe failure
set -euo pipefail

# Cleanup with trap
trap 'cleanup' EXIT ERR
cleanup() {
    rm -f "${TMPFILE:-}"
}

# Inline error guard with custom message
command1 || { echo "command1 failed" >&2; exit 1; }
```

`-e` does not catch failures inside `||`, `&&`, or `if` conditions — that is intentional, but means you must handle expected failures explicitly.

## Argument parsing

### `getopts` (short options only, POSIX)

```bash
VERBOSE=false
OUTPUT=""

while getopts "hvo:" opt; do
    case $opt in
        h) usage 0 ;;
        v) VERBOSE=true ;;
        o) OUTPUT="$OPTARG" ;;
        \?) echo "Invalid option: -$OPTARG" >&2; exit 2 ;;
    esac
done
shift $((OPTIND-1))
```

### Manual loop (long options, mixed flags)

```bash
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)    usage 0 ;;
        -v|--verbose) VERBOSE=true; shift ;;
        -o|--output)  OUTPUT="$2"; shift 2 ;;
        --)           shift; break ;;
        -*)           echo "Unknown option: $1" >&2; exit 2 ;;
        *)            break ;;
    esac
done
```

## Colored user feedback

```bash
# Detect TTY once at startup so the rest of the script stays clean
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

info()    { echo -e "${BLUE}ℹ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}" >&2; }
error()   { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }
```

Send `warn`/`error` to stderr — that way `success` output stays parseable when the script is piped.

## Safe path handling

```bash
# Script's own directory (works when sourced or executed)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CONFIG_FILE="${SCRIPT_DIR}/config.yaml"

# Make required directories idempotently
mkdir -p "${OUTPUT_DIR}"

# Validate before reading
[ -f "$CONFIG_FILE" ] || { echo "Config not found: $CONFIG_FILE" >&2; exit 1; }
```

## Template substitution

```bash
process_template() {
    local input="$1" output="$2"
    [ -f "$input" ] || { echo "Template missing: $input" >&2; return 1; }

    sed -e "s/{{VAR1}}/${VALUE1}/g" \
        -e "s/{{VAR2}}/${VALUE2}/g" \
        "$input" > "$output"
}
```

If `$VALUE` may contain `/`, switch the `sed` delimiter: `sed "s|{{PATH}}|${VALUE}|g"`.

## Functions

```bash
# Returns 0/1 — use as a boolean
has_command() {
    command -v "$1" >/dev/null 2>&1
}

# Returns text via stdout
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

has_command terraform || error "terraform not installed"
NOW="$(timestamp)"
```

## Loops and conditionals

```bash
# Iterate matching files (handles "no matches" via nullglob)
shopt -s nullglob
for file in "${DIR}"/*.txt; do
    process_file "$file"
done
shopt -u nullglob

# Read a file line by line
while IFS= read -r line; do
    process_line "$line"
done < "$INPUT"

# Numeric range
for i in {1..10}; do
    echo "Iteration $i"
done

# Regex test
if [[ "$VAR" =~ ^[0-9]+$ ]]; then
    echo "VAR is numeric"
fi
```

`IFS=` and `read -r` together preserve leading/trailing whitespace and prevent backslash interpretation.

## Confirmation prompts

```bash
read -p "About to delete $TARGET. Continue? (y/N): " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled"; exit 0; }
```

For non-interactive callers, expose a `--yes`/`--force` flag that bypasses the prompt.

## Common idioms reference

| Pattern               | Use                            |
| --------------------- | ------------------------------ |
| `${var:-default}`     | Use `default` if unset/empty   |
| `${var:=default}`     | Set `var` to `default` if unset|
| `${var#prefix}`       | Strip shortest matching prefix |
| `${var%suffix}`       | Strip shortest matching suffix |
| `${var//old/new}`     | Replace all occurrences        |
| `[ -f "$f" ]`         | File exists                    |
| `[ -d "$d" ]`         | Directory exists               |
| `[ -x "$c" ]`         | Executable                     |
| `[ -t 1 ]`            | Stdout is a terminal           |
| `mktemp -t pfx.XXXXXX`| Portable temp file             |
