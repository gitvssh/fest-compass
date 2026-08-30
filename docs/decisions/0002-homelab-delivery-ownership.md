---
class: SSOT (Core)
doc_class: decision
doc_kind: adr
authority: canonical
owner: fest-compass
id: ADR-0002
status: Accepted
last_verified: 2026-08-30
---

# ADR-0002: Homelab delivery ownership

## Context

The homelab separates application lifecycle declarations from cluster-wide permissions and platform bootstrap.

## Decision

The canonical identity is:

- project, namespace, Harbor project, Vault project, and Argo project slug: `fest-compass`;
- intended GitHub repository: `gitvssh/fest-compass`;
- public hostname: `kto.damecasol.com`;
- intended repository ARC label: `homelab-fest-compass`.

This repository owns the container, workload manifests under `infra/k8s/fest-compass`, and the bounded descriptor under `infra/argocd/applications/prod.json`.

`infra` owns Harbor, Vault, and repository-scoped ARC onboarding. `homelab-gitops` owns the least-privilege AppProject/ApplicationSet, exact-host certificate and Gateway listener, and the canonical Tunnel/DNS reconciliation wrapper.

Publication order is application, infra, cluster GitOps, manual sync, exact-origin validation, then Cloudflare reconciliation. Secret values are accepted only through the approved hidden-input transaction and are never committed or printed.

## Consequences

The intended repository and ARC names remain pre-activation declarations until their remote and live resources are verified. A main push must not be interpreted as safe activation while any prerequisite remains missing.
