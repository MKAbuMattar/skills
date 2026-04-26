// vars/setupTools.groovy
//
// Layer the auxiliary CLI tools onto the alpine/k8s "tools" container at
// runtime. Idempotent — safe to call on a re-run.

def call() {
    container('tools') {
        sh '''
            set -eu
            apk add --no-cache buildctl skopeo tar coreutils git openssh-client jq yq curl bash unzip || true
            command -v cosign        >/dev/null || curl -fsSL -o /usr/local/bin/cosign https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 && chmod +x /usr/local/bin/cosign
            command -v grype         >/dev/null || curl -fsSL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
            command -v syft          >/dev/null || curl -fsSL https://raw.githubusercontent.com/anchore/syft/main/install.sh  | sh -s -- -b /usr/local/bin
            command -v sonar-scanner >/dev/null || { apk add --no-cache openjdk17-jre && curl -fsSL -o /tmp/ss.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006-linux.zip && unzip -q /tmp/ss.zip -d /opt && ln -s /opt/sonar-scanner-*/bin/sonar-scanner /usr/local/bin/sonar-scanner; }
            command -v commitlint    >/dev/null || npm i -g @commitlint/cli @commitlint/config-conventional || true
            chmod 0777 "${WORKSPACE}"
        '''
    }
}
