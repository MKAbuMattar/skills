#!/usr/bin/env bash

# Example: scaffold-module.sh - demonstrates bash best practices
# This is a reference implementation extracted from infra-developer

set -euo pipefail

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
readonly RED GREEN YELLOW BLUE NC

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    cat << EOF
Usage: $(basename "$0") <service> <resource-name> [provider] [version]

Create a Terraform module with proper structure.

ARGUMENTS:
    service         Service name (e.g., vpc, network, storage)
    resource-name   Resource name (e.g., vpc-subnet)
    provider        Provider name (default: aws)
    version         Provider version (default: 5.0)

EXAMPLES:
    $(basename "$0") vpc vpc-subnet
    $(basename "$0") vpc vpc-subnet aws 5.0

EOF
    exit 0
}

log_info() { echo -e "${BLUE}$*${NC}"; }
log_success() { echo -e "${GREEN}✓ $*${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
log_error() { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

process_template() {
    local input_file="$1"
    local output_file="$2"

    if [ ! -f "$input_file" ]; then
        log_error "Template not found: $input_file"
    fi

    sed -e "s/{{SERVICE}}/${SERVICE}/g" \
        -e "s/{{RESOURCE}}/${RESOURCE_NAME}/g" \
        -e "s/{{PROVIDER}}/${PROVIDER}/g" \
        -e "s/{{VERSION}}/${VERSION}/g" \
        "$input_file" > "$output_file"
}

main() {
    # Validate arguments
    if [ "$#" -lt 2 ]; then
        log_error "Missing required arguments"
    fi

    local SERVICE="$1"
    local RESOURCE_NAME="$2"
    local PROVIDER="${3:-aws}"
    local VERSION="${4:-5.0}"

    local MODULE_PATH="modules/${SERVICE}/${RESOURCE_NAME}"

    log_info "Creating module: ${SERVICE}/${RESOURCE_NAME}"
    log_info "  Provider: ${PROVIDER} >= ${VERSION}"
    echo ""

    # Create structure
    log_info "Creating directory structure..."
    mkdir -p "${MODULE_PATH}/wrappers"

    # Process templates
    log_info "Generating files from templates..."
    # In real implementation, would process actual templates

    log_success "Module created successfully!"

    # Show next steps
    echo ""
    log_info "Next steps:"
    echo "  1. Update ${MODULE_PATH}/main.tf with actual resource definition"
    echo "  2. Add proper variable types to ${MODULE_PATH}/variables.tf"
    echo "  3. Run: cd ${MODULE_PATH} && terraform fmt"
    echo "  4. Validate with: terraform validate"
}

# Handle help flag
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
fi

main "$@"
