# pickDday repository guide

This repository contains the pickDday product and its app-owned deployment declarations.

## Authority

- Running code, generated Prisma client, tests, and rendered Kustomize output take precedence over prose.
- `docs/design/00_INDEX.md` is the design entry point.
- Human review copies go to `D:\download\project\pickDday\` (WSL: `/mnt/d/download/project/pickDday/`); follow `docs/ops/review-delivery.md`. Earlier copies under `D:\download\project\fest-compass\` stay as delivered; do not move, delete, or overwrite them. Keep project documents and editable sources in this repository.
- `docs/decisions/` records accepted production decisions. Do not rewrite accepted decisions; supersede them.
- Cluster-wide policy remains owned by `/home/lsh/dev/homelab-gitops` and `/home/lsh/dev/infra`.

## Boundaries

- Visible product name: `pickDday` (exact case) in UI, metadata, user-facing download names, and current documents. The npm package name is lowercase `pickdday`.
- Project/infrastructure slug: `fest-compass`. Repository, deployment, Vault/registry, database, browser storage keys, and saved-file format identifiers keep this value unless a separate rename decision is recorded.
- Canonical checkout: WSL `~/dev/side/fest-compass` (GitHub `gitvssh/fest-compass`). Make changes on a dedicated branch in `~/dev/worktrees/fest-compass-<topic>`; see `docs/ops/wsl-development.md`.
- Public hostname: `pickday.damecasol.com`.
- Public production mode is `APP_MODE=public-readonly`; local development defaults to editor mode.
- Never commit `.env`, API keys, SQLite files, Kubernetes Secret values, or rendered secret data.
- The app repository may own workload manifests and the bounded Argo descriptor only. It must not define an `Application`, `ApplicationSet`, `AppProject`, cluster destination, or sync/delete policy.
- Production uses one SQLite writer on an RWO PVC with a `Recreate` deployment strategy. Do not increase replicas without an accepted PostgreSQL migration decision.

## Commands

Run app commands from `apps/web`:

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Run deployment contract checks from the repository root:

```powershell
python infra/scripts/validate_argocd_registration.py
python -m unittest infra.scripts.test_validate_argocd_registration
```

`--release` is allowed only after the production overlay contains a verified, non-zero Harbor image digest.

## Change discipline

- Preserve unrelated user files and generated evidence.
- Use `apply_patch` for source and documentation edits.
- Keep API key values out of terminals and reports; report only presence, key names, types, lengths, and status.
- Publish in this order: app repository, infra onboarding, cluster GitOps registration, manual Argo sync, origin verification, then Cloudflare hostname reconciliation.
- A GitOps main push can activate live state. Do not publish activation changes while prerequisites remain unresolved.
