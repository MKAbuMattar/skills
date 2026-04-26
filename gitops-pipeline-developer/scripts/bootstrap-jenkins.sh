#!/usr/bin/env bash
#
# bootstrap-jenkins.sh — Bootstrap a Jenkins controller running in Kubernetes
# so the modular `gitops-pipeline` shared library is ready to use:
#
#   1. Creates the SSH credential the pipeline needs to clone repos.
#   2. Creates the pipeline job pointing at your application repo's Jenkinsfile.
#   3. Optionally registers the shared library as a Global Pipeline Library.
#
# Idempotent — re-running upgrades existing entries instead of duplicating.
#
# Usage:
#     bash scripts/bootstrap-jenkins.sh \
#         --namespace jenkins \
#         --pod        jenkins-0 \
#         --container  jenkins \
#         --ssh-key    ~/.ssh/id_rsa \
#         --repo-url   git@github.com:acme/my-service.git \
#         --job-name   acme-my-service \
#         --branch     '*/main' \
#         --library-repo git@github.com:acme/jenkins-shared-library.git \
#         --library-name gitops-pipeline
#
# Cross-platform: Linux, macOS, Windows (Git Bash / WSL). Requires bash 4+,
# kubectl, and an admin password for the Jenkins controller (read from helm
# values automatically, or set JENKINS_PASS).

set -euo pipefail

if [ -t 1 ]; then
    GREEN='\033[0;32m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
else
    GREEN=''; RED=''; BLUE=''; NC=''
fi

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
NAMESPACE="${NAMESPACE:-jenkins}"
POD="${POD:-jenkins-0}"
CONTAINER="${CONTAINER:-jenkins}"
JENKINS_URL="${JENKINS_URL:-http://localhost:8080}"
JENKINS_USER="${JENKINS_USER:-admin}"
JENKINS_PASS="${JENKINS_PASS:-}"

SSH_KEY=""
SSH_CRED_ID="${SSH_CRED_ID:-git-ssh-key}"
REPO_URL=""
JOB_NAME=""
BRANCH_SPEC="*/main"
SCRIPT_PATH="Jenkinsfile"
LIBRARY_REPO=""
LIBRARY_NAME="${LIBRARY_NAME:-gitops-pipeline}"
LIBRARY_BRANCH="${LIBRARY_BRANCH:-main}"

usage() {
    sed -n '2,/^$/p' "$0" | sed 's/^# *//;s/^#$//'
    exit "${1:-0}"
}

err()  { echo -e "${RED}\xe2\x9c\x97${NC} $*" >&2; }
info() { echo -e "${BLUE}\xe2\x84\xb9${NC} $*"; }
ok()   { echo -e "${GREEN}\xe2\x9c\x93${NC} $*"; }

# Helper: run a Groovy script via Jenkins Script Console.
run_groovy() {
    local script_file="$1" desc="$2"
    info "${desc}…"
    kubectl cp "${script_file}" "${NAMESPACE}/${POD}:/tmp/jenkins-script.groovy" -c "${CONTAINER}"
    kubectl exec -n "${NAMESPACE}" "${POD}" -c "${CONTAINER}" -- sh -c "
        CRUMB=\$(curl -s -c /tmp/j.cookies -u '${JENKINS_USER}:${JENKINS_PASS}' \
            '${JENKINS_URL}/crumbIssuer/api/json' | sed 's/.*crumb\":\"//;s/\".*//')
        SCRIPT=\$(cat /tmp/jenkins-script.groovy)
        curl -s -b /tmp/j.cookies -u '${JENKINS_USER}:${JENKINS_PASS}' \
            -H \"Jenkins-Crumb:\${CRUMB}\" \
            --data-urlencode \"script=\${SCRIPT}\" \
            '${JENKINS_URL}/scriptText'
        rm -f /tmp/j.cookies /tmp/jenkins-script.groovy
    "
    echo
}

main() {
while [ "$#" -gt 0 ]; do
    case "$1" in
        -h|--help)         usage 0 ;;
        --namespace)       NAMESPACE="$2";      shift 2 ;;
        --pod)             POD="$2";            shift 2 ;;
        --container)       CONTAINER="$2";      shift 2 ;;
        --ssh-key)         SSH_KEY="$2";        shift 2 ;;
        --ssh-cred-id)     SSH_CRED_ID="$2";    shift 2 ;;
        --repo-url)        REPO_URL="$2";       shift 2 ;;
        --job-name)        JOB_NAME="$2";       shift 2 ;;
        --branch)          BRANCH_SPEC="$2";    shift 2 ;;
        --script-path)     SCRIPT_PATH="$2";    shift 2 ;;
        --library-repo)    LIBRARY_REPO="$2";   shift 2 ;;
        --library-name)    LIBRARY_NAME="$2";   shift 2 ;;
        --library-branch)  LIBRARY_BRANCH="$2"; shift 2 ;;
        *) err "Unknown option: $1"; usage 2 ;;
    esac
done

# --- Pre-flight ----------------------------------------------------------
command -v kubectl >/dev/null || { err "kubectl not in PATH"; exit 2; }

if [ -z "${JENKINS_PASS}" ]; then
    info "Reading Jenkins admin password from helm values…"
    JENKINS_PASS="$(helm get values jenkins -n "${NAMESPACE}" 2>/dev/null \
        | awk '/password:/{print $2; exit}')"
    [ -n "${JENKINS_PASS}" ] || { err "Could not read Jenkins password — set JENKINS_PASS"; exit 1; }
fi

# --- 1. SSH credential ---------------------------------------------------
if [ -n "${SSH_KEY}" ]; then
    [ -f "${SSH_KEY}" ] || { err "SSH key file not found: ${SSH_KEY}"; exit 1; }
    kubectl cp "${SSH_KEY}" "${NAMESPACE}/${POD}:/tmp/${SSH_CRED_ID}.key" -c "${CONTAINER}"
    kubectl exec -n "${NAMESPACE}" "${POD}" -c "${CONTAINER}" -- sh -c "cat > /tmp/jenkins-credential.params <<EOF
id=${SSH_CRED_ID}
kind=ssh-key
description=Git SSH key for pipeline clones
username=git
EOF"
    run_groovy "${SCRIPT_DIR}/jenkins-credential.groovy" "Creating/updating SSH credential '${SSH_CRED_ID}'"
    kubectl exec -n "${NAMESPACE}" "${POD}" -c "${CONTAINER}" -- rm -f "/tmp/${SSH_CRED_ID}.key" /tmp/jenkins-credential.params
    ok "SSH credential '${SSH_CRED_ID}' ready"
else
    info "--ssh-key not provided — skipping SSH credential step"
fi

# --- 2. Pipeline job -----------------------------------------------------
if [ -n "${REPO_URL}" ] && [ -n "${JOB_NAME}" ]; then
    kubectl exec -n "${NAMESPACE}" "${POD}" -c "${CONTAINER}" -- sh -c "cat > /tmp/jenkins-pipeline-job.params <<EOF
jobName=${JOB_NAME}
repoUrl=${REPO_URL}
credentialId=${SSH_CRED_ID}
branchSpec=${BRANCH_SPEC}
scriptPath=${SCRIPT_PATH}
EOF"
    run_groovy "${SCRIPT_DIR}/jenkins-pipeline-job.groovy" "Creating/updating pipeline job '${JOB_NAME}'"
    kubectl exec -n "${NAMESPACE}" "${POD}" -c "${CONTAINER}" -- rm -f /tmp/jenkins-pipeline-job.params
    ok "Pipeline job '${JOB_NAME}' ready"
else
    info "--repo-url / --job-name not provided — skipping pipeline-job step"
fi

# --- 3. Global Pipeline Library (optional) -------------------------------
if [ -n "${LIBRARY_REPO}" ]; then
    info "Registering shared library '${LIBRARY_NAME}' (default version: ${LIBRARY_BRANCH})…"
    LIB_SCRIPT=$(mktemp)
    cat > "${LIB_SCRIPT}" <<GROOVY
import jenkins.model.GlobalLibraries
import org.jenkinsci.plugins.workflow.libs.LibraryConfiguration
import org.jenkinsci.plugins.workflow.libs.SCMSourceRetriever
import jenkins.plugins.git.GitSCMSource

def libName   = '${LIBRARY_NAME}'
def libRepo   = '${LIBRARY_REPO}'
def libBranch = '${LIBRARY_BRANCH}'
def credId    = '${SSH_CRED_ID}'

def src = new GitSCMSource(libRepo)
src.with {
    setCredentialsId(credId)
    setRemote(libRepo)
    setId('gitops-pipeline-source')
}
def retr = new SCMSourceRetriever(src)
def lib  = new LibraryConfiguration(libName, retr)
lib.with {
    setDefaultVersion(libBranch)
    setImplicit(false)
    setAllowVersionOverride(true)
    setIncludeInChangesets(false)
}

def gl = GlobalLibraries.get()
gl.libraries = (gl.libraries.findAll { it.name != libName } + [lib])
gl.save()
println "Shared library '\${libName}' registered (default: \${libBranch})"
GROOVY
    run_groovy "${LIB_SCRIPT}" "Registering shared library"
    rm -f "${LIB_SCRIPT}"
    ok "Shared library '${LIBRARY_NAME}' registered"
else
    info "--library-repo not provided — skipping shared-library registration"
fi

    ok "Bootstrap complete."
}

main "$@"
