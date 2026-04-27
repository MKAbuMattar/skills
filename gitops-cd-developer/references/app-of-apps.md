# The App-of-Apps pattern

How a single root `Application` manages many child `Application`s. Load this when designing the parent → children tree, choosing the depth, or scaling beyond ~50 child apps.

## The pattern in one diagram

```
                    ┌──────────────────────────┐
   human applies →  │   root Application       │   (one human apply, ever)
                    │   spec.source = envs/dev │
                    └─────────────┬────────────┘
                                  │ syncs
                                  ▼
                    ┌──────────────────────────┐
                    │   helm template envs/dev │   (renders N Applications)
                    └─────────────┬────────────┘
                                  │ ArgoCD admits each one
                                  ▼
        ┌─────────────────┬───────┴──────┬─────────────────┐
        │                 │              │                 │
   ┌────▼────┐      ┌─────▼────┐    ┌────▼────┐      ┌─────▼────┐
   │ app-A   │      │ app-B    │    │ app-C   │      │ app-D    │
   │ Helm    │      │ Helm     │    │ Helm    │      │ Helm     │
   └─────────┘      └──────────┘    └─────────┘      └──────────┘
```

The **root Application** points at a Helm chart whose templates render *more* Applications. ArgoCD admits the rendered children, who in turn point at consumer Helm charts that render the actual workloads.

## Why this works

- **One human apply.** A new cluster gets one `kubectl apply -f root-application.yaml` and from then on the entire fleet syncs from git.
- **Trivial to add an app.** Drop a new entry in `envs/<env>/values.yaml`; the root re-renders, ArgoCD spawns the child.
- **Consistent config.** Every child gets the same `automated`, `syncOptions`, `retry` settings because they come from one template.
- **Single source of truth.** Cluster state == git state. Drift is automatically reverted (with `selfHeal: true`).
- **Clear blast radius.** Each child has its own AppProject scope; one app's compromise doesn't grant access to another.

## Depth — how many levels

| Depth                           | When                                                    | Trade-off                                                |
| ------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| **1 (no app-of-apps)**          | < 5 apps, single env                                    | Apply each Application by hand. Fine for tiny setups.    |
| **2 (root → workload)**         | One env, ~5–30 apps                                     | The default. Easy to reason about.                       |
| **3 (root → env → workload)**   | Multi-env, ~30–100 apps total                           | One root spawns env-roots (`dev-root`, `prod-root`) which spawn workloads. |
| **4+ (root → tenant → env → workload)** | Multi-tenant SaaS, hundreds of apps              | Each tenant gets its own env-root; tenant-root points at tenant-specific workloads. Beware sync-time blowup. |

**Rule of thumb**: every level is one ArgoCD admission round-trip, one git fetch, and one Helm render. Three levels are common; four are rare; five means you've reinvented Kustomize bases.

## Performance ceiling

ArgoCD scales fine to a few hundred Applications per controller. Beyond ~500:

- Switch ArgoCD to **`--application-namespaces`** mode (apps live in tenant namespaces, not all in `argocd`).
- Scale the controller horizontally with `--controller-replicas` or shard by AppProject.
- Use **ApplicationSet** for repetitive children (per-cluster fan-out, per-tenant generation) instead of hand-templating each one.
- Move some children to **dependency tracking** (one fat chart with subcharts) rather than separate Applications.

## ApplicationSet vs hand-templated children

`ApplicationSet` is a controller that *generates* `Application`s from a generator (list, cluster, git, matrix, scm-provider). Use it when:

- You need the **same** Application shape across N clusters / N tenants / N branches.
- The list of children is **discoverable from data** (a folder of values files, a list of clusters, branches matching a regex).

Use hand-templated children (the pattern shown at the top of this doc) when:

- Children differ enough that ApplicationSet generators can't express them cleanly.
- You want to read `envs/<env>/values.yaml` and see the literal list of apps in this env, not a generator config.

For most teams, start with hand-templated children, graduate to ApplicationSet once the list-in-yaml gets unwieldy (~30+ children with similar shapes).

## Sync waves

Within **one** Application, `argocd.argoproj.io/sync-wave: "<n>"` orders resources. Lower n syncs first.

Common pattern for the root:

```yaml
# Wave -1: namespaces, AppProjects, ClusterRoles
# Wave  0: child Applications (default)
# Wave  1: post-deploy hooks
```

For ordering **across** Applications (e.g. install Postgres operator before the apps that use it), don't use sync waves — that's an *intra*-Application feature. Instead, use App-of-Apps **levels** or `dependsOn` on `ApplicationSet`.

## When the root should not be automated

For ultra-sensitive environments, leave the **root Application** with `automated: {}` (manual sync) and only the children automated. Then:

- A code review of the GitOps repo gates **adding / removing** apps (root sync is manual).
- Children syncing automatically is fine — they only roll within their own scope.

For most teams, automated everywhere is the right default.

## Bootstrap order on a fresh cluster

1. Install ArgoCD into the management cluster (Helm, manifests, or Argo Bootstrap).
2. Apply the **AppProject(s)** from `projects.yaml`. Without them the root has no project to register under.
3. Apply the **root Application** from `root-application.yaml`. ArgoCD pulls the GitOps repo, renders children, admits them. The cluster converges over the next few minutes.
4. Verify: `argocd app list` should show the root + every child as `Synced / Healthy`.

Cleanup of a fresh cluster: delete the root Application with `--cascade=true` and ArgoCD propagates deletion to every child.
