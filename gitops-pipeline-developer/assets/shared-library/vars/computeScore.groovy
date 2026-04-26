// vars/computeScore.groovy
//
// Run scripts/compute-score.sh, archive score.json + scorecard.md, and fail
// the build if the aggregate score < threshold OR any alignment failed.
//
// Usage:  computeScore(cfg)
//   cfg.scoreThreshold   default 70
//   cfg.scoreScript      default 'scripts/compute-score.sh'

def call(Map cfg = [:]) {
    cfg = [scoreThreshold: 70, scoreScript: 'scripts/compute-score.sh'] + cfg
    container('tools') {
        sh "bash ${cfg.scoreScript} sonar-report.json grype-report.json"
    }
    archiveArtifacts artifacts: 'score.json,scorecard.md', fingerprint: true
    script {
        def s = readJSON file: 'score.json'
        echo "Score: ${s.aggregate}/100  Alignments failing: ${s.alignments_failed}"
        if (s.aggregate < (cfg.scoreThreshold as Integer) || s.alignments_failed > 0) {
            error("Score gate failed — see scorecard.md")
        }
    }
}
