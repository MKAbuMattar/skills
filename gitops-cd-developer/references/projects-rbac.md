# AppProject as a security boundary + ArgoCD RBAC

How AppProjects partition who can do what, and the four common secrets-handling shapes. Load this when designing the project layout for a multi-team / multi-tenant cluster, or wiring secrets into the chart.

## What an AppProject is

`AppProject` is ArgoCD's **policy boundary**. Every `Application` belongs to one project. The project says:

- **Source whitelist** — which git repos may be Applications under this project.
- **Destination whitelist** — which clusters + namespaces may be deployed to.
- **Resource whitelist** — which Kubernetes resource kinds may be created (cluster-scoped vs namespaced).
- **Roles + tokens** — who can sync / create / delete Applications under this project.
- **Sync windows** — time-of-day / day-of-week restrictions on automatic sync.

A cluster with no AppProjects effectively has one (`default`) that allows everything. Don't run that way in production.

## Minimal project skeleton

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: backend-team
  namespace: argocd
spec:
  description: Backend team workloads
  sourceRepos:
    - "git@github.com:acme/backend-charts.git"
    - "oci://registry.example.com/charts"
  destinations:
    - server: https://kubernetes.default.svc
      namespace: backend
    - server: https://kubernetes.default.svc
      namespace: backend-*
  clusterResourceWhitelist:           # Cluster-scoped — be tight
    - group: ""
      kind: Namespace
    - group: rbac.authorization.k8s.io
      kind: ClusterRole
  namespaceResourceWhitelist:         # Namespaced — broader is OK
    - group: "*"
      kind: "*"
  namespaceResourceBlacklist:
    - group: ""
      kind: ResourceQuota             # Set by platform team only
```

## Per-team vs per-tenant vs per-env

Three common shapes:

### Per-team

One project per engineering team. Each team owns its repos, its namespaces, its workloads. Cross-team work goes through PRs to a different team's repo.

```yaml
projects: [backend-team, frontend-team, data-team, platform-team]
```

Use when: < 10 teams, single tenant.

### Per-tenant

One project per customer / business unit. Team membership cuts across tenants. Strong namespace isolation between tenants.

```yaml
projects: [tenant-acme, tenant-beta, tenant-gamma]
```

Use when: SaaS-style multi-tenancy. Combine with [hierarchical namespaces](https://kubernetes.io/docs/concepts/policy/namespace-quota/) for resource quotas per tenant.

### Per-environment

One project per env (dev / staging / prod). The whole org's apps share each project. The project's `destinations` restrict to that env's namespaces.

```yaml
projects: [env-dev, env-staging, env-prod]
```

Use when: small org, one app, many envs. Less common in production at scale.

**Most production setups use per-team or per-tenant.** Per-env alone gives you separation across envs but not across teams within an env, which is rarely the boundary that matters for blast radius.

## Source whitelist — pin chart sources

```yaml
sourceRepos:
  - "git@github.com:acme/backend-charts.git"
  - "oci://registry.example.com/charts"
  # Don't:
  # - "*"   ← never; eliminates the project as a security boundary
```

For OCI chart sources, the URL has to **match exactly**. `oci://registry.example.com/*` is supported in newer ArgoCD; older versions need exact matches.

## Destinations — pin clusters and namespaces

```yaml
destinations:
  - server: https://kubernetes.default.svc
    namespace: backend
  - server: https://kubernetes.default.svc
    namespace: backend-*       # wildcard for instance namespaces
  - server: https://prod-eu.example.com:6443
    namespace: backend-prod
```

Multi-cluster: list each cluster's API server URL. ArgoCD looks up cluster credentials via Secret in `argocd` namespace.

## Cluster-resource whitelist — tighten

`clusterResourceWhitelist` controls which **cluster-scoped** resources the project can create. Almost always the tight set:

```yaml
clusterResourceWhitelist:
  - group: ""
    kind: Namespace
  - group: rbac.authorization.k8s.io
    kind: ClusterRole
  - group: rbac.authorization.k8s.io
    kind: ClusterRoleBinding
```

CRDs, PriorityClasses, StorageClasses, IngressClasses, ValidatingWebhookConfigurations — these are **platform** team concerns, not workload team concerns. Give workload teams empty `clusterResourceWhitelist: []` and let the platform team's project install cluster-scoped infrastructure.

## Roles and tokens

```yaml
spec:
  roles:
    - name: read-only
      description: View-only access for the dashboard
      policies:
        - p, proj:backend-team:read-only, applications, get, backend-team/*, allow
      groups:
        - acme:backend-readers
    - name: ci-bot
      description: CI to trigger sync after image push
      policies:
        - p, proj:backend-team:ci-bot, applications, sync, backend-team/*, allow
        - p, proj:backend-team:ci-bot, applications, get,  backend-team/*, allow
```

Then issue a token for the `ci-bot` role and let the CI pipeline call `argocd app sync ...` (or just rely on ArgoCD's poll loop, which is the lower-friction option).

## Sync windows — quiet hours

```yaml
spec:
  syncWindows:
    - kind: deny
      schedule: "0 0 * * *"
      duration: 1h
      applications:
        - "*"
      manualSync: true       # allow human override
```

Useful for "no automated syncs during the prod backup window 00:00–01:00 UTC". Manual sync is still allowed unless you set `manualSync: false`.

## Secrets in GitOps — four shapes

The chart must consume secrets without checking them into git. Four common approaches:

### 1. Bitnami Sealed Secrets

Cluster-side controller decrypts a `SealedSecret` CR (kubectl-side encrypted) into a Secret.

```bash
echo -n 'password' | kubectl create secret generic db-pass --dry-run=client \
    --from-literal=password=$(cat) -o yaml | kubeseal -o yaml > sealed.yaml
```

Pros: cluster-bound (encrypted secrets only decrypt on the original cluster). Simple operator.
Cons: per-cluster keys; rotating the key invalidates every sealed secret.

### 2. SOPS

Encrypted file at rest in git, decrypted at sync time by a `kustomize-sops` plugin or `argocd-vault-plugin`.

```bash
sops --encrypt --age <pubkey> secrets.yaml > secrets.enc.yaml
```

Pros: portable across clusters; supports multiple key backends (age, GCP KMS, AWS KMS, PGP).
Cons: requires a plugin in ArgoCD; key management is its own thing.

### 3. External Secrets Operator (ESO)

The chart ships an `ExternalSecret` CR that points at a `SecretStore` (Vault / AWS Secrets Manager / GCP Secret Manager / etc.). ESO syncs the secret value into a Kubernetes Secret.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-pass
spec:
  refreshInterval: 1h
  secretStoreRef: { name: vault, kind: ClusterSecretStore }
  target: { name: db-pass }
  data:
    - secretKey: password
      remoteRef: { key: secret/data/myapp, property: db_password }
```

Pros: one source of truth (the external store); rotation is automatic.
Cons: ESO + a SecretStore is two more moving pieces.

### 4. Vault Secrets Operator (VSO)

Similar to ESO but Vault-native. Uses Vault Kubernetes auth + the `VaultStaticSecret` / `VaultDynamicSecret` CRs.

Pros: dynamic secrets (DB credentials rotated on a schedule, leases tracked).
Cons: HashiCorp-specific.

**Pick one and stick with it across the org.** Mixing ESO and SealedSecrets in different teams' projects creates secret-rotation surprises.

## Chart-side secret consumption

Whichever approach you pick, the chart pattern is the same:

```yaml
# values.yaml — schema
secrets:
  fromSecretRef:
    - name: db-pass
      keys: [password]
    - name: api-keys
      keys: [stripe, sendgrid]
```

```yaml
# templates/deployment.yaml
env:
  {{- range .Values.secrets.fromSecretRef }}
  {{- $secretName := .name }}
  {{- range .keys }}
  - name: {{ . | upper }}
    valueFrom:
      secretKeyRef:
        name: {{ $secretName }}
        key: {{ . }}
  {{- end }}
  {{- end }}
```

The chart never sees the secret value — only the reference. The Secret object is created by the chosen secrets-handling tool (SealedSecret / SOPS / ESO / VSO), not by the chart itself.

## ArgoCD RBAC outside projects

In addition to project-level roles, ArgoCD has cluster-level RBAC in `argocd-rbac-cm`:

```yaml
policy.csv: |
  p, role:org-admin,    *,             *,    */*,                allow
  p, role:dev-readonly, applications,  get,  */*,                allow
  p, role:dev-readonly, applications,  sync, env-dev/*,           allow
  g, acme:platform,     role:org-admin
  g, acme:developers,   role:dev-readonly
```

Per-project roles compose with cluster-level roles — ArgoCD allows the action if **either** allows it. Per-project is where most workload-team scoping should live; cluster-level is for org-wide reads and the platform team's full access.

## Anti-patterns

- **Single `default` project for everything.** No boundary, no audit trail, no blast-radius limit.
- **`sourceRepos: ["*"]`.** A compromised repo can now push manifests via Argo CD. Pin the list.
- **Cluster-resource whitelist set to `*`.** Workload teams can install Webhook configurations that intercept other teams' API calls.
- **Inlining secrets.** Even base64'd in git. Even encrypted at rest if the key is in the same repo. Pick a real secrets tool.
- **Mixing 4 secrets approaches across projects.** Each one's failure mode and rotation story is different — your incident-response playbook becomes a maze.
