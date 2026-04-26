#!/usr/bin/env bash
#
# setup-pipeline-secrets.sh — Create the K8s secrets the pipeline expects in
# the `jenkins` namespace. Each is created via `kubectl create … --dry-run=client
# -o yaml | kubectl apply -f -` so re-running is idempotent.
#
# Default secrets:
#   git-ssh-key           — SSH private key for git clones (data: ssh-privatekey)
#   registry-credentials  — docker config.json for image push (data: config.json)
#   slack-webhook         — webhook URL for notifications (data: url)             [optional]
#   tls-source            — TLS cert + key (data: tls.crt + tls.key)              [optional]
#
# Inputs (all optional — provide what you need):
#   SSH_KEY_FILE                      Default: ~/.ssh/id_rsa
#   REGISTRY                          Default: ghcr.io
#   REGISTRY_USER, REGISTRY_PASS      For docker config.json (or skip if existing
#                                     'default-secret' already holds it)
#   SLACK_WEBHOOK_URL                 Optional
#   TLS_CERT, TLS_KEY                 Optional (paths)
#
# Cross-platform: Linux, macOS, Windows (Git Bash / WSL). Requires bash 4+, kubectl, base64.

set -euo pipefail

if [ -t 1 ]; then
    GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    GREEN=''; YELLOW=''; RED=''; BLUE=''; NC=''
fi

NAMESPACE="${NAMESPACE:-jenkins}"
SSH_KEY_FILE="${SSH_KEY_FILE:-${HOME}/.ssh/id_rsa}"
REGISTRY="${REGISTRY:-ghcr.io}"
REGISTRY_USER="${REGISTRY_USER:-}"
REGISTRY_PASS="${REGISTRY_PASS:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
TLS_CERT="${TLS_CERT:-}"
TLS_KEY="${TLS_KEY:-}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [-h|--help]

Create the K8s secrets the pipeline expects in a configurable namespace.
Inputs are environment variables — no positional arguments.

Configurable env vars:
    NAMESPACE              Default: jenkins
    SSH_KEY_FILE           Default: \${HOME}/.ssh/id_rsa
    REGISTRY               Default: ghcr.io
    REGISTRY_USER, REGISTRY_PASS    For docker config.json
    SLACK_WEBHOOK_URL      Optional
    TLS_CERT, TLS_KEY      Optional (paths)

Each secret is applied via 'kubectl create … --dry-run | kubectl apply -f -'
so re-running is idempotent.

Exit codes:
    0   Success
    1   Generic error (missing required input)
    2   Bad arguments / missing dependency

Examples:
    SSH_KEY_FILE=~/.ssh/id_rsa REGISTRY_USER=u REGISTRY_PASS=p $(basename "$0")
    NAMESPACE=ci $(basename "$0")
EOF
    exit "${1:-0}"
}

err()  { echo -e "${RED}\xe2\x9c\x97${NC} $*" >&2; }
warn() { echo -e "${YELLOW}\xe2\x9a\xa0${NC} $*" >&2; }
info() { echo -e "${BLUE}\xe2\x84\xb9${NC} $*"; }
ok()   { echo -e "${GREEN}\xe2\x9c\x93${NC} $*"; }

main() {
    case "${1:-}" in -h|--help) usage 0 ;; esac

    command -v kubectl >/dev/null || { err "kubectl not in PATH"; exit 2; }
    command -v base64  >/dev/null || { err "base64 not in PATH"; exit 2; }

    info "Namespace: ${NAMESPACE}"

apply_secret() {
    # apply_secret <kind> <name> <args...> — kubectl create … --dry-run | apply
    local kind="$1" name="$2"; shift 2
    kubectl create secret "$kind" "$name" --namespace "${NAMESPACE}" "$@" \
        --dry-run=client -o yaml | kubectl apply -f -
}

# --- 1. Git SSH key ------------------------------------------------------
if [ -f "${SSH_KEY_FILE}" ]; then
    info "[1] git-ssh-key from ${SSH_KEY_FILE}"
    apply_secret generic git-ssh-key \
        --from-file=ssh-privatekey="${SSH_KEY_FILE}"
    ok "git-ssh-key applied"
else
    warn "[1] SSH key not found at ${SSH_KEY_FILE} — skipping"
    warn "    Re-run with: SSH_KEY_FILE=/path/to/key bash $(basename "$0")"
fi

# --- 2. Registry credentials --------------------------------------------
info "[2] registry-credentials"
if [ -n "${REGISTRY_USER}" ] && [ -n "${REGISTRY_PASS}" ]; then
    _auth=$(printf '%s:%s' "${REGISTRY_USER}" "${REGISTRY_PASS}" | base64 | tr -d '\n')
    _config=$(printf '{"auths":{"%s":{"auth":"%s"}}}' "${REGISTRY}" "${_auth}")
    TMP_CFG=$(mktemp); printf '%s' "${_config}" > "${TMP_CFG}"
    apply_secret generic registry-credentials \
        --from-file=config.json="${TMP_CFG}"
    rm -f "${TMP_CFG}"
    ok "registry-credentials applied"
elif kubectl get secret default-secret -n "${NAMESPACE}" >/dev/null 2>&1; then
    info "    Copying from existing 'default-secret'…"
    _existing=$(kubectl get secret default-secret -n "${NAMESPACE}" \
        -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d)
    TMP_CFG=$(mktemp); printf '%s' "${_existing}" > "${TMP_CFG}"
    apply_secret generic registry-credentials \
        --from-file=config.json="${TMP_CFG}"
    rm -f "${TMP_CFG}"
    ok "registry-credentials applied (from default-secret)"
else
    warn "    REGISTRY_USER / REGISTRY_PASS not set, no default-secret either — skipping"
    warn "    Re-run with: REGISTRY_USER=u REGISTRY_PASS=p bash $(basename "$0")"
fi

# --- 3. Slack webhook (optional) -----------------------------------------
if [ -n "${SLACK_WEBHOOK_URL}" ]; then
    info "[3] slack-webhook"
    apply_secret generic slack-webhook \
        --from-literal=url="${SLACK_WEBHOOK_URL}"
    ok "slack-webhook applied"
else
    info "[3] SLACK_WEBHOOK_URL not set — skipping (optional)"
fi

# --- 4. TLS source (optional) -------------------------------------------
if [ -n "${TLS_CERT}" ] && [ -n "${TLS_KEY}" ]; then
    info "[4] tls-source"
    [ -f "${TLS_CERT}" ] && [ -f "${TLS_KEY}" ] \
        || { err "TLS_CERT or TLS_KEY not a file"; exit 1; }
    apply_secret tls tls-source \
        --cert="${TLS_CERT}" --key="${TLS_KEY}"
    ok "tls-source applied"
else
    info "[4] TLS_CERT / TLS_KEY not set — skipping (optional)"
fi

    echo
    ok "Pipeline secrets ready in '${NAMESPACE}'."
    echo
    echo "Required by the modular Jenkinsfile:"
    echo "  git-ssh-key            — SSH key for repo clones"
    echo "  registry-credentials   — docker config.json for image push"
    echo "Optional:"
    echo "  slack-webhook          — Slack incoming webhook"
    echo "  tls-source             — TLS cert + key (used by the deployed app, not the pipeline)"
}

main "$@"
