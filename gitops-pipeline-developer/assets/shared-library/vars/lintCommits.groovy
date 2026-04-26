// vars/lintCommits.groovy
//
// Conventional Commits gate. Must run BEFORE any expensive stage so a bad
// commit message fails the build cheaply.
//
// Usage:  lintCommits()

def call() {
    container('tools') {
        sh '''
            set -e
            LAST="$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)"
            echo "Linting commits ${LAST}..HEAD"
            commitlint --from "${LAST}" --to HEAD
        '''
    }
}
