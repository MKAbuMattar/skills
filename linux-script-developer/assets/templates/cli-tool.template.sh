#!/usr/bin/env bash

# {{TOOL_NAME}} - {{TOOL_DESCRIPTION}}
# A robust CLI tool with subcommands

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
readonly SCRIPT_NAME="$(basename "$0")"

VERBOSE=false
DRY_RUN=false

usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS] <command> [ARGS]

{{TOOL_DESCRIPTION}}

COMMANDS:
    init        Initialize configuration
    build       Build artifacts
    deploy      Deploy artifacts
    clean       Clean up resources
    status      Show status

OPTIONS:
    -h, --help      Show this help message
    -v, --verbose   Verbose output
    -n, --dry-run   Dry run mode (don't make changes)
    -e, --env       Environment (dev|staging|prod)

EXAMPLES:
    $SCRIPT_NAME init
    $SCRIPT_NAME build --env prod
    $SCRIPT_NAME deploy --dry-run --env staging

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
error() { log "$RED" "✗ $*" >&2; exit 1; }

cmd_init() {
    info "Initializing configuration..."

    if [ "$DRY_RUN" = true ]; then
        warn "DRY RUN: Would create configuration"
        return 0
    fi

    # Implementation
    # mkdir -p config
    # touch config/settings.yaml

    success "Initialized successfully"
}

cmd_build() {
    local env="${1:-dev}"

    info "Building for environment: $env"

    if [ "$DRY_RUN" = true ]; then
        warn "DRY RUN: Would build artifacts for $env"
        return 0
    fi

    # Implementation
    # Your build logic here

    success "Build completed"
}

cmd_deploy() {
    local env="${1:-dev}"

    info "Deploying to environment: $env"

    if [ "$DRY_RUN" = true ]; then
        warn "DRY RUN: Would deploy to $env"
        return 0
    fi

    # Confirm production deploys
    if [ "$env" = "prod" ]; then
        warn "About to deploy to PRODUCTION"
        read -p "Are you sure? (yes/no): " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            error "Deployment cancelled"
        fi
    fi

    # Implementation
    # Your deploy logic here

    success "Deployed to $env"
}

cmd_clean() {
    info "Cleaning up resources..."

    if [ "$DRY_RUN" = true ]; then
        warn "DRY RUN: Would clean up resources"
        return 0
    fi

    # Implementation
    # rm -rf build/
    # rm -rf dist/

    success "Cleaned up"
}

cmd_status() {
    info "Checking status..."

    # Implementation
    # Check various status indicators

    echo "Status: OK"
}

main() {
    local command=""
    local env="dev"

    # Parse global options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -e|--env)
                env="$2"
                shift 2
                ;;
            init|build|deploy|clean|status)
                command="$1"
                shift
                break
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done

    # Validate command
    if [ -z "$command" ]; then
        error "Command required. Use -h for help."
    fi

    # Validate environment
    if [[ ! "$env" =~ ^(dev|staging|prod)$ ]]; then
        error "Invalid environment: $env (must be dev, staging, or prod)"
    fi

    # Execute command
    case "$command" in
        init)
            cmd_init
            ;;
        build)
            cmd_build "$env"
            ;;
        deploy)
            cmd_deploy "$env"
            ;;
        clean)
            cmd_clean
            ;;
        status)
            cmd_status
            ;;
        *)
            error "Unknown command: $command"
            ;;
    esac
}

main "$@"
