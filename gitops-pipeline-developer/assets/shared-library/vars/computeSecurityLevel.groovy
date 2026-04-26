// vars/computeSecurityLevel.groovy
//
// Resolve the effective security level for this pipeline run. Gitflow-aware:
// the Conventional-Commit / SemVer / branch chain implies the right level,
// so 'auto' (the default) consults the branch and picks one.
//
// Returns one of: 'none' | 'sign-only' | 'encrypt-only' | 'sign-and-encrypt'.
// Always sets env.SECURITY_LEVEL too, for downstream `when {}` clauses.
//
// Usage:  def lvl = computeSecurityLevel(params.SECURITY_LEVEL ?: 'auto')

def call(String requested = 'auto') {
    def valid = ['none', 'sign-only', 'encrypt-only', 'sign-and-encrypt'] as Set
    def lvl

    if (requested == 'auto' || !requested) {
        // Branch-driven default. Tune to match your release model.
        def branch = env.BRANCH_NAME ?: ''
        if (branch == 'main')                   lvl = 'sign-and-encrypt'
        else if (branch.startsWith('release/')) lvl = 'sign-and-encrypt'
        else if (branch.startsWith('hotfix/'))  lvl = 'sign-and-encrypt'
        else if (branch == 'develop')           lvl = 'sign-only'
        else if (branch.startsWith('feature/')) lvl = 'none'
        else                                    lvl = 'sign-only'
        echo "Security level (auto, branch=${branch}): ${lvl}"
    } else {
        if (!(requested in valid)) {
            error("Invalid SECURITY_LEVEL: '${requested}' — pick one of ${valid}")
        }
        lvl = requested
        echo "Security level (override): ${lvl}"
    }

    env.SECURITY_LEVEL    = lvl
    env.IMG_DO_ENCRYPT    = (lvl in ['encrypt-only', 'sign-and-encrypt']) ? 'true' : 'false'
    env.IMG_DO_SIGN       = (lvl in ['sign-only',    'sign-and-encrypt']) ? 'true' : 'false'
    return lvl
}
