---
name: gitops-cd-developer
description: Author production GitOps continuous-delivery setups — the App-of-Apps pattern (ArgoCD or Flux) where a root Application spawns N child Applications that auto-sync, self-heal, and prune; reusable shareable Helm charts with multi-runtime defaults (Node.js / PHP / Java / static), HPA, probes, init containers, ingress, HTTPRoute; multi-environment values layout (dev / staging / prod, multi-instance, multi-region); and progressive deployment strategies (RollingUpdate / Recreate / blue-green / canary). Use this skill whenever the user wants to set up GitOps CD, design an App-of-Apps tree, build a sharable Helm chart, structure values.yaml across environments / instances / regions, choose a rollout strategy, configure ArgoCD sync waves and self-heal, package + push a chart to an OCI registry, or hits you with phrases like "set up ArgoCD", "app-of-apps", "GitOps for k8s", "sharable Helm chart", "multi-tenant chart", "canary deploy", "rollout strategy", "progressive delivery", or "deploy to multiple envs".
license: MIT. See LICENSE for full terms.
compatibility: ArgoCD 2.10+ (default target) — patterns also map to Flux 2 with `Kustomization` + `HelmRelease`. Helm 3.14+. Kubernetes 1.27+. Optional - Argo Rollouts for canary / blue-green; Gateway API for HTTPRoute; OCI-capable registry for chart distribution.
metadata:
  author: mkabumattar
  version: "1.0.0"
---

# GitOps CD Developer

CD half of the GitOps loop: a **root Application** spawns child Applications, each of which renders a **shareable Helm chart** with **per-environment values** and a **chosen rollout strategy**. ArgoCD sees the diff, syncs, self-heals, prunes — no `kubectl apply` from a CI pipeline.

## When to use

- The user wants to set up ArgoCD / Flux for the first time.
- The user wants to design an **App-of-Apps tree** so one root manages many envs / instances / tenants.
- The user wants a **sharable Helm chart** their other repos can consume (multi-runtime, multi-env).
- The user wants to choose / wire a **rollout strategy**: RollingUpdate, Recreate, blue-green, canary.
- The user wants `values-dev.yaml` / `values-staging.yaml` / `values-prod.yaml` laid out cleanly.
- A task chain ends in "and ArgoCD picks it up automatically".

Pairs with **`gitops-pipeline-developer`** (the CI half — produces images and updates `values.yaml`). Together: CI pushes the image + tag + digest to GitOps; CD reconciles cluster state from the GitOps repo.

## The release loop in one paragraph

CI produces a signed image and writes the new tag + digest into a `values.yaml` in a **GitOps repo**. The **root ArgoCD Application** in the management cluster watches a folder of child Application templates; each child points at the GitOps repo and renders one or more workloads via a shared Helm chart. ArgoCD's **automated sync** sees the values-file change, performs `helm template`, diffs against the live cluster, applies changes with `ServerSideApply`, and reports `Healthy / Synced`. **Self-heal** undoes drift; **prune** removes resources no longer in git. The cluster's state is, by definition, what's in git.

## Required structure

A typical GitOps CD layout has **three** repos (or three trees in one monorepo):

```
gitops/
├── app-of-apps/                 # Root + per-env child Applications
│   ├── projects.yaml            # AppProject (security boundary)
│   ├── root-application.yaml    # The root Application (the one human applies once)
│   ├── envs/
│   │   ├── dev/
│   │   │   ├── Chart.yaml       # Helm chart that renders ArgoCD Applications
│   │   │   ├── values.yaml      # which apps to spawn in dev
│   │   │   └── templates/
│   │   │       └── apps.yaml    # one Application per app
│   │   ├── staging/
│   │   └── prod/
│   └── README.md
├── helm-chart-template/         # The shareable chart (published to OCI registry)
│   └── helm-chart-template/
│       ├── Chart.yaml
│       ├── values.yaml          # full schema with sane defaults
│       ├── templates/
│       └── README.md
└── consumer-chart/              # Per-app chart that depends on the template
    ├── Chart.yaml               # dependency: helm-chart-template
    ├── values-dev.yaml          # tag, digest, env-specific overrides
    ├── values-staging.yaml
    └── values-prod.yaml
```

Don't invent a parallel layout if the team already has one — extend it.

## Workflow

1. **Discover the existing setup.** Check for existing ArgoCD / Flux installs, repo layout, registered AppProjects, current Helm charts, current `values-*.yaml` shapes. The new design **extends** what's there.
2. **Pick the controller.** Default ArgoCD. Flux 2 is the alternative — same mental model, different CRDs (`Kustomization` + `HelmRelease` instead of `Application`). Don't migrate one to the other inside this task.
3. **Design the AppProject(s).** Each project is a **security boundary**: which repos can be sources, which namespaces / clusters are valid destinations, which resource kinds are allowed. Load `references/projects-rbac.md` for the catalog and the per-team / per-tenant patterns. Use `assets/templates/argocd/appproject.yaml.template`.
4. **Write the root Application.** A single `Application` that points at the `app-of-apps/envs/<env>/` chart, with `automated.prune: true` + `automated.selfHeal: true` + `syncOptions: [CreateNamespace=true, PrunePropagationPolicy=foreground, ServerSideApply=true]` + a retry policy. Apply it manually **once**; from then on it manages itself. Use `assets/templates/argocd/root-application.yaml.template`.
5. **Spawn child Applications.** Each `envs/<env>/templates/apps.yaml` renders one or more `Application` manifests — one per workload. They live under the AppProject from step 3 and point at the consumer chart with the right `values-<env>.yaml`. Use `assets/templates/argocd/child-application.yaml.template`. See `references/app-of-apps.md` for the parent → children → grandchildren depth trade-offs.
6. **Build the shareable Helm chart.** Copy `assets/templates/chart/` into your template repo; rename `chart-template` to your team's name; review `values.yaml` — the schema covers deployment + service + ingress + HPA + probes + init containers + configmap + secret + service account + pod security context + node-pool / tolerations + extra ports. Multi-runtime: Node.js / PHP / Java work out of the box because the values schema is runtime-agnostic. Load `references/helm-chart-design.md` for the design principles.
7. **Pick a rollout strategy.** Defaults: `RollingUpdate` (`maxSurge: 1, maxUnavailable: 0`) for stateless apps; `Recreate` for single-instance stateful apps; `Argo Rollouts` for canary or blue-green when you need traffic-shaped progressive delivery. Load `references/deployment-strategies.md` for which to pick when, plus the Argo Rollouts wiring.
8. **Lay out per-environment values.** `values.yaml` ships sane defaults; `values-dev.yaml` / `values-staging.yaml` / `values-prod.yaml` override per env. Image tag + digest land in the env-specific file (the CI half writes them). Multi-instance / multi-tenant via a `instances:` map at the root that the chart's `range $name, $cfg := .Values.instances` walks. Load `references/multi-environment.md` for the layout choices.
9. **Configure sync policy.** Per Application: `automated: { prune: true, selfHeal: true, allowEmpty: true }`, `syncOptions: [CreateNamespace=true, PrunePropagationPolicy=foreground, PruneLast=true, ServerSideApply=true, Replace=true]`, `retry: { limit: 5, backoff: { duration: 5s, factor: 2, maxDuration: 3m } }`. Load `references/sync-policies.md` to understand each toggle and when to flip it.
10. **Package + publish the chart** to an OCI registry. `helm package` → `helm push oci://<registry>/<path>`. Use `scripts/package-and-push.sh` — pulls credentials from a yq-readable secrets file, signs the chart with cosign if configured, idempotent. The CI half installs the chart by referencing `oci://...@<digest>` from consumer charts.

## Available resources

- `assets/templates/argocd/root-application.yaml.template` — the one Application a human applies once.
- `assets/templates/argocd/child-application.yaml.template` — the per-app spawn pattern.
- `assets/templates/argocd/appproject.yaml.template` — the security boundary.
- `assets/templates/argocd/values-env.yaml.template` — values shape for spawning N apps in one env.
- `assets/templates/chart/` — complete starter chart (Chart.yaml, values.yaml, templates/{deployment,service,ingress,hpa,configmap,\_helpers.tpl,NOTES.txt}).
- `assets/examples/sample-app/` — fully-worked tiny example (root + dev + prod children + consumer chart).
- `scripts/package-and-push.sh` — OCI chart packaging + push + cosign sign. Idempotent.
- `references/app-of-apps.md` — parent → children → grandchildren depth, sync waves, scaling beyond ~50 apps.
- `references/helm-chart-design.md` — schema design, multi-runtime, library vs application charts, value-file inheritance, pinning.
- `references/deployment-strategies.md` — RollingUpdate vs Recreate vs blue-green vs canary, Argo Rollouts wiring, traffic-shaping, abort criteria.
- `references/multi-environment.md` — `values-<env>.yaml` layout, instance maps, region axes, `helm template --debug` per-env testing.
- `references/sync-policies.md` — every ArgoCD sync toggle, when to use each, retry tuning, ServerSideApply vs ClientSide.
- `references/projects-rbac.md` — AppProject as a security boundary, per-tenant / per-team patterns, ArgoCD RBAC.

## Top gotchas (always inline — do not skip)

- **Apply the root Application **once**, manually.** From then on it manages itself, including its own updates. Never `kubectl apply` child Applications by hand — the root is the source of truth; manual applies create drift the root will undo.
- **Pin chart dependencies to a version.** `dependencies: [{ name: chart-template, version: 0.4.2, repository: "oci://..." }]` — never floating ranges. A floating dep means "production silently changes shape on a chart-only release".
- **Production deploys pin image to digest, not tag.** The CI half writes both `image.tag` (for humans) and `image.digest` (for kubelet) into `values-<env>.yaml`. Templates should render `repo@digest` when digest is present.
- **`automated.selfHeal: true` is non-negotiable for shared envs.** It's what undoes "I'll just kubectl edit this real quick" drift before it compounds. Without it, the cluster slowly diverges from git.
- **`syncOptions: ServerSideApply=true`.** Client-side apply mangles fields managed by other controllers (HPA's `replicas`, kube-controller-manager's defaults, ingress controllers). Server-side respects field ownership. Default to true unless you have a documented reason.
- **`allowEmpty: true` is a footgun on the root Application.** It prevents accidental "I deleted all the apps" autosync. On _child_ Applications it's fine — leave it on. On the _root_ default it false unless the root really might legitimately render zero children.
- **Sync waves go forward only.** A child with `argocd.argoproj.io/sync-wave: "1"` syncs after wave 0; setting wave -1 doesn't run before the parent's existing wave 0 — it just runs in numeric order _within the same Application_. Use waves to stage CRDs → operators → workloads, not as cross-application ordering (that's what App-of-Apps levels are for).
- **Don't put secrets in the GitOps repo unencrypted.** SealedSecrets / SOPS / External Secrets Operator / Vault Secrets Operator — pick one. The chart consumes Secrets by `valueFrom.secretKeyRef`, never inlines the value. See `references/projects-rbac.md` for the four common shapes.
- **`prune: true` deletes things you remove from git. Test it on dev first.** A common surprise: removing an Application from `envs/<env>/templates/apps.yaml` actually **deletes** all of its workloads. Sometimes that's what you want; sometimes it isn't. Use `argocd app sync --dry-run` to preview a prune.
- **Per-env values files override defaults; they don't merge across envs.** `values.yaml` + `values-prod.yaml` is the full composition for prod — `values-staging.yaml` is **not** layered into prod. If a setting must be the same across envs, put it in `values.yaml`. If it must differ, override per env.

## What you DO

1. Discover existing ArgoCD / Flux state and existing repo layout before designing.
2. Write **one** root Application that spawns all children for one environment, applied manually once.
3. Use AppProjects as **security boundaries** — no project means "argocd allows everything", which is wrong.
4. Build a **shareable Helm chart** with a runtime-agnostic schema (probes, ports, env vars, image, HPA), publish it to an OCI registry, version it semver, depend on it from consumer charts pinned to a version.
5. Choose a rollout strategy by **stateful vs stateless + tolerance for downtime**: RollingUpdate (default) → Recreate (stateful single-instance) → Argo Rollouts canary (need traffic shaping).
6. Pin `image.repository@digest` in production `values-prod.yaml`. Tag is human-readable; digest is what kubelet pulls.
7. Configure every Application with `automated: { prune, selfHeal, allowEmpty }` + `ServerSideApply` + a retry policy.
8. Keep secrets out of git (SealedSecrets / SOPS / ESO / VSO); chart consumes via `secretKeyRef`.
9. Lay values out as `values.yaml` (defaults) + `values-<env>.yaml` (env overrides). Document the diff in the chart README.
10. Package + push the chart to OCI with `scripts/package-and-push.sh`; sign the chart artifact with cosign.

## What you do NOT do

- Apply child Applications by hand. The root manages them.
- Pin chart dependencies to a floating range (`^0.4`, `~1.2`).
- Pin production deploys to a tag (`:latest`, `:1.5.0`) instead of a digest.
- Disable `selfHeal` on shared envs to "make troubleshooting easier" — drift accumulates fast.
- Use ClientSideApply on workloads with HPAs / external controllers — owned-field collisions break apply.
- Inline secrets into the GitOps repo, even encrypted-at-rest. Use a sealed-secret / external-secret integration.
- Treat `prune: true` casually. Removing a child Application file _deletes_ its workloads.
- Migrate ArgoCD ↔ Flux as part of this task. That's a separate, multi-PR project.
- Skip the AppProject. "Default project allows everything" is the worst posture.
- Use sync waves to order across Applications; that's what the App-of-Apps tree levels are for.
