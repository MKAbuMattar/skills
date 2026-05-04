# Live Data Integration

The "your cluster / your registry / your environment" section is what makes the deck land for the team. Numbers must be real — never made up. Run discovery commands during the build, bake the output into the slides.

## Required: section authorisation

Before running anything, confirm with the user that you have read-only access to their environment. Stop and ask if:

- The user did not explicitly mention their cluster / registry.
- The kubeconfig points to a context you don't recognise.
- You are about to run any command that mutates state (`apply`, `delete`, `drain`, `cordon`).

This skill never runs mutating commands.

## Kubernetes discovery script

Run all of these and capture output:

```bash
# Cluster shape
kubectl config current-context
kubectl get nodes -o wide
kubectl version | head -10

# Namespaces and pods
kubectl get ns
kubectl get pods -A --no-headers | wc -l
kubectl get pods -A --no-headers | awk '{print $1}' | sort | uniq -c | sort -rn

# Workloads
kubectl get deploy -A --no-headers | wc -l
kubectl get statefulset -A --no-headers | wc -l

# Networking
kubectl get svc -A --no-headers | wc -l
kubectl get ingress -A --no-headers | wc -l

# Storage
kubectl get sc
kubectl get pv --no-headers | wc -l

# Autoscaling
kubectl get hpa -A
kubectl top nodes

# GitOps
kubectl get applications -A 2>/dev/null   # ArgoCD
```

A bundled helper script does all of this: `scripts/discover-cluster.sh`.

## What to bake into the deck

The "Cluster snapshot" slide reads as a tile dashboard. Map the discovery output to fixed slots:

| Tile                       | Source command                                 |
| -------------------------- | ---------------------------------------------- |
| Kubernetes version         | `kubectl version` (server)                     |
| Worker nodes count         | `kubectl get nodes \| wc -l` (subtract header) |
| Pods running               | `kubectl get pods -A \| wc -l`                 |
| Namespaces                 | `kubectl get ns \| wc -l`                      |
| Deployments / StatefulSets | counts                                         |
| Services / Ingresses       | counts                                         |
| Persistent volumes         | count                                          |
| Storage classes            | count                                          |
| HPAs active                | `kubectl get hpa -A` row count                 |
| ArgoCD apps                | `kubectl get applications -A` row count        |

Plus a **Platform stack** tile grid grouped by category (CI/CD · data · identity · edge · policy · observability · automation · environments). Use the actual workload names you found:

```html
<div class="stack-tile cicd">
  <h4>CI / CD</h4>
  <p>Jenkins · ArgoCD</p>
</div>
```

Plus a **3D cluster topology** scene populated with the per-namespace pod counts. The `cluster-topology` scene takes a `NS_DATA` map literal that you fill in from the discovery output:

```js
const NS_DATA = {
  "kube-system": { count: 18, color: 0x71717a },
  monitoring: { count: 13, color: 0x60a5fa },
  /* ... */
};
```

## Registry / image data

For decks that include a registry section (Docker, Harbor, SWR), capture:

```bash
# Image counts (whatever your registry CLI is)
swr list-repos --instance enterprise-prod | wc -l

# CVE summary on a representative image
trivy image --severity HIGH,CRITICAL <image>:latest

# Signing status
cosign verify <image>:latest
```

## CI / CD data

```bash
# Jenkins build queue
curl -s -u $TOKEN http://jenkins/queue/api/json | jq '.items | length'

# ArgoCD app health
kubectl get applications -A -o wide
```

## Anti-patterns

- **Don't fabricate numbers.** "97%" is more believable than "100%". Real numbers are weirder than rounded ones.
- **Don't show secrets.** Strip kubeconfig auth blocks, image registry passwords, and namespace names that leak product details before they're public. If a namespace name is a customer name, anonymise it.
- **Don't paste full `kubectl describe`.** It's long and noisy. Pick the 3–5 lines that prove the point.
- **Don't run anything that mutates.** Read-only `get`, `top`, `describe`. That's it.
