#!/usr/bin/env bash
#
# discover-cluster.sh — Run read-only kubectl queries to gather facts for the
#                       "your cluster" section of a deck.
#
# Output is structured so the build agent can copy real numbers directly into
# the Cluster Snapshot tile dashboard and the cluster-topology Three.js scene.
#
# Read-only by design: never runs apply / delete / drain / cordon.
#
# Usage:
#     discover-cluster.sh [--context <ctx>]

set -euo pipefail

if [ -t 1 ]; then
    BLUE='\033[0;34m'; GREEN='\033[0;32m'; DIM='\033[2m'; NC='\033[0m'
else
    BLUE=''; GREEN=''; DIM=''; NC=''
fi

CONTEXT=""
while [ $# -gt 0 ]; do
    case "$1" in
        --context) CONTEXT="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done

KCTL=(kubectl)
[ -n "$CONTEXT" ] && KCTL+=(--context "$CONTEXT")

heading() {
    printf "\n${BLUE}===${NC} %s ${BLUE}===${NC}\n" "$1"
}

heading "Context"
"${KCTL[@]}" config current-context || true

heading "Server version"
"${KCTL[@]}" version 2>/dev/null | grep -E '^(Client|Server) Version' || true

heading "Nodes"
"${KCTL[@]}" get nodes -o wide

heading "Node resource usage (requires metrics-server)"
"${KCTL[@]}" top nodes 2>/dev/null || echo "metrics-server not installed"

heading "Namespaces"
"${KCTL[@]}" get ns

heading "Total pods"
TOTAL_PODS=$("${KCTL[@]}" get pods -A --no-headers 2>/dev/null | wc -l)
printf "%s pods\n" "$TOTAL_PODS"

heading "Pods per namespace (top 15)"
"${KCTL[@]}" get pods -A --no-headers 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head -15

heading "Workload counts"
DEPLOYS=$("${KCTL[@]}" get deploy -A --no-headers 2>/dev/null | wc -l)
STS=$("${KCTL[@]}" get statefulset -A --no-headers 2>/dev/null | wc -l)
DS=$("${KCTL[@]}" get daemonset -A --no-headers 2>/dev/null | wc -l)
JOBS=$("${KCTL[@]}" get job -A --no-headers 2>/dev/null | wc -l)
printf "%s deployments\n%s statefulsets\n%s daemonsets\n%s jobs\n" "$DEPLOYS" "$STS" "$DS" "$JOBS"

heading "Networking"
SVCS=$("${KCTL[@]}" get svc -A --no-headers 2>/dev/null | wc -l)
ING=$("${KCTL[@]}" get ingress -A --no-headers 2>/dev/null | wc -l)
printf "%s services\n%s ingresses\n" "$SVCS" "$ING"

heading "Storage"
"${KCTL[@]}" get sc 2>/dev/null
PVS=$("${KCTL[@]}" get pv --no-headers 2>/dev/null | wc -l)
printf "%s persistent volumes\n" "$PVS"

heading "HPAs"
"${KCTL[@]}" get hpa -A 2>/dev/null

heading "ArgoCD applications (if installed)"
"${KCTL[@]}" get applications -A 2>/dev/null || echo "ArgoCD CRDs not present"

printf "\n${GREEN}done${NC} ${DIM}— bake these numbers into the deck's Cluster Snapshot section${NC}\n"
