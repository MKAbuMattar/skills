// vars/buildImage.groovy
//
// Build the container image with rootless BuildKit, output to OCI archive.
// The OCI archive is reusable downstream (skopeo push, syft+grype scan).
//
// Usage:  buildImage(cfg)
//   cfg.registry, cfg.org, cfg.image  (required)
//   cfg.dockerfile                    default '.'      (relative to context)
//   cfg.platform                      default 'linux/amd64'
//   cfg.buildArgs                     map of --build-arg KV pairs

def call(Map cfg = [:]) {
    cfg = [dockerfile: '.', platform: 'linux/amd64', buildArgs: [:]] + cfg
    def fullImage = "${cfg.registry}/${cfg.org}/${cfg.image}"
    env.FULL_IMAGE = fullImage

    def buildArgFlags = cfg.buildArgs.collect { k, v -> "--opt build-arg:${k}=${v}" }.join(' ')

    container('tools') {
        sh """
            set -eo pipefail
            rm -rf "\${WORKSPACE}/oci-out" "\${WORKSPACE}/image.oci"
            buildctl build \\
                --frontend dockerfile.v0 \\
                --local context=. \\
                --local dockerfile=${cfg.dockerfile} \\
                --opt platform=${cfg.platform} \\
                ${buildArgFlags} \\
                --output type=oci,dest=\${WORKSPACE}/image.oci,name=${fullImage}:${env.VERSION}
            mkdir -p \${WORKSPACE}/oci-out
            tar -xf \${WORKSPACE}/image.oci -C \${WORKSPACE}/oci-out
        """
    }
}
