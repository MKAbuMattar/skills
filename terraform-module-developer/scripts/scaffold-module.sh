#!/usr/bin/env bash
# Scaffold a Terraform module with the strict 8-file pattern.
#
# Usage: scaffold-module.sh <service> <resource> [provider] [provider-version] [target-dir]
#
# Examples:
#   scaffold-module.sh vpc subnet
#   scaffold-module.sh storage bucket aws 5.50.0
#   scaffold-module.sh compute instance google 6.0.0 ./modules
#
# Defaults:
#   provider          = aws
#   provider-version  = 5.0.0
#   target-dir        = ./modules
#
# Provider source mapping (extend as needed):
#   aws           → hashicorp/aws
#   azurerm       → hashicorp/azurerm
#   google        → hashicorp/google
#   huaweicloud   → huaweicloud/huaweicloud
#   oci           → oracle/oci
#   digitalocean  → digitalocean/digitalocean
#   cloudflare    → cloudflare/cloudflare
#   kubernetes    → hashicorp/kubernetes
#   helm          → hashicorp/helm
#   <other>       → <other>/<other>

set -euo pipefail

# Colors
if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

die() { printf '%serror:%s %s\n' "$RED" "$NC" "$1" >&2; exit 1; }
info() { printf '%s%s%s\n' "$BLUE" "$1" "$NC"; }
ok() { printf '%s✓%s %s\n' "$GREEN" "$NC" "$1"; }

# Args
if [[ $# -lt 2 ]]; then
  cat >&2 <<EOF
${RED}error:${NC} missing required arguments

Usage: $(basename "$0") <service> <resource> [provider] [provider-version] [target-dir]

Examples:
  $(basename "$0") vpc subnet
  $(basename "$0") storage bucket aws 5.50.0
  $(basename "$0") compute instance google 6.0.0 ./modules
EOF
  exit 2
fi

SERVICE="$1"
RESOURCE_NAME="$2"
PROVIDER="${3:-aws}"
PROVIDER_VERSION="${4:-5.0.0}"
TARGET_DIR="${5:-./modules}"

# Derive variable prefix (replace hyphens with underscores)
RESOURCE_VAR="${SERVICE}_${RESOURCE_NAME//-/_}"
MODULE_PATH="${TARGET_DIR}/${SERVICE}/${RESOURCE_NAME}"

# Locate the templates directory (relative to this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/../assets/templates/terraform"

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  die "templates not found at $TEMPLATE_DIR"
fi

# Provider source mapping
case "$PROVIDER" in
  aws)          PROVIDER_SOURCE="hashicorp/aws" ;;
  azurerm)      PROVIDER_SOURCE="hashicorp/azurerm" ;;
  google)       PROVIDER_SOURCE="hashicorp/google" ;;
  huaweicloud)  PROVIDER_SOURCE="huaweicloud/huaweicloud" ;;
  oci)          PROVIDER_SOURCE="oracle/oci" ;;
  digitalocean) PROVIDER_SOURCE="digitalocean/digitalocean" ;;
  cloudflare)   PROVIDER_SOURCE="cloudflare/cloudflare" ;;
  kubernetes)   PROVIDER_SOURCE="hashicorp/kubernetes" ;;
  helm)         PROVIDER_SOURCE="hashicorp/helm" ;;
  *)            PROVIDER_SOURCE="${PROVIDER}/${PROVIDER}" ;;
esac

# Refuse to clobber an existing module
if [[ -d "$MODULE_PATH" ]]; then
  die "module already exists at $MODULE_PATH (will not clobber)"
fi

info "Creating module: ${SERVICE}/${RESOURCE_NAME}"
printf '  Provider:        %s >= %s\n' "$PROVIDER" "$PROVIDER_VERSION"
printf '  Provider source: %s\n' "$PROVIDER_SOURCE"
printf '  Variable prefix: %s\n' "$RESOURCE_VAR"
printf '  Path:            %s\n\n' "$MODULE_PATH"

# Create directory structure
mkdir -p "${MODULE_PATH}/wrappers"
ok "directories: ${MODULE_PATH}/, ${MODULE_PATH}/wrappers/"

# Template substitution
process_template() {
  local input_file="$1" output_file="$2"
  sed \
    -e "s|{{SERVICE}}|${SERVICE}|g" \
    -e "s|{{RESOURCE}}|${RESOURCE_NAME}|g" \
    -e "s|{{RESOURCE_NAME}}|${RESOURCE_NAME}|g" \
    -e "s|{{RESOURCE_VAR}}|${RESOURCE_VAR}|g" \
    -e "s|{{PROVIDER}}|${PROVIDER}|g" \
    -e "s|{{PROVIDER_SOURCE}}|${PROVIDER_SOURCE}|g" \
    -e "s|{{PROVIDER_VERSION}}|${PROVIDER_VERSION}|g" \
    -e "s|{{BLOCK_NAME}}|example_block|g" \
    "$input_file" > "$output_file"
}

# Root module files
process_template "${TEMPLATE_DIR}/main.tf.tmpl"      "${MODULE_PATH}/main.tf"
process_template "${TEMPLATE_DIR}/variables.tf.tmpl" "${MODULE_PATH}/variables.tf"
process_template "${TEMPLATE_DIR}/outputs.tf.tmpl"   "${MODULE_PATH}/outputs.tf"
process_template "${TEMPLATE_DIR}/versions.tf.tmpl"  "${MODULE_PATH}/versions.tf"
process_template "${TEMPLATE_DIR}/README.md.tmpl"    "${MODULE_PATH}/README.md"
ok "root files:    main.tf, variables.tf, outputs.tf, versions.tf, README.md"

# Wrapper module files
process_template "${TEMPLATE_DIR}/wrappers-main.tf.tmpl"      "${MODULE_PATH}/wrappers/main.tf"
process_template "${TEMPLATE_DIR}/wrappers-variables.tf.tmpl" "${MODULE_PATH}/wrappers/variables.tf"
process_template "${TEMPLATE_DIR}/wrappers-outputs.tf.tmpl"   "${MODULE_PATH}/wrappers/outputs.tf"
process_template "${TEMPLATE_DIR}/wrappers-versions.tf.tmpl"  "${MODULE_PATH}/wrappers/versions.tf"
ok "wrapper files: main.tf, variables.tf, outputs.tf, versions.tf"

# Verify file count
file_count="$(find "$MODULE_PATH" -maxdepth 2 -type f | wc -l | tr -d ' ')"
dir_count="$(find "$MODULE_PATH" -maxdepth 2 -type d | wc -l | tr -d ' ')"

printf '\n'
ok "module created at $MODULE_PATH"
printf '   files: %s (expected 9)\n' "$file_count"
printf '   dirs:  %s (expected 2)\n' "$dir_count"

if [[ "$file_count" -ne 9 || "$dir_count" -ne 2 ]]; then
  die "structure check FAILED: expected 9 files / 2 dirs, got $file_count / $dir_count"
fi

# Next-step hints
cat <<EOF

${YELLOW}Next steps:${NC}
  1. Open the registry page for the resource:
     https://registry.terraform.io/providers/${PROVIDER_SOURCE}/latest/docs/resources/${SERVICE}_${RESOURCE_NAME}

  2. Edit ${MODULE_PATH}/main.tf — replace the placeholder fields with the actual resource arguments.
  3. Edit ${MODULE_PATH}/variables.tf — add real heredoc descriptions, types, and validation blocks.
  4. Edit ${MODULE_PATH}/outputs.tf — add the available attributes from the registry.
  5. Edit ${MODULE_PATH}/wrappers/main.tf — thread every new variable through the try() chain.
  6. Run: cd ${MODULE_PATH} && terraform fmt && terraform validate
  7. Validate the structure: bash $(dirname "$0")/validate-module.sh "$MODULE_PATH"
  8. Generate docs:
     terraform-docs -c .terraform-docs.yml ${MODULE_PATH}
EOF
