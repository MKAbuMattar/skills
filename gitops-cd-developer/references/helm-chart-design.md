# Designing a sharable Helm chart

How to build the **template chart** every consumer chart depends on. Load this when designing the chart's value schema, deciding library vs application, or planning a v1 → v2 schema bump.

## Application chart vs library chart

| Type        | Renders manifests? | Used by             | Versioned independently? |
| ----------- | ------------------ | ------------------- | ------------------------ |
| application | yes                | end users (deployable) | yes                    |
| library     | no                 | other charts (as a dependency) | yes               |

**Default to application charts.** Library charts (`type: library` in `Chart.yaml`) are useful when you want to share *helper templates* (e.g. a common labels block) without forcing a specific resource shape on consumers — but in practice most teams want the chart to render the resources, not the helpers.

If you find yourself writing the same `templates/deployment.yaml` shape in every team's chart, that's a signal: lift it to a shared **application** chart, not a library. Consumers depend on it via `dependencies:` in `Chart.yaml` and override per-app values.

## The values-schema design rule

**Make every field opt-in with safe defaults.** A consumer who copies `values.yaml`, sets `image.repository` + `image.tag`, and uses everything else as-is should get a healthy Deployment. Every block is wrapped in `enabled:` (default: false) for components that aren't always wanted (HPA, Ingress, configmap, secrets).

```yaml
# Safe-by-default schema
deployment:
  enabled: true
replicaCount: 1
image:
  repository: nginx
  tag: ""           # falls back to chart's appVersion
service:
  type: ClusterIP
  port: 8080
ingress:
  enabled: false    # off by default — most consumers don't need it
hpa:
  enabled: false
configMap:
  enabled: false
```

## Multi-runtime defaults

A single chart can serve Node.js / PHP / Java / static / Nginx workloads if its schema stays runtime-agnostic. Differences are values overrides, not chart forks.

| Concern         | Node.js   | PHP       | Java                   | Static (Nginx) |
| --------------- | --------- | --------- | ---------------------- | -------------- |
| Health endpoint | `/health` | `/health` | `/actuator/health`     | `/`            |
| Env var name    | `NODE_ENV`| `APP_ENV` | (Spring profiles)      | n/a            |
| Min memory      | 256Mi     | 128Mi     | 512Mi                  | 64Mi           |
| Startup time    | 5–10s     | 10–30s    | 30–60s                 | < 1s           |
| Probe `initialDelaySeconds` | 5 | 10        | 60                     | 0              |

The chart's `livenessProbe` / `readinessProbe` blocks accept any path/port; consumers fill in the runtime's actual endpoint. The chart's `resources` block accepts any limits/requests; consumers fill in the runtime's appropriate sizing. The chart doesn't hardcode a runtime — only the consumer does.

## Required `_helpers.tpl` patterns

Every shareable chart should ship these helper templates:

- `chart.name` — chart name (with override).
- `chart.fullname` — release-prefixed name (with override).
- `chart.labels` — full label set: `app.kubernetes.io/{name,instance,managed-by,version}`, `helm.sh/chart`.
- `chart.selectorLabels` — subset of labels valid for `selector.matchLabels` (omits version/managed-by — they change on upgrade and break selectors).
- `chart.serviceAccountName` — resolves the SA name from `serviceAccount.create` + `serviceAccount.name`.
- `chart.image` (optional) — emits `repo:tag` or `repo@digest` based on `.Values.image.digest` presence.

The starter chart in `assets/templates/chart/templates/_helpers.tpl` ships all six.

## Deployment vs StatefulSet

The chart should support **both** behind a single `kind:` selector — typically driven by `.Values.deployment.enabled` vs `.Values.statefulset.enabled` (mutually exclusive).

| Use Deployment when                        | Use StatefulSet when                              |
| ------------------------------------------ | ------------------------------------------------- |
| Stateless workload                         | Persistent volume per pod                          |
| Any pod can serve any request              | Stable network identity needed (databases)        |
| Rolling updates with arbitrary order       | Ordered startup / shutdown                        |
| Scale up/down without coordination         | Quorum-aware scaling                              |

The `strategy:` block in `values.yaml` is shared — `RollingUpdate` works for both, but StatefulSet only supports `partition` (not `maxSurge` / `maxUnavailable`).

## Image: repo + tag + digest

```yaml
image:
  repository: registry.example.com/org/app
  tag: 1.5.0          # written by CI for human readability
  digest: ""          # written by CI; templates use this if set
  pullPolicy: IfNotPresent
imagePullSecrets:
  - name: registry-credentials
```

Template logic:

```yaml
image: "{{ .Values.image.repository }}{{ if .Values.image.digest }}@{{ .Values.image.digest }}{{ else }}:{{ .Values.image.tag | default .Chart.AppVersion }}{{ end }}"
```

Production `values-prod.yaml` sets digest. Lower envs may use tag-only. The CI half (`gitops-pipeline-developer`) writes both fields after every successful build.

## Service / Ingress / HTTPRoute

The chart should support **all three** (gated by `enabled: true/false`):

- `service` — ClusterIP / NodePort / LoadBalancer for in-cluster access.
- `ingress` — classic Ingress for L7 routing via an Ingress controller.
- `httpRoute` — Gateway API for newer L7 routing (gateway-api/sigs.k8s.io). Off by default; flip on for clusters running a Gateway-API-conformant controller.

Default both `ingress.enabled` and `httpRoute.enabled` to `false`. The consumer turns on whichever matches their cluster.

## Health probes — three kinds

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
startupProbe:
  httpGet:
    path: /health
    port: 8080
  failureThreshold: 30          # 30 × 10s = 5 min before failing
  periodSeconds: 10
```

- **Liveness** — restart the pod if it fails. Sparse use; a flapping liveness is a self-DDoS.
- **Readiness** — exclude from Service when failing. Aggressive use; this is what protects users from a bad rollout.
- **Startup** — replaces the others during initial startup. Critical for slow JVM apps; without it Kubernetes kills them mid-boot.

## Init containers

For "wait for DB" patterns:

```yaml
initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ['sh', '-c', 'until nc -z db.namespace 5432; do sleep 1; done']
```

Template the array; consumer overrides per-runtime needs (Java apps often need a Flyway/Liquibase migration init container).

## Versioning

Two version fields in `Chart.yaml`:

| Field        | What it means                                       | Bumps when                                  |
| ------------ | --------------------------------------------------- | ------------------------------------------- |
| `version`    | Chart schema version                                | Any chart change (template, default value)  |
| `appVersion` | The default application version this chart deploys  | The default container image version changes |

Both follow SemVer. Bump `version` semver-correctly: backwards-incompatible value-schema changes are MAJOR, new optional fields are MINOR, fixes are PATCH.

## Consumer chart shape

A consumer chart depends on the template chart and overrides only what's needed:

```yaml
# Chart.yaml
apiVersion: v2
name: my-service
version: 0.1.0
appVersion: "1.5.0"
dependencies:
  - name: chart-template
    version: 0.4.2          # PIN to a specific version
    repository: "oci://registry.example.com/charts"
```

```yaml
# values-prod.yaml
chart-template:
  image:
    repository: registry.example.com/team/my-service
    tag: 1.5.0
    digest: sha256:...
  livenessProbe:
    httpGet:
      path: /health
      port: 3000
  hpa:
    enabled: true
    minReplicas: 3
    maxReplicas: 20
```

Consumers don't fork the chart; they configure it.

## Documentation that matters

The chart's README should answer, in order:

1. **What it deploys** — one paragraph.
2. **Minimum required values** — copy-paste-ready snippet.
3. **Per-runtime examples** — Node.js / PHP / Java sections with the differences from defaults.
4. **Common overrides** — HPA, Ingress, Init container, extra env vars.
5. **Upgrade notes** — what changed between v0.x and v1.x; breaking changes called out.

Skip philosophical sections; consumers want copy-paste, not theory.

## Anti-patterns

- **Per-runtime forks.** Don't ship `chart-nodejs/` and `chart-php/`. One chart, runtime-agnostic schema, consumer overrides.
- **Required values without defaults.** Force the consumer to discover every required value via failing renders. Provide *something* that works for the simplest case.
- **Embedding business logic in `_helpers.tpl`.** Helpers compute names, labels, and image refs. They don't decide which subchart to enable.
- **Renaming a value field across versions without an alias.** Adds friction. Either keep the old name as an alias for one version, or treat it as a MAJOR bump.
- **`tpl` everywhere.** `tpl .Values.foo .` lets the consumer inject Go template strings into values — useful for some patterns, but every `tpl` call is a footgun for the consumer (they must understand templating). Use sparingly.
