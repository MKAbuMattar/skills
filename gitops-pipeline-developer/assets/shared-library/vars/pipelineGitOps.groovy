// vars/pipelineGitOps.groovy
//
// Top-level orchestrator. The whole modular pipeline collapses to:
//
//     @Library('gitops-pipeline@main') _
//     pipelineGitOps([
//         registry:       'ghcr.io',
//         org:            'acme',
//         image:          'api',
//         chartRepo:      'git@github.com:acme/charts.git',
//         chartBranch:    'main',
//         valuesFile:     'envs/${env.CHANNEL}/values.yaml',
//         scoreThreshold: 70,
//         grypeFailOn:    'high',
//         // securityLevel: 'auto',     ← derived from branch by default
//     ])
//
// Each stage is its own `vars/<stage>.groovy` so it's reusable in isolation.
// The Encrypt / Sign stages are conditional on env.SECURITY_LEVEL, computed
// once at the start by computeSecurityLevel(). See references/security-levels.md.

def call(Map cfg = [:]) {
    cfg = [
        // Defaults — override per repo
        chartBranch:    'main',
        valuesFile:     'values.yaml',
        scoreThreshold: 70,
        grypeFailOn:    'high',
        cosignKeyRef:   'hashivault://cosign-key',
        skipScan:       false,
    ] + cfg

    pipeline {
        agent {
            kubernetes { yaml podTemplate(cfg) }
        }
        parameters {
            choice(name: 'BUMP',     choices: ['auto','patch','minor','major'], description: 'SemVer bump (auto = derive from Conventional Commits)')
            choice(name: 'CHANNEL',  choices: ['auto','release','rc','beta','alpha','hotfix'], description: 'Release channel (auto = derive from branch)')
            choice(name: 'SECURITY_LEVEL',
                   choices: ['auto','none','sign-only','encrypt-only','sign-and-encrypt'],
                   description: 'Image security: auto (default — derive from branch), or override. See references/security-levels.md.')
            booleanParam(name: 'SKIP_SCAN', defaultValue: false, description: 'Skip Sonar + Grype (debug only)')
        }
        stages {
            stage('Setup Tools')        { steps { setupTools()                                     } }
            stage('Lint Commits')       { steps { lintCommits()                                    } }
            stage('Compute Version')    { steps { computeVersion()                                 } }
            stage('Resolve Security')   { steps { script { computeSecurityLevel(params.SECURITY_LEVEL) } } }
            stage('Lint & Test')        { steps { lintAndTest()                                    } }
            stage('SonarQube')          { when { expression { !params.SKIP_SCAN } }
                                          steps { sonarScan(cfg)                                   } }
            stage('Build Image')        { steps { buildImage(cfg)                                  } }
            stage('SBOM + Grype')       { when { expression { !params.SKIP_SCAN } }
                                          steps { scanImage(cfg)                                   } }
            stage('Encrypt Image')      { when { expression { env.IMG_DO_ENCRYPT == 'true' } }
                                          steps { encryptImage(cfg)                                } }
            stage('Push Image')         { steps { pushImage(cfg)                                   } }
            stage('Sign Image')         { when { expression { env.IMG_DO_SIGN == 'true' } }
                                          steps { signImage(cfg)                                   } }
            stage('GitOps Update')      { steps { updateGitOps(cfg)                                } }
            stage('Score & Alignments') { steps { computeScore(cfg)                                } }
        }
        post {
            success { notify(cfg + [status: 'SUCCESS']) }
            failure { notify(cfg + [status: 'FAILURE']) }
        }
    }
}
