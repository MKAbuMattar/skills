// vars/updateGitOps.groovy
//
// Clone the chart / manifests repo, write the new image tag + digest into
// values.yaml, commit (with [skip ci]), push.
//
// Usage:  updateGitOps(cfg)
//   cfg.chartRepo, cfg.chartBranch, cfg.valuesFile  (required)
//   cfg.botEmail                  default 'jenkins-bot@example.com'
//   cfg.botName                   default 'Jenkins CI'
//   cfg.imageKey                  default 'image' (top-level yq path)

def call(Map cfg = [:]) {
    cfg = [
        chartBranch: 'main',
        valuesFile:  'values.yaml',
        botEmail:    'jenkins-bot@example.com',
        botName:     'Jenkins CI',
        imageKey:    'image',
    ] + cfg
    def fullImage = "${cfg.registry}/${cfg.org}/${cfg.image}"

    container('tools') {
        sh """
            set -e
            mkdir -p /root/.ssh && cp /root/.ssh-mount/id_rsa /root/.ssh/id_rsa && chmod 600 /root/.ssh/id_rsa
            ssh-keyscan -H github.com bitbucket.org gitlab.com >> /root/.ssh/known_hosts 2>/dev/null || true
            git config --global user.email '${cfg.botEmail}'
            git config --global user.name  '${cfg.botName}'

            rm -rf /tmp/chart && git clone -b ${cfg.chartBranch} ${cfg.chartRepo} /tmp/chart
            cd /tmp/chart
            DIGEST=\$(cat \${WORKSPACE}/image.digest)
            yq -i '
                .${cfg.imageKey}.repository = "${fullImage}" |
                .${cfg.imageKey}.tag        = "${env.VERSION}" |
                .${cfg.imageKey}.digest     = "'\$DIGEST'"
            ' ${cfg.valuesFile}

            git add ${cfg.valuesFile}
            git diff --cached --quiet && echo "No GitOps changes" || {
                git commit -m 'deploy: ${cfg.image} ${env.VERSION}@'\$DIGEST' [skip ci]'
                git push origin ${cfg.chartBranch}
            }
        """
    }
}
