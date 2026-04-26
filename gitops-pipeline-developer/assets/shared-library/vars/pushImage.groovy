// vars/pushImage.groovy
//
// Push the OCI image to the registry via skopeo. Final-release builds also
// push :latest. Always emits image.digest for downstream stages (sign,
// GitOps update, score script).
//
// Source dir + manifest format are driven by env.IMG_DO_ENCRYPT (set by
// computeSecurityLevel earlier in the pipeline):
//   * encrypted layers → push as OCI (no --format flag)
//   * plain OCI        → push as v2s2 (safer default for legacy registries)
// See references/security-levels.md for the full rationale.
//
// Usage:  pushImage(cfg)
//   cfg.registry, cfg.org, cfg.image                 (required)
//   cfg.authFile                  default '/tmp/docker-config/config.json'

def call(Map cfg = [:]) {
    cfg = [authFile: '/tmp/docker-config/config.json'] + cfg
    def fullImage  = "${cfg.registry}/${cfg.org}/${cfg.image}"
    def encrypted  = (env.IMG_DO_ENCRYPT == 'true')
    def srcDir     = encrypted ? 'encrypted-oci' : 'oci-out'
    def fmtFlag    = encrypted ? '' : '--format v2s2'

    container('tools') {
        sh """
            set -e
            echo "Push: source=\${WORKSPACE}/${srcDir}  encrypted=${encrypted}"

            skopeo copy ${fmtFlag} \\
                --authfile ${cfg.authFile} \\
                "oci:\${WORKSPACE}/${srcDir}" \\
                "docker://${fullImage}:${env.VERSION}"

            if [ "${env.IS_RELEASE}" = "true" ]; then
                skopeo copy ${fmtFlag} \\
                    --authfile ${cfg.authFile} \\
                    "oci:\${WORKSPACE}/${srcDir}" \\
                    "docker://${fullImage}:latest"
            fi

            DIGEST=\$(skopeo inspect --authfile ${cfg.authFile} \\
                --raw "docker://${fullImage}:${env.VERSION}" | sha256sum | awk '{print "sha256:"\$1}')
            echo "\$DIGEST" > image.digest
            echo "Pushed digest: \$DIGEST"
        """
    }
}
