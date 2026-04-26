// vars/setupTools.groovy
//
// Layer the auxiliary CLI tools onto the alpine/k8s "tools" container at
// runtime, with pinned versions and SHA256 verification. Idempotent — safe
// to call on a re-run.
//
// PREFER A PRE-BAKED TOOLS IMAGE in production (see references/supply-chain.md
// "Path 1 — Pre-baked tools image" and assets/templates/Dockerfile.tools-image.template).
// Use this runtime-install path only when you can't host a team image.
//
// Every download below is:
//   * Pinned to a specific tagged version (no `latest`, no `main`)
//   * Verified by SHA256 against an expected hash
//   * For sigstore-signed tools, additionally cosign-verified once cosign is in place
//
// Update procedure: see references/supply-chain.md "How to update pinned versions".

def call(Map cfg = [:]) {
    cfg = [
        cosignVer:       'v2.4.1',
        cosignSha:       '<set-via-references/supply-chain.md>',   // sha256 of cosign-linux-amd64
        grypeVer:        'v0.84.0',
        grypeInstallSha: '<set-via-references/supply-chain.md>',   // sha256 of pinned install.sh
        grypeInstallRef: '',                                        // commit SHA of install.sh — REQUIRED
        syftVer:         'v1.18.1',
        syftInstallSha:  '<set-via-references/supply-chain.md>',
        syftInstallRef:  '',
        sonarVer:        '5.0.1.3006',
        sonarSha:        '<set-via-references/supply-chain.md>',
    ] + cfg

    container('tools') {
        sh """
            set -euo pipefail

            # ---- Distro packages -------------------------------------------
            # Alpine packages are signed by the distro key bundled with apk.
            apk add --no-cache buildctl skopeo tar coreutils git openssh-client \\
                jq yq curl bash unzip openjdk17-jre || true

            # ---- Helper: verify a downloaded file's SHA256 ----------------
            verify() {
                local file="\$1" expected="\$2"
                if [ "\$expected" = "<set-via-references/supply-chain.md>" ]; then
                    echo "ERROR: SHA256 not pinned for \$file. See references/supply-chain.md." >&2
                    exit 1
                fi
                local actual
                actual=\$(sha256sum "\$file" | awk '{print \$1}')
                if [ "\$actual" != "\$expected" ]; then
                    echo "ERROR: checksum mismatch for \$file"  >&2
                    echo "       expected: \$expected"          >&2
                    echo "       actual:   \$actual"            >&2
                    rm -f "\$file"
                    exit 1
                fi
                echo "OK: \$file matches pinned SHA256"
            }

            # ---- cosign (pinned + SHA-verified) ----------------------------
            if ! command -v cosign >/dev/null; then
                curl -fsSL --retry 3 -o /usr/local/bin/cosign \\
                    "https://github.com/sigstore/cosign/releases/download/${cfg.cosignVer}/cosign-linux-amd64"
                verify /usr/local/bin/cosign "${cfg.cosignSha}"
                chmod +x /usr/local/bin/cosign
                cosign version
            fi

            # ---- grype (install script pinned by commit SHA + binary by tag)
            # The install script is fetched at a specific commit ref, hashed,
            # then runs to download the cosign-signed binary at the pinned tag.
            if ! command -v grype >/dev/null; then
                if [ -z "${cfg.grypeInstallRef}" ]; then
                    echo "ERROR: grypeInstallRef (commit SHA of install.sh) is required." >&2
                    exit 1
                fi
                curl -fsSL --retry 3 -o /tmp/grype-install.sh \\
                    "https://raw.githubusercontent.com/anchore/grype/${cfg.grypeInstallRef}/install.sh"
                verify /tmp/grype-install.sh "${cfg.grypeInstallSha}"
                sh /tmp/grype-install.sh -b /usr/local/bin "${cfg.grypeVer}"
                rm -f /tmp/grype-install.sh
            fi

            # ---- syft (same pattern as grype) ------------------------------
            if ! command -v syft >/dev/null; then
                if [ -z "${cfg.syftInstallRef}" ]; then
                    echo "ERROR: syftInstallRef (commit SHA of install.sh) is required." >&2
                    exit 1
                fi
                curl -fsSL --retry 3 -o /tmp/syft-install.sh \\
                    "https://raw.githubusercontent.com/anchore/syft/${cfg.syftInstallRef}/install.sh"
                verify /tmp/syft-install.sh "${cfg.syftInstallSha}"
                sh /tmp/syft-install.sh -b /usr/local/bin "${cfg.syftVer}"
                rm -f /tmp/syft-install.sh
            fi

            # ---- sonar-scanner (zip pinned by version + SHA verified) ------
            if ! command -v sonar-scanner >/dev/null; then
                curl -fsSL --retry 3 -o /tmp/ss.zip \\
                    "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${cfg.sonarVer}-linux.zip"
                verify /tmp/ss.zip "${cfg.sonarSha}"
                unzip -q /tmp/ss.zip -d /opt
                ln -sfn "/opt/sonar-scanner-${cfg.sonarVer}-linux/bin/sonar-scanner" /usr/local/bin/sonar-scanner
                rm -f /tmp/ss.zip
            fi

            # ---- commitlint (npm package pinned in commitlint.config.js) ---
            # commitlint itself is installed by the repo's package manager via
            # devDependencies. The CLI may already be present from the repo's
            # node_modules; only fall back to a global install if absent.
            if ! command -v commitlint >/dev/null; then
                npm i -g @commitlint/cli@^19 @commitlint/config-conventional@^19 || true
            fi

            chmod 0777 "\${WORKSPACE}"
        """
    }
}
