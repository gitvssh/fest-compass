# FEST Compass

FEST Compass is a Korean tourism-data decision workspace for festival planners. It connects source evidence, explicit assumptions, operational scenarios, approvals, field actions, and measured outcomes without presenting visitor counts as admissions or promising demand forecasts.

The web application lives in `apps/web`. Start with [the design index](docs/design/00_INDEX.md) for product behavior and [the documentation map](docs/README.md) for repository authority.

## Local development

```powershell
cd apps/web
npm ci
npx prisma db push
npm run db:seed
npm run dev
```

Local development defaults to editor mode. Production at `https://kto.damecasol.com` is intentionally read-only until an authenticated operator boundary is approved and implemented.

## Verification

```powershell
cd apps/web
npm test
npm run typecheck
npm run build
npm run test:e2e
```

App-owned Kubernetes and Argo descriptor checks are run from the repository root:

```powershell
python infra/scripts/validate_argocd_registration.py
```

Deployment is not complete until the immutable image, Vault/VSO resources, Argo application, exact-host certificate and route, origin HTTPS, Cloudflare Tunnel/DNS, and public SEO/privacy checks all pass.
