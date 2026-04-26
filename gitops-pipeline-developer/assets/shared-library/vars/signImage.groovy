// vars/signImage.groovy
//
// Cosign sign + SBOM attest. Vault K8s-auth token exchange happens here so
// the private key never crosses the pod boundary.
//
// Skipping: this stage is gated in pipelineGitOps by `env.IMG_DO_SIGN`, set
// by computeSecurityLevel(). When invoking directly outside the orchestrator,
// just don't call signImage — there's no env-var skip switch.
//
// Usage:  signImage(cfg)
//   cfg.cosignKeyRef   default 'hashivault://cosign-key'
//   cfg.vaultAddr      default 'http://vault.vault.svc.cluster.local:8200'
//   cfg.vaultRole      default 'jenkins-signer'
//   cfg.cosignRepo     default "${registry}/${org}/signatures"

def call(Map cfg = [:]) {
    cfg = [
        cosignKeyRef: 'hashivault://cosign-key',
        vaultAddr:    'http://vault.vault.svc.cluster.local:8200',
        vaultRole:    'jenkins-signer',
    ] + cfg
    cfg.cosignRepo = cfg.cosignRepo ?: "${cfg.registry}/${cfg.org}/signatures"
    def fullImage  = "${cfg.registry}/${cfg.org}/${cfg.image}"

    container('tools') {
        sh """
            set -e
            JWT=\$(cat /var/run/secrets/vault/token)
            VAULT_TOKEN=\$(curl -sS --fail \\
                --request POST \\
                --data '{"role":"${cfg.vaultRole}","jwt":"'"\$JWT"'"}' \\
                ${cfg.vaultAddr}/v1/auth/kubernetes/login \\
                | jq -r '.auth.client_token')
            export VAULT_TOKEN VAULT_ADDR=${cfg.vaultAddr}
            export COSIGN_REPOSITORY=${cfg.cosignRepo}
            export DOCKER_CONFIG=/tmp/docker-config

            DIGEST=\$(cat image.digest)
            cosign sign --yes --key ${cfg.cosignKeyRef} ${fullImage}@\$DIGEST

            cosign attest --yes \\
                --predicate sbom.cdx.json --type cyclonedx \\
                --key ${cfg.cosignKeyRef} \\
                ${fullImage}@\$DIGEST

            unset VAULT_TOKEN
        """
    }
}
