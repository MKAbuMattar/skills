# Reference decks

Two complete, shipped decks built with this skill:

## `docker-fundamentals-presentation/`

51 slides across 8 sections.

- 5 interactive games: image-vs-container, density-race, cold-start, cve-hunt, pipeline animation
- Real CDN → container-registry pipeline (e.g. CDN edge → enterprise registry)
- 4-tier image security visualisation (normal / hardened / signed / encrypted)
- kubectl-style demo simulator with 4 walkthroughs

## `kubernetes-fundamentals-presentation/`

55 slides across 9 sections.

- 11 interactive games:
  - self-healing — click pods to kill them
  - pod-scaling (HPA Race) — load slider drives autoscaling
  - rolling-deploy — v1 → v2 with zero downtime
  - traffic-wave — sine-wave load auto-generator
  - chaos — kill an entire node, watch pods migrate
  - canary — % traffic slider v1 ↔ v2
  - service-routing — Service load-balances to pods
  - edge-to-pod — full Internet → CDN → cloud → ingress controller → Service → Pods flow
  - deploy-race — Manual vs Docker vs K8s
  - cluster-topology — real cluster (your node and pod counts)
  - pipeline animation — git → CI → registry → CD → cluster
- Live cluster snapshot tile dashboard (real numbers from `kubectl`)
- 4 kubectl demo simulator walkthroughs

## How to use as references

Treat both decks as the "source of truth" for what good output looks like:

1. **Building a new deck?** Run `scripts/new-deck.sh <topic-name>` to clone the framework files into a new folder, then author slides in `index.html`.
2. **Adding a new game?** Find the most-similar shipped game in `assets/templates/scenes.js` and copy-modify its factory function.
3. **Stuck on a layout?** Open both shipped decks side-by-side and compare. The same CSS class works in both.
4. **Want to see live data integration?** The k8s deck's "Your Cluster · Live" section is the canonical example.

> The shipped templates ship with **placeholder values** for cloud / registry / ingress. When you build your own deck, replace the placeholders (`<cloud-provider>`, `registry.example.com`, `<ingress-controller>`, etc.) with your actual stack. Examples: cloud providers like AWS / Azure / GCP / HuaweiCloud / OCI; registries like ECR / ACR / Artifact Registry / GHCR; ingress controllers like Nginx / Kong / Traefik / Istio.
