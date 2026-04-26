// vars/podTemplate.groovy
//
// Returns the Kubernetes pod YAML used by the agent block. Loads the static
// template from `resources/pod-template.yaml` and substitutes a couple of
// placeholders (registry-credentials secret name + ssh-key secret name).
//
// Usage:  agent { kubernetes { yaml podTemplate(cfg) } }

def call(Map cfg = [:]) {
    cfg = [
        registryCredsSecret: 'registry-credentials',
        sshKeySecret:        'git-ssh-key',
    ] + cfg

    def yaml = libraryResource('pod-template.yaml')
    yaml = yaml.replace('${REGISTRY_CREDS_SECRET}', cfg.registryCredsSecret)
               .replace('${SSH_KEY_SECRET}',        cfg.sshKeySecret)
    return yaml
}
