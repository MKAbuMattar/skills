# Deployment strategies

How to pick a rollout strategy and wire it. Load this when choosing between RollingUpdate / Recreate / blue-green / canary, or when adding Argo Rollouts to an existing chart.

## The four strategies

| Strategy             | Mechanism                                                        | Downtime  | Traffic shaping | Rollback    | Complexity |
| -------------------- | ---------------------------------------------------------------- | --------- | --------------- | ----------- | ---------- |
| **RollingUpdate**    | Kubernetes Deployment: replace old pods incrementally             | None      | None            | Re-deploy old | Low      |
| **Recreate**         | Kubernetes Deployment: terminate all, then start all              | Yes       | None            | Re-deploy old | Low      |
| **Blue-Green**       | Two full environments; flip traffic atomically                    | None      | All-or-nothing  | Flip back   | Medium     |
| **Canary**           | Send N% of traffic to new version; ramp up                        | None      | Per-percent     | Stop ramp + revert | High |

## RollingUpdate — the default

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1            # one extra pod allowed during rollout
    maxUnavailable: 0      # never drop below desired replica count
```

`maxUnavailable: 0` is the safe default — guarantees the service stays at full capacity throughout the rollout. Bump `maxSurge: 25%` once the cluster has headroom.

**Use when:**
- Stateless workload.
- Multiple replicas.
- New version is API-compatible with old (clients can hit either during the rollout window).
- Default for 80% of HTTP/gRPC services.

**Don't use when:**
- Single replica with state (split-brain risk during rollout).
- New version requires data migration that breaks the old version.
- You need traffic shaping by percentage (jump to canary).

## Recreate — the "no old version may run" strategy

```yaml
strategy:
  type: Recreate
revisionHistoryLimit: 5
```

Terminates all old pods before starting any new ones. Causes downtime equal to (terminate + start) — typically tens of seconds to minutes.

**Use when:**
- Single-replica stateful app (database with one writer).
- The new version cannot coexist with the old (migration that breaks v1).
- Downtime is acceptable (internal tool, scheduled maintenance window).

**Don't use when:**
- Production user-facing service.
- Multiple replicas (Recreate gives nothing over RollingUpdate when you have replicas).

## Blue-Green — atomic flip

Two full environments. "Blue" is live; "Green" is the new version, deployed but receiving no traffic. Test green privately, then flip traffic from blue to green in one operation. Roll back by flipping back.

Two implementations:

### Native (manual): two Deployments + Service swap

```yaml
# values-prod.yaml
deployments:
  blue:
    enabled: true
    image: { tag: 1.4.0 }
    selector: { color: blue }
  green:
    enabled: false
    image: { tag: 1.5.0 }
    selector: { color: green }

service:
  selector:
    color: blue          # flip to green to switch traffic
```

Pros: simple; visible in plain Kubernetes.
Cons: manual flip; no automatic rollback; service has stale connections during the flip.

### Argo Rollouts (recommended)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 4
  strategy:
    blueGreen:
      activeService: my-app-active        # blue
      previewService: my-app-preview      # green (private)
      autoPromotionEnabled: false         # require explicit promote
      scaleDownDelaySeconds: 600          # 10 min retention before deleting old ReplicaSet
      prePromotionAnalysis:
        templates:
          - templateName: smoke-test
        args:
          - name: service
            value: my-app-preview
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: registry.example.com/team/my-app:1.5.0
```

Promotion: `kubectl argo rollouts promote my-app`.
Rollback: `kubectl argo rollouts undo my-app`.

**Use when:**
- You need the *option* to test the new version against production traffic without committing.
- A canary by percentage is too risky (e.g. financial transactions where 1% is one-too-many bad ones).
- You can pay 2x compute cost during the rollout window.

## Canary — gradual percent rollout

Send a small fraction of traffic (1%, 5%, 10%, 25%, 50%, 100%) to the new version, observe error rate / latency, advance or abort.

### Argo Rollouts canary

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: my-app-canary
      stableService: my-app-stable
      trafficRouting:
        nginx:
          stableIngress: my-app-stable
      steps:
        - setWeight: 5
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: success-rate
            args:
              - name: service-name
                value: my-app-canary
        - setWeight: 25
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 10m }
        - setWeight: 100
```

The `analysis` step queries Prometheus / Datadog / a custom metric; if the result misses the success criterion the rollout aborts, traffic shifts back to stable, and the canary ReplicaSet is removed.

**Use when:**
- High-traffic service where 1% of users is enough signal.
- You have observability (Prometheus / Datadog) that can answer "is the canary healthy?" in < 1 minute.
- You want progressive confidence before full rollout.

**Don't use when:**
- Low-traffic services (1% is 0.5 requests/min — no signal).
- No service mesh / ingress that supports per-weight routing.
- The metrics that matter aren't observable (e.g. customer satisfaction).

## Argo Rollouts wiring (one-time setup)

Install the controller in the cluster:

```bash
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

(Pin `latest` to a specific tag in production — see `gitops-pipeline-developer/references/supply-chain.md`.)

Add the `kubectl-argo-rollouts` plugin so humans can `kubectl argo rollouts get my-app` to watch progress.

## Switching from Deployment to Rollout

If your chart currently emits a `Deployment`, switching to `Rollout` is a one-line `kind:` change in the template plus a values flag:

```yaml
# values.yaml
rollout:
  enabled: false        # default: use Deployment
  strategy: rolling     # rolling | bluegreen | canary
```

```yaml
# templates/workload.yaml
{{- if .Values.rollout.enabled }}
apiVersion: argoproj.io/v1alpha1
kind: Rollout
{{- else }}
apiVersion: apps/v1
kind: Deployment
{{- end }}
metadata:
  name: {{ include "chart.fullname" . }}
  ...
```

The `Rollout` spec is a superset of `Deployment` spec, so the rest of the template (containers, probes, volumes) is unchanged.

## Abort criteria for canary / blue-green

Define per Application:

| Signal              | Threshold                                                 |
| ------------------- | --------------------------------------------------------- |
| HTTP 5xx rate       | > 0.5% over 5 min on canary, vs < 0.5% on stable           |
| p99 latency         | > 1.5× stable's p99                                       |
| Pod crash-loops     | Any pod restarts > 2 times in 10 min                       |
| Custom (business)   | Conversion rate drop > 5%, payment failure rate > 1%, etc. |

Argo Rollouts' `AnalysisTemplate` queries the metric and emits Pass / Fail / Inconclusive — Inconclusive pauses the rollout for human review.

## What gets deleted on rollback

| Strategy        | Old version stays running for…                | Cost           |
| --------------- | --------------------------------------------- | -------------- |
| RollingUpdate   | The history limit (`revisionHistoryLimit: 5`) | Old ReplicaSets at zero replicas — negligible |
| Recreate        | History limit, but pods are zero anyway        | Negligible    |
| Blue-Green      | `scaleDownDelaySeconds` (default 30s; bump to 10min) | 2x pods during the window |
| Canary          | Until next deploy or manual cleanup            | Old + canary ReplicaSets |

## Pick the strategy

```
  Stateless?          ─yes→  Multiple replicas?
                                ├─yes→  RollingUpdate (default)
                                │
                                ├─need traffic shaping?
                                │   ├─yes (sub-1% precision)→ Canary (Argo Rollouts)
                                │   ├─yes (atomic flip)→     Blue-Green (Argo Rollouts)
                                │   └─no→                    RollingUpdate
                                │
                                └─single replica→ Recreate
  Stateful?           ─yes→ StatefulSet rolling (partitioned) for clusters
                            Recreate for single-instance writers
```

For most teams' first chart: ship `RollingUpdate` and add `rollout.enabled: false` as the schema for the future Argo Rollouts swap. Don't pay the canary complexity tax until you've felt the pain of *not* having it.
