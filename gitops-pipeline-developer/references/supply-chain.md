# Supply-chain hardening for runtime tool installs

Mitigates Snyk audit finding **W012 — Unverifiable external dependency**. Load this when the pipeline downloads any binary at runtime (cosign, grype, syft, sonar-scanner, …) — pinning + verification is mandatory, not optional.

## Two paths, in order of preference

### Path 1 (preferred) — Pre-baked tools image

Build a container image that already contains the auxiliary tools and reference it by **digest** in the agent pod template. The skill ships `assets/templates/Dockerfile.tools-image.template` as the starting point.

```dockerfile
# Dockerfile.tools-image — built once, pinned by digest in the pod template
FROM alpine/k8s:1.31.4
ARG COSIGN_VER=v2.4.1
ARG GRYPE_VER=v0.84.0
ARG SYFT_VER=v1.18.1
ARG SONAR_VER=5.0.1.3006

# … see template for the full content with checksum verification …
```

In the pod template:

```yaml
- name: tools
  image: ghcr.io/<your-org>/jenkins-tools@sha256:<digest>   # immutable
```

Why this is preferred:

- Build runs **once** in a controlled environment, not on every pipeline run.
- The image is **content-addressed by digest**, so a compromised registry can't swap a different image past the agent.
- Cosign-sign the image in your own pipeline; the cluster's `verifyImages` policy checks the signature on pull (matches the same supply-chain story for application images).
- Pipelines start faster — no per-run download / extract.

### Path 2 (fallback) — Runtime install with pinning + verification

When you can't host a pre-baked image (e.g. shared Jenkins controller, no team registry), download at runtime but apply **all four** controls:

1. **Pin to a specific tagged version** — never `latest`, never `main`, never a moving HEAD.
2. **Verify SHA256** — every downloaded artifact gets a checksum check before it runs.
3. **Verify cosign signatures** when the upstream signs (sigstore tools, cosign itself, syft, grype).
4. **Pin install scripts** to a specific commit SHA, not `main`.

The skill's `vars/setupTools.groovy` and the monolithic `Jenkinsfile.template` Setup Tools stage demonstrate the pattern.

## Pinning matrix

| Tool          | Source                                                                                     | Pin format                                      | Verification                                       |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| cosign        | `https://github.com/sigstore/cosign/releases/download/<TAG>/cosign-linux-amd64`             | git tag (e.g. `v2.4.1`)                          | SHA256 from release page **AND** cosign self-verify (cosign verifies itself with the previous version, or via Rekor) |
| grype         | `https://raw.githubusercontent.com/anchore/grype/<COMMIT_SHA>/install.sh`                   | full git commit SHA of install.sh, plus the binary tag (`-- -b <dir> <TAG>`) | SHA256 of install.sh; grype binary is signed (cosign verify) |
| syft          | `https://raw.githubusercontent.com/anchore/syft/<COMMIT_SHA>/install.sh`                    | full git commit SHA, plus binary tag             | Same as grype                                      |
| sonar-scanner | `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-<VER>-linux.zip` | exact version (e.g. `5.0.1.3006`)              | SHA256 published at `<URL>.sha256` next to the zip |

## Looking up the right SHA256

For each tool, the procedure is: pick a version → fetch the canonical SHA from the upstream's signed manifest → record it in your `setupTools` config.

### cosign

```bash
VER=v2.4.1
curl -fsSL "https://github.com/sigstore/cosign/releases/download/${VER}/cosign-linux-amd64-keyless.pem" -o /tmp/cert.pem
curl -fsSL "https://github.com/sigstore/cosign/releases/download/${VER}/cosign-linux-amd64-keyless.sig" -o /tmp/sig
curl -fsSL "https://github.com/sigstore/cosign/releases/download/${VER}/cosign-linux-amd64" -o /tmp/cosign
sha256sum /tmp/cosign
# Use the resulting SHA in your setupTools COSIGN_SHA variable.

# When cosign is already present (from the previous version), self-verify the new release:
cosign verify-blob \
    --certificate /tmp/cert.pem \
    --signature   /tmp/sig \
    --certificate-identity "https://github.com/sigstore/cosign/.github/workflows/release.yaml@refs/tags/${VER}" \
    --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
    /tmp/cosign
```

### grype / syft (Anchore)

Anchore signs every release with cosign keyless. Fetch the install script *at a specific commit*, hash it, then trust it to download a *signed* binary at the version you specify:

```bash
# Get the install.sh's commit SHA and content hash
GRYPE_INSTALL_SHA=$(git ls-remote https://github.com/anchore/grype refs/heads/main | awk '{print $1}')
curl -fsSL "https://raw.githubusercontent.com/anchore/grype/${GRYPE_INSTALL_SHA}/install.sh" -o /tmp/grype-install.sh
sha256sum /tmp/grype-install.sh

# Then in setupTools:
echo "<SHA>  /tmp/grype-install.sh" | sha256sum -c -
sh /tmp/grype-install.sh -b /usr/local/bin v0.84.0   # binary version is verified by the install script
```

### sonar-scanner

SonarSource publishes a `.sha256` next to every download:

```bash
VER=5.0.1.3006
URL="https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${VER}-linux.zip"
EXPECTED=$(curl -fsSL "${URL}.sha256" | awk '{print $1}')
echo "SONAR_SHA=${EXPECTED}"
```

## How to update pinned versions safely

Once a quarter (or after a CVE notice for a pinned version):

1. **Read the upstream changelog.** Don't bump versions blindly; read the release notes for breaking changes.
2. **Run the lookup procedure above** to get the new SHA.
3. **Update the pin in a separate PR** that touches *only* the version + SHA. This makes audit trivial and rollback one-line.
4. **Run the full pipeline once** in a non-production environment with the new version before merging.
5. **Sign the commit** if your repo enforces signed commits (it should).

## Anti-patterns

- **`releases/latest/...`** — pulls whatever ships today, no pin, no verification.
- **`/main/install.sh | sh`** — install scripts are shell code; running an unverified one is RCE-by-design.
- **Skipping verification because "it's official upstream"** — supply-chain attacks routinely target official upstream pipelines (xz utils, event-stream, etc.).
- **Dynamic checksums** — fetching the SHA from the same URL/CDN that serves the binary defeats the verification entirely.
- **Comments saying "TODO add SHA later"** — never ship without the SHA. Block the PR.

## Threat model

This guide mitigates:

- **Tampered binary at the registry** — caught by SHA256 verification.
- **MITM on the download** — caught by HTTPS + SHA256 verification.
- **Compromised upstream release** — partially mitigated by cosign signature verification (when the upstream signs); fully mitigated only by air-gapped mirroring.
- **Supply-chain hop attack** — install scripts pinned by commit SHA; binary version pinned by tag.

It does NOT mitigate:

- A signed-but-malicious release from an upstream the supply chain trusts. For that you'd need provenance attestations (SLSA) and reproducible builds.
- A compromised Vault that serves a wrong public encryption key. Out of scope here; see `references/security-levels.md`.
