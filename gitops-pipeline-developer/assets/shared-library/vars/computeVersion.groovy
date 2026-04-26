// vars/computeVersion.groovy
//
// Derive the next SemVer from commit history (semantic-release dry-run) or
// fall back to a checked-in VERSION file. Appends a +<short-sha> suffix to
// every prerelease so each build produces a unique image tag.
//
// Sets:  env.VERSION, env.IS_RELEASE
// Usage: computeVersion()

def call() {
    container('tools') {
        script {
            env.CURRENT_STAGE = 'Compute Version'
            def ver = sh(returnStdout: true, script: '''
                if [ -f .releaserc.json ] || [ -f .releaserc ]; then
                    npx --no-install semantic-release --dry-run 2>/dev/null \
                      | sed -n 's/.*next release version is \\(.*\\)/\\1/p' | tail -1
                elif [ -f VERSION ]; then
                    cat VERSION
                else
                    echo "0.0.0"
                fi
            ''').trim()
            if (!ver) { ver = readFile('VERSION').trim() }

            def isRelease = (env.BRANCH_NAME == 'main')
            def shortSha  = (env.GIT_COMMIT ?: 'unknown').take(7)
            if (!isRelease && !ver.contains('+')) { ver = "${ver}+${shortSha}" }

            env.VERSION    = ver
            env.IS_RELEASE = isRelease ? 'true' : 'false'
            currentBuild.displayName = "#${env.BUILD_NUMBER} v${ver}"
            echo "Version: ${ver}  (release=${env.IS_RELEASE})"
        }
    }
}
