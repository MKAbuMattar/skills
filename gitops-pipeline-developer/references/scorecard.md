# Score & Alignments

How the pipeline aggregates Sonar + Grype + repo-policy checks into a single 0–100 score plus a list of pass/fail alignment checks. Load this when designing the scorecard or tuning the gate threshold.

## What the scorecard is

Two halves, kept separate:

- **Score (0–100)** — a weighted combination of _quantitative_ axes (code quality, coverage, security). Numeric. Lets you set a threshold (default: 70).
- **Alignments (pass/fail list)** — _categorical_ policies that must hold (Conventional Commits in the last N commits, LICENSE present, README has a Pipeline section, branch matches Gitflow naming, etc.). Failing any alignment fails the gate regardless of the numeric score.

A single composite number hides categorical failures — "no LICENSE file" should not be drowned by 95% test coverage. Two halves let you tune each independently.

The pipeline calls `scripts/compute-score.sh <sonar.json> <grype.json>` and the script prints both halves as a Markdown scorecard plus emits `score.json` for downstream tools.

## Score composition (default weights)

```
Total = 0.35 × CodeQuality
      + 0.25 × Coverage
      + 0.30 × Security
      + 0.10 × ReleaseHygiene
```

Each component normalizes to 0–100. Tune weights to your team's priorities; document changes in the scorecard reference at the top of `compute-score.sh`.

### CodeQuality (0–100)

From SonarQube quality gate response:

| Sonar metric (new code) | Maps to                                       | Notes                  |
| ----------------------- | --------------------------------------------- | ---------------------- |
| Reliability rating      | A=100, B=80, C=60, D=40, E=20                 | New bugs               |
| Security rating         | A=100, B=80, C=60, D=40, E=20                 | New vulnerabilities    |
| Maintainability rating  | A=100, B=80, C=60, D=40, E=20                 | New code smells        |
| Duplication on new code | (1 − dup_pct/0.10) × 100, clamped to [0, 100] | 0% dup → 100; 10%+ → 0 |

Average the four. That's `CodeQuality`.

### Coverage (0–100)

Coverage on new code, scaled:

```
0%    → 0
50%   → 30
70%   → 60       ← typical "passing" threshold
80%   → 80
90%+  → 100
```

Piecewise-linear (not strictly proportional) so the curve rewards the last few percent more. Tweak the breakpoints in `compute-score.sh` if your team targets a different bar.

### Security (0–100)

From Grype JSON, count by severity:

```
Security = 100
         − 100 × min(critical, 1)        # any critical → 0
         − 25  × high
         − 5   × medium
         − 1   × low
clamped to [0, 100]
```

Any critical zeros the security score regardless of other factors. High has a steep penalty (4 highs → 0). Mediums and lows accumulate gently but visibly.

### ReleaseHygiene (0–100)

Repo policy checks worth quantifying (each contributes 20 points if it passes, 0 if it doesn't):

1. ≥ 90% of the last 50 commits parse as Conventional Commits
2. CHANGELOG.md exists and was updated in the last release
3. The image was signed with cosign in this run
4. The pipeline ran on a branch matching the Gitflow regex
5. The merge commit (if any) was a squash or rebase, not a 3-way merge

## Alignments (pass / fail)

Each alignment is a one-line policy. Failing any alignment fails the gate, regardless of score.

Default alignment catalog:

| Alignment                               | Check                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------ | ------- | ---------- | ---------- | ------------ |
| `LICENSE file present`                  | `[ -f LICENSE ]`                                                                     |
| `README has a Pipeline section`         | `grep -q '^## *Pipeline' README.md`                                                  |
| `Last 50 commits ≥ 90% Conventional`    | Parse with `commitlint --from <50-back> --to HEAD`; count failures                   |
| `Branch follows Gitflow regex`          | `git branch --show-current` matches `^(main                                          | develop | feature/.+ | release/.+ | hotfix/.+)$` |
| `Image is signed by cosign`             | `cosign verify --key <pubkey> <image>@<digest>` exits 0                              |
| `SBOM exists for this build`            | `[ -s sbom.cdx.json ]`                                                               |
| `Pipeline updated GitOps repo`          | `git log -1 --grep='\[skip ci\]' origin/<gitops-branch>` returns this build's commit |
| `No CVEs ignored without comment`       | Each `ignore:` entry in `grype.yaml` has a comment line above it                     |
| `Sonar quality gate is BLOCK, not WARN` | `curl /api/qualitygates/show?name=<gate>` shows conditions with `op=BLOCK`           |

Customize the catalog for your repo. The script reads the catalog from `align.yaml` if present, falling back to defaults.

## The threshold

Default: **fail the build at score < 70 OR any alignment failure**.

Tune by:

- Lowering threshold for repos with deep technical debt; raise as you ratchet.
- Raising threshold for libraries (publish bar > service bar).
- Differentiating by branch — `main` requires 70+, `develop` requires 50+, `feature/*` reports only.

In the pipeline:

```groovy
stage('Score & Alignments') {
    steps {
        sh '''
            bash scripts/compute-score.sh sonar-report.json grype-report.json
        '''
        archiveArtifacts artifacts: 'score.json,scorecard.md', fingerprint: true
        script {
            def score = readJSON file: 'score.json'
            if (score.aggregate < 70 || score.alignments_failed > 0) {
                error("Score gate failed — see scorecard.md")
            }
        }
    }
}
```

## Scorecard output (Markdown)

The script writes `scorecard.md` for human eyes:

```markdown
# Build Scorecard — myapp v1.5.0-rc.2+a8d3538

## Score: **78 / 100** ✅

| Axis           | Score | Weight | Contribution |
| -------------- | ----- | ------ | ------------ |
| CodeQuality    | 80    | 0.35   | 28.0         |
| Coverage       | 72    | 0.25   | 18.0         |
| Security       | 75    | 0.30   | 22.5         |
| ReleaseHygiene | 95    | 0.10   | 9.5          |
| **Total**      |       |        | **78.0**     |

## Alignments (8 of 9 passing)

- ✅ LICENSE file present
- ✅ README has a Pipeline section
- ✅ Last 50 commits ≥ 90% Conventional
- ✅ Branch follows Gitflow regex (`release/1.5.x`)
- ✅ Image is signed by cosign
- ✅ SBOM exists for this build
- ✅ Pipeline updated GitOps repo
- ❌ No CVEs ignored without comment ← grype.yaml line 12 missing comment
- ✅ Sonar quality gate is BLOCK, not WARN

**Result:** ❌ Failing — 1 alignment check failed (score is sufficient).
```

## Common mistakes

- **One number to rule them all.** The score is a forecast; alignments are facts. Roll them together and you'll ship missing-LICENSE images with a green gate.
- **Threshold set before measuring.** Run the pipeline against the last 10 builds with no threshold first. Pick a threshold at the 60th percentile so initial rollouts pass; ratchet up.
- **Score weighted towards what you measure best.** Coverage is easy to game; security is harder. Don't over-weight the easy axis.
- **Alignment list ossified.** Review the catalog every quarter. Old policies stick around long after they stop mattering.
- **No artifact.** `score.json` and `scorecard.md` must be archived per build so trends are visible. A green/red gate without history teaches nothing.
