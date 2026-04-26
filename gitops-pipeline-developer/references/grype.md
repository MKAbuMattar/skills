# Grype image scanning

How the pipeline scans the built image for known CVEs. Load this when configuring `grype.yaml` or tuning the severity gate.

## The flow

1. **Build the image as an OCI tarball** (BuildKit / Kaniko / buildah output `--output type=oci`).
2. **Generate an SBOM** with `syft` — gives Grype the package inventory in a stable format and lets you store the SBOM as an artifact.
3. **Scan with Grype** against the SBOM (preferred) or the image directly. Grype reads its config from `grype.yaml`; the severity gate fails the build.
4. **Persist the report** as a build artifact (JSON) so the score-aggregation step (`scripts/compute-score.sh`) can read it.

## `grype.yaml`

Copy `assets/templates/grype.yaml.template`. Key knobs:

```yaml
# Fail the build at this severity or higher.
# Tune over time: start at 'high', tighten to 'medium' once stable.
fail-on: high # negligible | low | medium | high | critical

# Vulnerability database — let Grype manage; don't pin unless the repo's
# build environment is air-gapped.
db:
  auto-update: true
  cache-dir: ~/.cache/grype/db

# Output
output: json # json | table | sarif | cyclonedx
file: grype-report.json

# Add to the build-artifact list separately. SARIF is best for GitHub
# Code Scanning, JSON for the score script.

# Ignore list — every entry MUST reference an issue or accepted-risk doc.
ignore:
  # CVE-2023-1234 — false positive on libfoo (issue #142)
  - vulnerability: CVE-2023-1234
    package:
      name: libfoo
  # CVE-2024-9999 — accepted risk; affects unused code path. (RISK-2024-03)
  - vulnerability: CVE-2024-9999
    package:
      name: openssl
      version: "<3.0.10"

# Only-fix mode — exit 1 only if there's a fix available. Useful for
# images on legacy bases where unpatchable CVEs are dropped from the gate
# but flagged for human review.
only-fixed: false
```

## Severity tiers

The CVSS bands Grype uses (consistent with NVD):

| Severity   | CVSS     | Rule of thumb                                                      |
| ---------- | -------- | ------------------------------------------------------------------ |
| Critical   | 9.0–10.0 | Exploitable remotely, no auth, total compromise. Ship a fix today. |
| High       | 7.0–8.9  | Exploitable in plausible config. Ship a fix this sprint.           |
| Medium     | 4.0–6.9  | Bounded impact or hard to exploit. Triage at next planning.        |
| Low        | 0.1–3.9  | Best-effort track. Often won't get a CVE update for years.         |
| Negligible | —        | Vendor flagged but no real impact. Watch only.                     |

`fail-on: high` is the right starting threshold for production images. `fail-on: critical` is for initial rollout when you have many existing finds; you ratchet to `high` once you've cleared them.

## Pipeline stage

```groovy
stage('Scan image (Grype)') {
    steps {
        sh """
            # Generate SBOM first (used by both the scan and as an artifact)
            syft "oci-archive:${WORKSPACE}/image.oci" \\
                -o cyclonedx-json=sbom.cdx.json \\
                -o table

            # Scan the SBOM (faster + more accurate than scanning the image)
            grype "sbom:./sbom.cdx.json" \\
                -c grype.yaml \\
                --fail-on \${GRYPE_FAIL_ON:-high} \\
                -o json=grype-report.json \\
                -o table

            archiveArtifacts artifacts: 'sbom.cdx.json,grype-report.json', fingerprint: true
        """
    }
}
```

For GitHub Actions: `anchore/scan-action@v3`. For GitLab CI: a `grype/grype` image step.

## Why scan the SBOM, not the image

- **Faster.** SBOM is tens of KB; the image is hundreds of MB.
- **More accurate for layered images.** `syft` understands the package managers in each layer; Grype's image-direct scan can miss multi-stage extracted binaries.
- **Reusable.** The SBOM you scan is the SBOM you ship as an artifact. One source of truth.

If `syft` isn't installed and the image is small, `grype <image>` works fine — just measurably slower.

## The ignore list — discipline

Every `ignore:` entry **must** carry a comment with one of:

- An issue number (`# CVE-2023-1234 — false positive on libfoo (issue #142)`)
- A "RISK-" identifier referencing an accepted-risk doc
- A timestamp + reason (`# CVE-2024-9999 — base image waiting on Alpine 3.20.3, est. 2025-01`)

Audit the list every quarter:

```bash
grep -E 'vulnerability:' grype.yaml | wc -l                    # total ignores
grep -B1 'vulnerability:' grype.yaml | grep -c '^# '           # ignores with comments
```

Those numbers should match. If they don't, you have unjustified ignores — fix the comments or remove the ignores.

## SBOM as a build artifact

Store `sbom.cdx.json` (CycloneDX format) as a build artifact. Use it for:

- **Compliance** — auditors love SBOMs.
- **Dependency change tracking** — diff today's SBOM against last release's to see "what changed".
- **License compliance** — `syft` extracts package licenses; downstream tools can flag GPL-incompatible deps.

Sign the SBOM with cosign alongside the image:

```bash
cosign attest --predicate sbom.cdx.json \
    --type cyclonedx \
    --key hashivault://cosign-key \
    "${REGISTRY}/${IMAGE}@${DIGEST}"
```

The signature is verifiable later via `cosign verify-attestation`.

## Common mistakes

- **`fail-on: critical` forever.** You're hiding "high" CVEs. Ratchet down once you've cleared the initial backlog.
- **Ignore entries without comments.** A future reader can't tell whether the ignore is still valid. Mandatory comment, mandatory audit.
- **Scanning the running container, not the image.** A running container has runtime state; you want a _deterministic_ scan of the artifact you're shipping.
- **Re-scanning ad hoc and not gating.** Grype must fail the pipeline when severity ≥ `fail-on`. A "nice to know" report doesn't gate; a passing build with unfixed criticals is the worst kind of green.
- **Air-gapped builds without a pinned DB snapshot.** Grype hits the public DB on every run by default. In air-gapped infra, mirror the DB and pin (`db.update-url`).
