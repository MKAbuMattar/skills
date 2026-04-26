#!/usr/bin/env bash

# {{PROCESSOR_NAME}} - {{PROCESSOR_DESCRIPTION}}
# Process multiple files with validation

set -euo pipefail

# Color definitions — only emit ANSI codes when stdout is a real terminal,
# so piped/CI logs stay clean.
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
readonly RED GREEN YELLOW BLUE NC

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VERBOSE=false
OUTPUT_DIR="./output"

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] <file1> [file2 ...]

{{PROCESSOR_DESCRIPTION}}

OPTIONS:
    -h, --help          Show this help message
    -v, --verbose       Verbose output
    -o, --output DIR    Output directory (default: ./output)

EXAMPLES:
    $(basename "$0") file1.txt file2.txt
    $(basename "$0") --output /tmp/processed *.txt

EOF
    exit 0
}

log() {
    local color="$1"
    shift
    echo -e "${color}$*${NC}"
}

info() { log "$BLUE" "ℹ $*"; }
success() { log "$GREEN" "✓ $*"; }
warn() { log "$YELLOW" "⚠ $*"; }
error() { log "$RED" "✗ $*" >&2; }

process_file() {
    local file="$1"
    local output_file="${OUTPUT_DIR}/$(basename "$file")"

    if [ ! -f "$file" ]; then
        error "File not found: $file"
        return 1
    fi

    if [ ! -r "$file" ]; then
        error "File not readable: $file"
        return 1
    fi

    if [ "$VERBOSE" = true ]; then
        info "Processing: $file"
    fi

    # Validate file content
    local line_count=$(wc -l < "$file")
    if [ "$line_count" -eq 0 ]; then
        warn "Skipping empty file: $file"
        return 0
    fi

    # Process the file
    # Example: Convert to uppercase and add line numbers
    awk '{print NR": "toupper($0)}' "$file" > "$output_file"

    if [ "$VERBOSE" = true ]; then
        info "  Lines processed: $line_count"
        info "  Output: $output_file"
    fi

    return 0
}

main() {
    local files=()

    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -o|--output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -*)
                error "Unknown option: $1"
                ;;
            *)
                files+=("$1")
                shift
                ;;
        esac
    done

    # Validate arguments
    if [ "${#files[@]}" -eq 0 ]; then
        error "No files specified. Use -h for help."
    fi

    # Create output directory
    if [ ! -d "$OUTPUT_DIR" ]; then
        info "Creating output directory: $OUTPUT_DIR"
        mkdir -p "$OUTPUT_DIR" || error "Failed to create output directory"
    fi

    # Process files
    info "Processing ${#files[@]} file(s)..."

    local processed=0
    local failed=0

    for file in "${files[@]}"; do
        if process_file "$file"; then
            ((processed++))
        else
            ((failed++))
        fi
    done

    # Summary
    echo ""
    success "Processed: $processed file(s)"

    if [ $failed -gt 0 ]; then
        error "Failed: $failed file(s)"
        exit 1
    fi

    info "Output directory: $OUTPUT_DIR"
}

main "$@"
