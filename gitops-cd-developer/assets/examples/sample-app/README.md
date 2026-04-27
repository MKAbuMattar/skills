# Sample app — fully-worked GitOps CD example

A small acme-api service deployed to two environments (dev + prod) via the App-of-Apps pattern, consuming the shareable chart from `assets/templates/chart/`.

## Tree

```
sample-app/
├── app-of-apps/                       ← The GitOps repo (one root + per-env children)
│   ├── projects.yaml                  ← AppProject = security boundary
│   ├── root-application.yaml          ← The one human-applied Application
│   └── envs/
│       ├── dev/
│       │   ├── Chart.yaml
│       │   ├── values.yaml            ← which apps to spawn in dev
│       │   └── templates/
│       │       └── apps.yaml          ← renders one Application per app
│       └── prod/
│           ├── Chart.yaml
│           ├── values.yaml
│           └── templates/
│               └── apps.yaml
└── consumer-chart/                    ← Per-app chart that depends on chart-template
    ├── Chart.yaml                     ← dependencies: [chart-template@0.1.0]
    ├── values.yaml                    ← defaults
    ├── values-dev.yaml                ← dev overrides (CI writes image tag/digest here)
    └── values-prod.yaml               ← prod overrides
```

## Bootstrap

```bash
# 1. Apply the AppProject (security boundary)
kubectl apply -f app-of-apps/projects.yaml

# 2. Apply the root Application — once. From here on it manages itself.
kubectl apply -f app-of-apps/root-application.yaml

# 3. Verify
argocd app list
# Expect: app-dev, acme-api-dev (rendered as a child)
```

## What each file does

- **projects.yaml** — defines `acme-platform`: which repos can be sources, which namespaces can be destinations.
- **root-application.yaml** — points at `envs/dev/`. ArgoCD reads it, helm-renders that folder, admits the children.
- **envs/dev/values.yaml** — lists `apps: { acme-api: {...} }`. To deploy a new app to dev, add an entry here.
- **envs/dev/templates/apps.yaml** — `range $name, $cfg := .Values.apps` walks the map and emits one Application per entry.
- **consumer-chart/Chart.yaml** — depends on `chart-template`, pinned to `0.1.0`. CI half (`gitops-pipeline-developer`) writes image fields to `values-dev.yaml`/`values-prod.yaml`.

## Image flow (with the CI half)

1. CI builds image `registry.example.com/acme/api:1.5.0-beta.3+a8d3538`, gets digest `sha256:abc...`
2. CI runs `yq -i '.image.tag = "..." | .image.digest = "..."' consumer-chart/values-dev.yaml`
3. CI commits + pushes with `[skip ci]`
4. ArgoCD's poll loop detects the diff in `values-dev.yaml`
5. ArgoCD re-renders `acme-api-dev`, sees the new image ref, applies the rolling update
6. New pods come up, old pods drain. Cluster state == git state.

No human action between steps 1 and 6.
