---
class: SSOT (Core)
doc_class: decision
doc_kind: adr
authority: canonical
owner: fest-compass
id: ADR-0001
status: Accepted
last_verified: 2026-08-30
---

# ADR-0001: Public read-only and single-writer SQLite boundary

## Context

The MVP has server actions that create and mutate planning records and trigger KTO calls, but it has no user authentication or tenant authorization. It also stores state in SQLite.

## Decision

`kto.damecasol.com` runs with `APP_MODE=public-readonly`. The application must hide editor controls and reject every server-side write or external-refresh action even when invoked directly. Local development defaults to `editor`.

Production keeps SQLite only under these constraints:

- one replica and `Recreate` rollout strategy;
- one RWO PVC mounted at `/data`;
- `DATABASE_URL=file:/data/fest-compass.db`;
- schema changes through `prisma migrate deploy`, never destructive seed-on-start;
- readiness checks the local database but not external KTO availability.

## Consequences

The public site demonstrates an auditable planning workflow without sharing a writable ledger. Authenticated editing and multiple replicas require a later decision, expected to include an identity boundary and PostgreSQL migration.
