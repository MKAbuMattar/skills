# ArgoCD sync policies

Every toggle on `Application.spec.syncPolicy`. Load this when wiring sync behavior or debugging "why did ArgoCD do that".

## The full block

```yaml
spec:
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: true
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
      - ServerSideApply=true
      - Replace=true
      - ApplyOutOfSyncOnly=true
      - RespectIgnoreDifferences=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
    managedNamespaceMetadata:
      labels:    { team: backend }
      annotations: {}
```

## `automated`

Automated sync — ArgoCD reconciles without a human pressing Sync.

| Field        | Default | Effect                                                                                |
| ------------ | ------- | ------------------------------------------------------------------------------------- |
| `prune`      | `false` | Delete cluster resources that are no longer in git. **Required for "git is truth".** |
| `selfHeal`   | `false` | Revert any drift (someone `kubectl edit`s a Deployment, ArgoCD undoes it).            |
| `allowEmpty` | `false` | Allow the source to render zero resources without erroring. Useful on child Applications; **dangerous on the root** (an accident could empty the cluster). |

**Rule of thumb:** for shared / production envs, all three on. For the root Application specifically, leave `allowEmpty: false` so a misconfiguration that produces zero children is caught.

## `syncOptions`

The strings ArgoCD accepts in `syncOptions:`. Each is one of:

| Option                                  | What it does                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `CreateNamespace=true`                  | If the destination namespace doesn't exist, create it. Otherwise the sync fails.                            |
| `PrunePropagationPolicy=foreground`     | When pruning, wait for resources to fully delete before reporting Synced. (Other options: `background`, `orphan`.) |
| `PruneLast=true`                        | Prune as the **last** wave of a sync, after all creations / updates. Prevents "delete service while pods still serve traffic" races. |
| `ServerSideApply=true`                  | Apply via Kubernetes server-side apply. Respects field ownership; required when other controllers (HPA, kube-controller-manager) own fields. |
| `Replace=true`                          | When a resource exists, do `kubectl replace` (full replacement) instead of `apply` (3-way merge). Aggressive; can lose annotations from other controllers. |
| `ApplyOutOfSyncOnly=true`               | Only apply resources that are out of sync. Speeds up large Applications.                                    |
| `RespectIgnoreDifferences=true`         | Honor the `ignoreDifferences` block on the Application (don't diff fields you've told ArgoCD to ignore).    |
| `Validate=false`                        | Skip schema validation. Don't use unless you have a specific CRD-ordering reason.                           |
| `SkipDryRunOnMissingResource=true`      | If a CRD is being installed in the same sync as a CR, skip the pre-sync dry-run that would fail.            |
| `FailOnSharedResource=true`             | Fail if two Applications claim the same resource.                                                           |

**Default recommended set:**

```yaml
syncOptions:
  - CreateNamespace=true
  - PrunePropagationPolicy=foreground
  - PruneLast=true
  - ServerSideApply=true
```

Add `Replace=true` only on resources you want full-replacement semantics for (rare). Add `ApplyOutOfSyncOnly=true` if you hit sync-time issues on Applications with hundreds of resources.

## `retry`

Sync attempt retry policy:

```yaml
retry:
  limit: 5
  backoff:
    duration: 5s
    factor: 2
    maxDuration: 3m
```

- `limit: -1` → infinite. Useful for transient network-dependent syncs; risky for persistent failures (you'll fill the controller's queue).
- `backoff.factor: 2` → 5s, 10s, 20s, 40s, 80s, ...
- `maxDuration: 3m` → caps the wait between retries.

For a Helm chart that depends on an init job: `limit: 10` makes sense (job may take a minute to converge). For a static manifest sync: `limit: 5` is plenty.

## ServerSide vs ClientSide apply

**Always prefer ServerSide.** It's the default in modern Kubernetes.

| Concern                            | ClientSide                                | ServerSide                                |
| ---------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Field ownership                    | None (last-write-wins)                    | Per-field, tracked by manager identity     |
| Coexistence with HPA               | Fights with HPA over `spec.replicas`       | HPA owns `replicas`; ArgoCD doesn't touch it |
| Three-way merge                    | Yes (last-applied annotation)             | No (server resolves)                      |
| Annotation bloat                   | `kubectl.kubernetes.io/last-applied-configuration` everywhere | None |
| Behavior on conflict               | Silent overwrite                          | Conflict error (you can `--force-conflicts`) |

If you're rolling out ServerSideApply for the first time on an existing cluster, the first sync may report `Conflict` for every resource (because ClientSide annotations claim everything). Resolve with `--force-conflicts` once; subsequent syncs are clean.

## Self-heal in detail

`selfHeal: true` makes ArgoCD revert any cluster-side change every reconcile. That's almost always what you want, but be aware:

- **Pause during incident** by setting `selfHeal: false` if you need to apply a one-time emergency patch the cluster has to keep until the fix lands in git.
- **Don't disable globally as a workaround** for a flaky chart — fix the chart instead.

## Pruning safely

Pruning is what makes "git is truth" work, and what makes a misconfigured commit nuke production. Mitigations:

1. **Root Application has `allowEmpty: false`.** If the root somehow renders zero children, the sync fails instead of pruning everything.
2. **Test prunes with `argocd app sync --dry-run --prune`.** Shows what *would* be deleted.
3. **Watch the `*-orphan` finalizer warnings** — orphan policies leave child resources around when their owner is deleted. Useful to keep Persistent Volumes after a deployment is removed.
4. **Use `argocd.argoproj.io/sync-options: Prune=false` on irreplaceable resources** (e.g. a one-off PVC). The annotation overrides the Application-level prune for that one resource.

## Sync waves

Within one Application, `argocd.argoproj.io/sync-wave: "<n>"` orders resources. Default is `0`. Lower n syncs first.

Common pattern:

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-2"     # CRDs first
---
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"     # operators
---
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"      # workloads (default)
---
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "1"      # post-deploy hooks
```

Waves only order resources **within the same Application**. For cross-Application ordering, use App-of-Apps levels (parent → child → grandchild).

## Ignoring fields

Some fields are written by other controllers and shouldn't trigger ArgoCD diff:

```yaml
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas         # let HPA manage this
    - group: ""
      kind: Service
      jsonPointers:
        - /spec/clusterIP        # set by Kubernetes
    - group: cert-manager.io
      kind: Certificate
      jqPathExpressions:
        - .spec.dnsNames | sort  # we don't care about DNS-name order
```

Use `jsonPointers` for simple paths, `jqPathExpressions` for shape transforms. Combine with `RespectIgnoreDifferences=true` in `syncOptions`.

## Health checks

ArgoCD reports `Healthy / Progressing / Degraded / Suspended / Missing` per resource based on built-in checks plus custom Lua you can define on the AppProject or per Application:

```yaml
spec:
  source:
    plugin:
      env: ...
  # Custom health for a CRD ArgoCD doesn't know:
```

Built-in health for `Deployment` / `StatefulSet` / `Pod` / `Service` / `Ingress` covers 90% of cases. For custom CRDs (Argo Rollouts, Knative, etc.), add a Lua block at the AppProject level so every Application that deploys those CRDs gets the same health logic.

## Common pitfalls

- **`prune: true` on first sync with no children**: nukes existing cluster state if the source repo is empty. Always start with the source repo populated.
- **Forgot `CreateNamespace=true`**: sync fails with "namespace not found". Add to defaults.
- **`Replace=true` on a Deployment with HPA**: HPA-set `replicas` is overwritten by the chart's value, then HPA scales again, infinite cycle. Use ServerSideApply + `ignoreDifferences` on `/spec/replicas`.
- **Retry `limit: -1` with a persistent failure**: controller queue fills, other Applications block. Always cap retries.
- **`selfHeal` revert during a one-time troubleshooting kubectl edit**: expected behavior. Either commit the fix to git or set `selfHeal: false` for the duration.
