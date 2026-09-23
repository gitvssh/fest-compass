# pickDday

pickDday helps local government officials use public data to explore regional tourism resources and visit trends when they plan a new festival or improve an existing one. Exploration needs no notes or saved plans; optional recording tools connect source evidence, explicit assumptions, operational scenarios, approvals, field actions, and measured outcomes. Visitor counts are not presented as admissions, and the data does not choose target visitors or the best date for the user.

The visible product name is exactly `pickDday`. Internal identifiers keep their existing values: the npm package name is the lowercase `pickdday` because npm names cannot contain capitals, while the GitHub repository, checkout paths, deployment resources, database files, browser storage keys, and saved-file formats still use `fest-compass`.

The web application lives in `apps/web`. Start with [the design index](docs/design/00_INDEX.md) for product behavior and [the documentation map](docs/README.md) for repository authority.

For the 2026-09-22 review, read the [current feature and flow baseline](docs/review/2026-09-current-state.md)
and [data inventory](docs/research/2026-09-data-inventory.md). They separate implemented behavior,
stored data awaiting integration, and future redesign under the [agreed planning principles](docs/product/planning-principles.md).
The home page separates the two purposes. The existing-festival journey starts at `/existing/search` and connects past regional visits, current tourism resources, and timing exploration without requiring records. See the [existing-festival implementation and verification](docs/validation/34-existing-festival-journey.md). The new-festival card and the `새 축제` menu open `/new`, a journey that starts from a region and its tourism resources and then lets the user freely explore visit trends and timing without notes; its implementation and verification are in progress. The general tourism map remains at `/regions`.

The [repository consolidation report](docs/ops/repository-consolidation.md) tracks the return to `gitvssh/fest-compass`, selected imports, and verification. The annual view at `/compare/annual` connects 26 festivals and 147 festival-year observations from preserved Korea Tourism Data Lab CSVs. The region explorer also provides a monthly event calendar with shared map/list selection and event CSV export; current festival comparison exports the filtered list. These additions are available at [the public app](https://pickday.damecasol.com/compare/annual). These are festival-period visitors to the hosting administrative area. The original 304 CSV files and their provenance remain in [the research import](docs/research/imported/hkjin-plan-03/README.md).

The Nonsan sample includes a historical model comparison at `/forecast` and preserved prospective regional forecasts at `/forecast/records`.
See [collection, issuance, and outcome checks](docs/validation/10-prospective-records.md) for reproducible commands and current limitations.
Production now collects and checks outcomes daily at 09:00 Asia/Seoul; the records page reads the latest preserved summary.
See [deployment and first-run evidence](docs/validation/11-daily-automation.md) and the [automation runbook](docs/ops/forecast-automation.md).

## Local development

The canonical WSL checkout is `~/dev/side/fest-compass` (GitHub `gitvssh/fest-compass`). Make changes on a dedicated branch in `~/dev/worktrees/fest-compass-<topic>`; see [WSL development](docs/ops/wsl-development.md).

```powershell
cd apps/web
npm ci
npx prisma db push
npm run db:seed
npm run dev
```

Local development defaults to editor mode. Production at `https://pickday.damecasol.com` is intentionally read-only until an authenticated operator boundary is approved and implemented.

## Verification

```powershell
cd apps/web
npm test
npm run typecheck
npm run build
npm run test:e2e
```

`npm run test:e2e` builds the app, serves it on a free loopback port, and drives
it with Playwright's bundled Chromium against an isolated SQLite database that is
deleted afterwards. The browser is downloaded on first run and reused after that,
so a clean clone needs no manual setup beyond `npm ci`. On a bare Linux host the
download may still need shared libraries, which `npx playwright install-deps
chromium` installs.

App-owned Kubernetes and Argo descriptor checks are run from the repository root:

```powershell
python infra/scripts/validate_argocd_registration.py
```

Deployment is not complete until the immutable image, Vault/VSO resources, Argo application, exact-host certificate and route, origin HTTPS, Cloudflare Tunnel/DNS, and public SEO/privacy checks all pass.

## License

Released under the [MIT License](LICENSE). Tourism data served through the app
remains subject to the terms of its own providers.
