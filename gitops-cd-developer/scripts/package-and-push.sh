#!/usr/bin/env bash
#
# package-and-push.sh — Lint, package, push a Helm chart to an OCI registry.
# Optionally cosign-signs the chart artifact.
#
# Usage:
#     scripts/package-and-push.sh --chart-dir ./chart-template --registry ghcr.io/acme/charts
#     scripts/package-and-push.sh --chart-dir ./chart --registry ghcr.io/acme/charts --secrets ./secrets.yaml
#     scripts/package-and-push.sh --chart-dir ./chart --registry ghcr.io/acme/charts --sign
#     scripts/package-and-push.sh -h
#
# Idempotent — re-running pushes the same version (registry-side dedup) but
# bumping Chart.yaml's version is required to publish a new release.
#
# Cross-platform: Linux, macOS, Windows (Git Bash / WSL). bash 4.0+, helm 3.14+,
# yq, optional cosign + jq.

set -euo pipefail

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi
readonly RED GREEN YELLOW BLUE NC
readonly SCRIPT_NAME="$(basename "$0")"

CHART_DIR=""
REGISTRY=""
OUTPUT_DIR="${OUTPUT_DIR:-pkg}"
SECRETS_FILE=""
SECRETS_USER_KEY="${SECRETS_USER_KEY:-.registry.username}"
SECRETS_PASS_KEY="${SECRETS_PASS_KEY:-.registry.password}"
SIGN=false
COSIGN_KEY_REF="${COSIGN_KEY_REF:-}"
EXTRA_ARGS=""

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

Lint, package, and push a Helm chart to an OCI registry.

REQUIRED:
    --chart-dir <path>      Path to the Helm chart directory (containing Chart.yaml)
    --registry <host/path>  OCI registry path (e.g. ghcr.io/acme/charts)

OPTIONAL:
    --output-dir <path>     Where to write the .tgz (default: pkg)
    --secrets <yaml>        YAML file with registry credentials
    --secrets-user-key <q>  yq path for username (default: .registry.username)
    --secrets-pass-key <q>  yq path for password (default: .registry.password)
    --sign                  cosign-sign the chart artifact after push
    --cosign-key <ref>      e.g. hashivault://cosign-key (env: COSIGN_KEY_REF)
    --extra <args>          Extra args appended to 'helm package'
    -h, --help              Show this help and exit

ENV VARS:
    OUTPUT_DIR, SECRETS_USER_KEY, SECRETS_PASS_KEY, COSIGN_KEY_REF
    REGISTRY_USER, REGISTRY_PASS  (overrides --secrets if set)

EXIT CODES:
    0   Success
    1   Generic error (lint failure, missing dependency, push failure)
    2   Bad arguments

EXAMPLES:
    $SCRIPT_NAME --chart-dir ./chart --registry ghcr.io/acme/charts \\
                 --secrets ./secrets.yaml --sign

    REGISTRY_USER=u REGISTRY_PASS=p $SCRIPT_NAME \\
                 --chart-dir ./chart --registry oci.example.com/team/charts
EOF
    exit "${1:-0}"
}

err()  { echo -e "${RED}\xe2\x9c\x97${NC} $*" >&2; }
info() { echo -e "${BLUE}\xe2\x84\xb9${NC} $*"; }
ok()   { echo -e "${GREEN}\xe2\x9c\x93${NC} $*"; }
warn() { echo -e "${YELLOW}\xe2\x9a\xa0${NC} $*" >&2; }

main() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            -h|--help)             usage 0 ;;
            --chart-dir)           CHART_DIR="$2"; shift 2 ;;
            --registry)            REGISTRY="$2"; shift 2 ;;
            --output-dir)          OUTPUT_DIR="$2"; shift 2 ;;
            --secrets)             SECRETS_FILE="$2"; shift 2 ;;
            --secrets-user-key)    SECRETS_USER_KEY="$2"; shift 2 ;;
            --secrets-pass-key)    SECRETS_PASS_KEY="$2"; shift 2 ;;
            --sign)                SIGN=true; shift ;;
            --cosign-key)          COSIGN_KEY_REF="$2"; shift 2 ;;
            --extra)               EXTRA_ARGS="$2"; shift 2 ;;
            *)                     err "Unknown option: $1"; usage 2 ;;
        esac
    done

    [ -n "$CHART_DIR" ] || { err "--chart-dir is required"; usage 2; }
    [ -n "$REGISTRY"  ] || { err "--registry is required";  usage 2; }
    [ -d "$CHART_DIR" ] || { err "Not a directory: $CHART_DIR"; exit 1; }
    [ -f "$CHART_DIR/Chart.yaml" ] || { err "$CHART_DIR/Chart.yaml not found"; exit 1; }

    command -v helm >/dev/null || { err "helm not in PATH"; exit 2; }
    command -v yq   >/dev/null || { err "yq not in PATH";   exit 2; }

    local CHART_NAME CHART_VERSION
    CHART_NAME="$(yq '.name'    "$CHART_DIR/Chart.yaml")"
    CHART_VERSION="$(yq '.version' "$CHART_DIR/Chart.yaml")"
    info "Chart: ${CHART_NAME} ${CHART_VERSION}"

    # ---- Lint -----------------------------------------------------------
    info "Linting $CHART_DIR..."
    if ! helm lint "$CHART_DIR" $EXTRA_ARGS; then
        err "helm lint failed"
        exit 1
    fi
    ok "Lint passed"

    # ---- Package --------------------------------------------------------
    mkdir -p "$OUTPUT_DIR"
    info "Packaging to $OUTPUT_DIR/..."
    helm package "$CHART_DIR" --destination "$OUTPUT_DIR" $EXTRA_ARGS
    local PKG="$OUTPUT_DIR/${CHART_NAME}-${CHART_VERSION}.tgz"
    [ -f "$PKG" ] || { err "Package not found: $PKG"; exit 1; }
    ok "Packaged: $PKG"

    # ---- Login (only if secrets / env vars provided) --------------------
    local USER="${REGISTRY_USER:-}"
    local PASS="${REGISTRY_PASS:-}"
    if [ -z "$USER$PASS" ] && [ -n "$SECRETS_FILE" ]; then
        [ -f "$SECRETS_FILE" ] || { err "Secrets file not found: $SECRETS_FILE"; exit 1; }
        USER="$(yq "$SECRETS_USER_KEY" "$SECRETS_FILE")"
        PASS="$(yq "$SECRETS_PASS_KEY" "$SECRETS_FILE")"
    fi
    if [ -n "$USER" ] && [ -n "$PASS" ] && [ "$USER" != "null" ] && [ "$PASS" != "null" ]; then
        info "Logging in to $(echo "$REGISTRY" | cut -d/ -f1)..."
        echo "$PASS" | helm registry login -u "$USER" --password-stdin "$(echo "$REGISTRY" | cut -d/ -f1)"
        ok "Login OK"
    else
        warn "No credentials provided — assuming registry already logged in"
    fi

    # ---- Push -----------------------------------------------------------
    info "Pushing to oci://$REGISTRY..."
    helm push "$PKG" "oci://$REGISTRY"
    ok "Pushed: oci://$REGISTRY/$CHART_NAME:$CHART_VERSION"

    # ---- Optional cosign sign ------------------------------------------
    if [ "$SIGN" = "true" ]; then
        command -v cosign >/dev/null || { err "cosign not in PATH (--sign requires it)"; exit 1; }
        [ -n "$COSIGN_KEY_REF" ] || { err "--cosign-key (or COSIGN_KEY_REF) required when --sign"; exit 1; }

        info "Signing chart artifact with cosign ($COSIGN_KEY_REF)..."
        local IMG="oci://$REGISTRY/$CHART_NAME:$CHART_VERSION"
        # Translate oci://... to a regular registry reference for cosign
        cosign sign --yes --key "$COSIGN_KEY_REF" "${REGISTRY}/${CHART_NAME}:${CHART_VERSION}"
        ok "Signed"
    fi

    cat <<EOF

${GREEN}Done.${NC}

Pull from a consumer chart's Chart.yaml:

  dependencies:
    - name: ${CHART_NAME}
      version: ${CHART_VERSION}
      repository: "oci://${REGISTRY}"

EOF
}

main "$@"
