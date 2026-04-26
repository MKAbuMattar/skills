# Image Security Levels

Four levels of supply-chain protection on the built container image, controllable per-build by the `SECURITY_LEVEL` parameter and **auto-derived from the Gitflow branch by default**. Load this when configuring the pipeline's signing/encryption behaviour or when explaining the choice to reviewers.

## The four levels

| Level                | What runs after `buildImage`                                            | Cluster needs                                                                                       | Use case                                                  |
| -------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **`none`**           | Push plain image. No cosign, no encryption.                             | nothing — pulls work everywhere                                                                     | Local dev rebuilds, parity testing, debugging the pipeline itself |
| **`sign-only`**      | Push plain image, then `cosign sign` with a Vault / KMS key.            | Kyverno (or equivalent) `verifyImages` policy at admission                                          | Shared dev / staging environments                         |
| **`encrypt-only`**   | Encrypt OCI layers with a JWE public key, push ciphertext, no signature.| Node-level **ocicrypt** + a `SecretProviderClass` mounting the matching private key on every node   | Rare — usually paired with sign for production            |
| **`sign-and-encrypt`** | Both — encrypt then sign. The "Double Lock".                          | ocicrypt **and** Kyverno `verifyImages`                                                             | Production / regulated environments                       |

The level is **enforced by the cluster**, not the pipeline. The pipeline produces the artifact in the right shape; admission control on the cluster side rejects anything weaker than its policy demands. Keep that mental separation: pipeline = produces, cluster = enforces.

## Auto-derivation from Gitflow

When `SECURITY_LEVEL=auto` (the default), the orchestrator picks based on the current branch:

| Branch          | Default level       | Rationale                                                        |
| --------------- | ------------------- | ---------------------------------------------------------------- |
| `main`          | `sign-and-encrypt`  | Production-bound — strongest guarantees                          |
| `release/*`     | `sign-and-encrypt`  | Release candidate — same image artifact ships to prod            |
| `hotfix/*`      | `sign-and-encrypt`  | Production-bound by definition                                   |
| `develop`       | `sign-only`         | Shared environment — admission policy can require signatures     |
| `feature/*`     | `none`              | Per-PR previews; fast feedback over guarantees                   |
| any other       | `sign-only`         | Conservative default                                             |

The mapping lives in `vars/computeSecurityLevel.groovy` (modular path) and the equivalent `script {}` block in the monolithic `Jenkinsfile.template`. **Override** by passing `SECURITY_LEVEL=<level>` as a build parameter — useful for one-off rebuilds (`SECURITY_LEVEL=none` to skip the Vault round-trip during pipeline debugging) or for forcing a stronger level than the default.

## How the pipeline implements each level

After `Build Image` produces `image.oci`, three conditional stages run:

```
                                              ┌─────────────────┐
                  Build Image  ────────────► │ image.oci (plain)│
                                              └────────┬────────┘
                                                       │
   if level ∈ {encrypt-only, sign-and-encrypt}         │
                ▼                                      │
   ┌───────────────────────────────┐                   │
   │ Encrypt Image                 │                   │
   │   skopeo copy --encryption-key│                   │
   │     jwe:pub.pem               │                   │
   │   → encrypted-oci/            │                   │
   │   wipe oci-out/               │                   │
   └───────────────┬───────────────┘                   │
                   │                                   │
                   ▼                                   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Push Image                                                  │
   │   src = encrypted? "oci:encrypted-oci" : "oci:oci-out"      │
   │   skopeo copy "$src" docker://registry/...                  │
   │   --format v2s2 ONLY for plain (encrypted needs OCI)        │
   └───────────────────────────┬─────────────────────────────────┘
                               │
   if level ∈ {sign-only, sign-and-encrypt}
                               ▼
                   ┌─────────────────────────────┐
                   │ Sign Image                  │
                   │   cosign sign --yes         │
                   │     --key hashivault://…    │
                   │     <image>@<digest>        │
                   │   cosign attest sbom.cdx.json│
                   └─────────────────────────────┘
```

## What each level needs from Vault

| Capability  | Vault path                              | Used at                | Required for                    |
| ----------- | --------------------------------------- | ---------------------- | ------------------------------- |
| Transit key | `transit/keys/<name>` (e.g. `cosign-key`) | Sign step              | `sign-only`, `sign-and-encrypt` |
| KV pair     | `secret/data/enc-keys/<env>` (`public`) | Encrypt step (build)   | `encrypt-only`, `sign-and-encrypt` |
| KV pair     | `secret/data/enc-keys/<env>` (`private`)| Decrypt (cluster, not pipeline) | `encrypt-only`, `sign-and-encrypt` |

The pipeline's K8s service account exchanges its projected JWT for a short-lived Vault token via Kubernetes auth (`auth/kubernetes/login`). The role bound to that SA gets the minimal policy: read transit + read KV public. **The private key never crosses the pod boundary** — the cluster's CSI Vault provider mounts it on the worker node at pod-pull time.

## Format-flag gotcha (push step)

When pushing, the manifest format depends on whether the image is encrypted:

| Source       | `skopeo copy` flag    | Why                                                                                            |
| ------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| Plain (OCI)  | `--format v2s2`       | Some registries reject OCI indexes with attestations; v2s2 is the safe default for plain images |
| Encrypted    | (no `--format` flag) — push as OCI | The v2s2 schema doesn't define media types for `vnd.oci.image.layer.v1.tar+gzip+encrypted`; modern registries accept single-arch OCI manifests for non-attested encrypted images |

`vars/pushImage.groovy` honours this automatically when given `encrypted: true`.

## Per-commit / per-release override (advanced)

If you want a particular release to ship at a stronger level than its branch's default — say a hotfix that includes a security-sensitive change must always be encrypted even on `release/*` — you can read a footer from the Conventional Commit and force-promote:

```bash
# In the pipeline's Compute Version stage, after deriving NEXT_VERSION
if git log -1 --pretty=%B | grep -qE '^Security-Level: '; then
    LEVEL=$(git log -1 --pretty=%B | grep -E '^Security-Level: ' | head -1 | awk '{print $2}')
    echo "Commit footer overrides security level → $LEVEL"
    export SECURITY_LEVEL="$LEVEL"
fi
```

This is **opt-in** — most teams don't need it. The branch-based default is sufficient because Gitflow already correlates branch lifecycle with deployment target.

## Common mistakes

- **`SECURITY_LEVEL=none` left as the default.** Auto-derivation is the default for a reason — turning it off site-wide leaks unsigned images to prod.
- **Pinning `SECURITY_LEVEL` per-job in Jenkins.** That sticks across re-runs and overrides the branch-aware default. Use it sparingly, and for one-off rebuilds, set it via the parameterized build dialog so it doesn't persist.
- **Encrypt without sign.** `encrypt-only` is rarely what you want — encryption proves nothing about origin. If the registry is compromised, an attacker can't read the image but they can swap a fresh encrypted image of their own. Pair encryption with signing for any non-trivial threat model.
- **Cosign keys checked into env vars.** Always reference via `hashivault://`, `awskms://`, `gcpkms://`. The CI service account authenticates short-lived; the private key never enters the pod.
- **Stage-skipped silently.** A `when { expression { ... } }` clause that evaluates false skips the stage with no log entry. Always emit a single `echo` at the start of the pipeline showing the effective security level so reviewers can audit.
