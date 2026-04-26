// vars/scanImage.groovy
//
// Generate an SBOM with syft and scan it with grype. Scanning the SBOM (not
// the image directly) is faster and more accurate for multi-stage builds.
//
// Usage:  scanImage(cfg)
//   cfg.grypeFailOn   default 'high'
//   cfg.grypeConfig   default 'grype.yaml'

def call(Map cfg = [:]) {
    cfg = [grypeFailOn: 'high', grypeConfig: 'grype.yaml'] + cfg

    container('tools') {
        sh """
            set -e
            syft "oci-archive:\${WORKSPACE}/image.oci" \\
                -o cyclonedx-json=sbom.cdx.json \\
                -o table

            grype "sbom:./sbom.cdx.json" \\
                -c ${cfg.grypeConfig} \\
                --fail-on ${cfg.grypeFailOn} \\
                -o json=grype-report.json \\
                -o table
        """
    }
    archiveArtifacts artifacts: 'sbom.cdx.json,grype-report.json', fingerprint: true
}
