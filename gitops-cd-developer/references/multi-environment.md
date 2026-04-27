# Multi-environment values layout

How to lay out `values.yaml` so one chart serves dev / staging / prod (and multi-instance / multi-region). Load this when designing the per-env override scheme or debugging "why did prod render with the wrong value".

## The two-file pattern (start here)

Every consumer chart ships at minimum:

- `values.yaml` — defaults for **all** environments. Only fields that are the same everywhere.
- `values-<env>.yaml` — overrides per environment. `values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`.

ArgoCD's `Application` references the env file:

```yaml
spec:
  source:
    helm:
      valueFiles:
        - values.yaml          # defaults (often implicit)
        - values-prod.yaml     # env override
```

Helm composes them: later files **override** earlier ones key-by-key. Maps merge; arrays do not (the later wins entirely).

## What goes where

**`values.yaml`** — the *static* parts of the deployment:

```yaml
deployment:
  enabled: true
strategy:
  type: RollingUpdate
  rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
service:
  type: ClusterIP
  port: 8080
livenessProbe:
  httpGet: { path: /health, port: 8080 }
serviceAccount:
  create: true
```

**`values-<env>.yaml`** — only the *env-specific* fields:

```yaml
# values-prod.yaml
image:
  repository: registry.example.com/team/my-app
  tag: 1.5.0
  digest: sha256:abc123...        # written by CI on every release
replicaCount: 6
resources:
  requests: { cpu: 500m, memory: 1Gi }
  limits:   { cpu: 2,    memory: 4Gi }
hpa:
  enabled: true
  minReplicas: 3
  maxReplicas: 30
ingress:
  enabled: true
  hosts:
    - host: my-app.example.com
      paths: [{ path: /, pathType: Prefix }]
configMap:
  data:
    LOG_LEVEL: warn
    NODE_ENV: production
```

```yaml
# values-dev.yaml
image:
  repository: registry.example.com/team/my-app
  tag: 1.6.0-beta.4+a8d3538
replicaCount: 1
resources:
  requests: { cpu: 100m, memory: 256Mi }
  limits:   { cpu: 500m, memory: 512Mi }
ingress:
  enabled: true
  hosts:
    - host: my-app.dev.example.com
      paths: [{ path: /, pathType: Prefix }]
configMap:
  data:
    LOG_LEVEL: debug
    NODE_ENV: development
```

The env file is short — it answers *only* "how does this env differ from the default?".

## The "no merge across envs" trap

```
values.yaml                     ← defaults
values-staging.yaml             ← overrides defaults
values-prod.yaml                ← overrides defaults (NOT staging!)
```

If a setting needs to be the same across **all envs**, put it in `values.yaml`. Setting it in `values-staging.yaml` and expecting `values-prod.yaml` to inherit it will silently fail — `values-prod.yaml` is composed only with `values.yaml`, not with `values-staging.yaml`.

## Multi-instance / multi-tenant pattern

When one chart deploys **N** instances within an env (e.g. one stack per customer / branch / sandbox), use an `instances:` map:

```yaml
# values-dev.yaml
instances:
  alice:
    namespace: tenant-alice
    domain: alice.dev.example.com
    image: { tag: 1.5.0 }
  bob:
    namespace: tenant-bob
    domain: bob.dev.example.com
    image: { tag: 1.5.0-beta.2+a8d3538 }
  qa-pool-1:
    namespace: qa-pool-1
    domain: qa-1.dev.example.com
    image: { tag: 1.6.0-rc.3+9876543 }
```

Chart template walks the map:

```yaml
{{- range $name, $cfg := .Values.instances }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $.Release.Name }}-{{ $name }}
  namespace: {{ $cfg.namespace }}
  labels:
    {{- include "chart.labels" $ | nindent 4 }}
    instance: {{ $name }}
spec:
  ...
{{- end }}
```

Adding an instance is *one new entry* in `values-dev.yaml`. ArgoCD re-renders, spawns the new Deployment, the rest of the cluster is untouched.

## Multi-region (third axis)

When you have N envs × M regions, layer the file selection:

```
values.yaml                       # defaults
values-<env>.yaml                 # env override
values-<env>-<region>.yaml        # env+region override
```

```yaml
spec:
  source:
    helm:
      valueFiles:
        - values.yaml
        - values-prod.yaml
        - values-prod-eu-west-1.yaml
```

Most teams don't need this until the second region opens. Don't over-design upfront.

## CI writes the image fields

The CI half (`gitops-pipeline-developer`) updates the env file via `yq` after every successful build:

```bash
yq -i '
  .image.repository = "registry.example.com/team/my-app" |
  .image.tag        = "1.5.0" |
  .image.digest     = "sha256:abc123..."
' values-prod.yaml
git commit -m "deploy: my-app 1.5.0@sha256:abc123 [skip ci]"
git push
```

ArgoCD's poll-loop sees the diff, syncs. The CI side never touches the cluster directly; it touches git.

## What fields **should not** live in env files

- **Image field structure** — repo / tag / digest go in env files (CI writes them); the *schema* (which fields exist) lives in `values.yaml`.
- **Probes' paths and ports** — same per env. `values.yaml`.
- **Resource shapes** — different per env (dev gets less, prod gets more). `values-<env>.yaml`.
- **Replicas** — different per env. `values-<env>.yaml`.
- **Hostnames / domains** — different per env. `values-<env>.yaml`.
- **Feature flags** — different per env (dev tests new flag, prod waits). `values-<env>.yaml`.

## Testing per-env render before deploy

```bash
# Render what ArgoCD will apply, locally:
helm template my-app ./consumer-chart \
    -f values.yaml \
    -f values-prod.yaml \
    --debug

# Or via ArgoCD's diff:
argocd app diff my-app-prod
```

Always render before merging values changes; a missing key produces silent empty fields, not an error.

## values-schema validation

Add a `values.schema.json` to the chart so misnamed keys in `values-<env>.yaml` fail at render time:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": {
        "repository": { "type": "string" },
        "tag":        { "type": "string" },
        "digest":     { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$|^$" }
      }
    },
    "replicaCount": { "type": "integer", "minimum": 1, "maximum": 100 }
  }
}
```

Helm validates against the schema during `helm template` / `helm install`. ArgoCD inherits the validation. Catches typos like `replicaCounts: 3` before they hit the cluster.

## Anti-patterns

- **Inlining every field in the env file.** The env file should be ~20 lines, not 200. If it's > 100, you've duplicated defaults.
- **Same setting different per env that doesn't need to be.** `serviceAccount.create: true` in dev, `true` in prod, `true` in staging — pick one place and remove the duplication.
- **Per-env charts.** If you find yourself with `consumer-chart-dev/` and `consumer-chart-prod/`, you've forked the schema. One chart, env values.
- **Branch-per-env.** Don't use git branches for environments — use values files + ArgoCD `targetRevision`. Branch-per-env makes hotfixes painful (you have to merge across branches).
- **Auto-merge of env files.** `values-dev.yaml` should never be merged into `values-prod.yaml`. They're independent overrides.
