#!/usr/bin/env bash

# {{SCRIPT_NAME}} - {{SCRIPT_DESCRIPTION}}
# Version: 1.0
# Author: {{AUTHOR}}

set -euo pipefail

# Color definitions — only emit ANSI codes when stdout is a real terminal,
# so piped/CI logs stay clean.
if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
readonly RED GREEN YELLOW BLUE NC

# Script configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"

# Global variables
VERBOSE=false

#######################################
# Display usage information
# Globals:
#   SCRIPT_NAME
# Arguments:
#   None
# Returns:
#   None
#######################################
usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS] <arguments>

{{SCRIPT_DESCRIPTION}}

OPTIONS:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output

EXAMPLES:
    $SCRIPT_NAME arg1 arg2
    $SCRIPT_NAME --verbose arg1

EOF
    exit 0
}

#######################################
# Log message with color
# Arguments:
#   $1 - Color code
#   $2 - Message
# Returns:
#   None
#######################################
log() {
    local color="$1"
    shift
    echo -e "${color}$*${NC}"
}

#######################################
# Log info message
# Arguments:
#   $* - Message
# Returns:
#   None
#######################################
info() {
    log "$BLUE" "ℹ $*"
}

#######################################
# Log success message
# Arguments:
#   $* - Message
# Returns:
#   None
#######################################
success() {
    log "$GREEN" "✓ $*"
}

#######################################
# Log warning message
# Arguments:
#   $* - Message
# Returns:
#   None
#######################################
warn() {
    log "$YELLOW" "⚠ $*"
}

#######################################
# Log error message and exit
# Arguments:
#   $* - Message
# Returns:
#   Exits with code 1
#######################################
error() {
    log "$RED" "✗ $*" >&2
    exit 1
}

#######################################
# Main script logic
# Globals:
#   VERBOSE
# Arguments:
#   $@ - Command line arguments
# Returns:
#   0 on success, non-zero on error
#######################################
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            *)
                # Positional argument
                break
                ;;
        esac
    done

    # Validate required arguments
    if [ "$#" -lt 1 ]; then
        error "Missing required arguments. Use -h for help."
    fi

    # Your script logic here
    info "Starting script..."

    # Example: Process arguments
    local arg1="$1"

    if [ "$VERBOSE" = true ]; then
        info "Verbose mode enabled"
        info "Argument 1: $arg1"
    fi

    # Do work
    # ...

    success "Script completed successfully"
}

# Run main function
main "$@"
