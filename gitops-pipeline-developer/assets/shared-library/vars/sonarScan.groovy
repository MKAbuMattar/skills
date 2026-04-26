// vars/sonarScan.groovy
//
// SonarQube scan + quality-gate wait. Requires:
//   * SonarQube Jenkins plugin
//   * `sonarqube-server` configured under Manage Jenkins → System
//   * Webhook from SonarQube → Jenkins (otherwise waitForQualityGate hangs)
//
// Saves the gate result to sonar-report.json for the score script.
//
// Usage:  sonarScan(cfg)
//   cfg.sonarServerName  default 'sonarqube-server'
//   cfg.gateTimeoutMin   default 10

def call(Map cfg = [:]) {
    cfg = [sonarServerName: 'sonarqube-server', gateTimeoutMin: 10] + cfg
    withSonarQubeEnv(cfg.sonarServerName) {
        container('tools') {
            sh """
                sonar-scanner \\
                    -Dsonar.projectVersion=${env.VERSION} \\
                    -Dsonar.pullrequest.key=${env.CHANGE_ID ?: ''} \\
                    -Dsonar.pullrequest.branch=${env.CHANGE_BRANCH ?: ''} \\
                    -Dsonar.pullrequest.base=${env.CHANGE_TARGET ?: ''}
            """
        }
    }
    timeout(time: cfg.gateTimeoutMin, unit: 'MINUTES') {
        waitForQualityGate abortPipeline: true
    }
    container('tools') {
        sh '''
            KEY="$(grep -oE '^sonar.projectKey=.*' sonar-project.properties | cut -d= -f2)"
            curl -sS -u "${SONAR_AUTH_TOKEN}:" \
                "${SONAR_HOST_URL}/api/qualitygates/project_status?projectKey=${KEY}" \
                > sonar-report.json
        '''
    }
}
