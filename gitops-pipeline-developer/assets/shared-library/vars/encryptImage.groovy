// vars/encryptImage.groovy
//
// Encrypt the OCI image layers with a JWE public key fetched from Vault KV.
// Produces ${WORKSPACE}/encrypted-oci/ from the plain ${WORKSPACE}/oci-out/
// produced by buildImage. The plain directory is wiped immediately after
// encryption so plaintext bytes never reach the registry.
//
// Cluster side: nodes need ocicrypt + a SecretProviderClass mounting the
// matching private key. See references/security-levels.md.
//
// Usage:  encryptImage(cfg)
//   cfg.vaultAddr      default 'http://vault.vault.svc.cluster.local:8200'
//   cfg.vaultRole      default 'jenkins-signer'
//   cfg.encKeyPath     default 'secret/data/enc-keys'  (encEnv is appended at lookup time)
//   cfg.encEnv         default 'prod' on main / release/* / hotfix/*; 'dev' otherwise

def call(Map cfg = [:]) {
    cfg = [
        vaultAddr:  'http://vault.vault.svc.cluster.local:8200',
        vaultRole:  'jenkins-signer',
        encKeyPath: 'secret/data/enc-keys',
    ] + cfg

    // Default env segment: prod for releases, dev for everything else.
    // Override by passing cfg.encEnv explicitly.
    def encEnv = cfg.encEnv ?: ((env.IS_RELEASE == 'true' || env.BRANCH_NAME == 'main') ? 'prod' : 'dev')
    env.ENC_ENV = encEnv

    container('tools') {
        sh """
            set -eo pipefail

            # ── 1. Vault K8s-auth token exchange ────────────────────────
            JWT=\$(cat /var/run/secrets/vault/token)
            VAULT_TOKEN=\$(curl -sS --fail \\
                --request POST \\
                --data '{"role":"${cfg.vaultRole}","jwt":"'"\$JWT"'"}' \\
                ${cfg.vaultAddr}/v1/auth/kubernetes/login \\
                | jq -r '.auth.client_token')
            [ -n "\$VAULT_TOKEN" ] && [ "\$VAULT_TOKEN" != "null" ] \\
                || { echo "ERROR: Vault login failed"; exit 1; }

            # ── 2. Fetch the public encryption key ──────────────────────
            curl -sS --fail \\
                -H "X-Vault-Token: \$VAULT_TOKEN" \\
                ${cfg.vaultAddr}/v1/${cfg.encKeyPath}/${encEnv} \\
                | jq -r '.data.data.public' > "\${WORKSPACE}/pub.pem"
            grep -q 'BEGIN PUBLIC KEY' "\${WORKSPACE}/pub.pem" \\
                || { echo "ERROR: invalid public enc-key for env=${encEnv}"; exit 1; }
            echo "Encrypt: using key for env=${encEnv}"

            # ── 3. JWE-encrypt OCI layers ──────────────────────────────
            rm -rf "\${WORKSPACE}/encrypted-oci"
            skopeo copy \\
                --encryption-key "jwe:\${WORKSPACE}/pub.pem" \\
                "oci:\${WORKSPACE}/oci-out" \\
                "oci:\${WORKSPACE}/encrypted-oci"

            # ── 4. Wipe plaintext immediately so it never reaches the registry
            rm -rf "\${WORKSPACE}/oci-out" "\${WORKSPACE}/pub.pem"

            unset VAULT_TOKEN
            echo "Encrypt: layers ready at \${WORKSPACE}/encrypted-oci/"
        """
    }
}
