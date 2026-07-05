# Mortimer – Canadian Mortgage Insights

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/michaelsanford/Mortimer?color=blue)](https://github.com/michaelsanford/Mortimer/releases)
[![Deploy](https://github.com/michaelsanford/Mortimer/actions/workflows/deploy.yml/badge.svg)](https://github.com/michaelsanford/Mortimer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Progressive%20Web%20App-orange?logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

[![CI](https://github.com/michaelsanford/Mortimer/actions/workflows/ci.yml/badge.svg)](https://github.com/michaelsanford/Mortimer/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-report-blue?logo=vitest&logoColor=white)](https://github.com/michaelsanford/Mortimer/actions/workflows/ci.yml)
[![Qodana Scan](https://github.com/michaelsanford/Mortimer/actions/workflows/qodana_code_quality.yml/badge.svg)](https://github.com/michaelsanford/Mortimer/actions/workflows/qodana_code_quality.yml)
[![Security scan: Grype](https://img.shields.io/badge/security%20scan-Grype-8A2BE2)](https://github.com/michaelsanford/Mortimer/security/code-scanning)
[![SBOM: CycloneDX](https://img.shields.io/badge/SBOM-CycloneDX-blue)](https://github.com/michaelsanford/Mortimer/actions/workflows/ci.yml)
[![Linter: oxlint](https://img.shields.io/badge/linter-oxlint-blue)](https://github.com/oxc-project/oxc)

[![GitHub issues](https://img.shields.io/github/issues/michaelsanford/Mortimer?color=red)](https://github.com/michaelsanford/Mortimer/issues)
[![GitHub PRs](https://img.shields.io/github/issues-pr/michaelsanford/Mortimer?color=orange)](https://github.com/michaelsanford/Mortimer/pulls)
[![GitHub contributors](https://img.shields.io/github/contributors/michaelsanford/Mortimer)](https://github.com/michaelsanford/Mortimer/graphs/contributors)
[![GitHub repo size](https://img.shields.io/github/repo-size/michaelsanford/Mortimer)](https://github.com/michaelsanford/Mortimer)


A privacy-first Progressive Web App for simulating mortgage paydowns, comparing renewal and refinancing rates, and planning home equity (HELOC) borrowing — tailored for Canadian mortgages.

All calculations run entirely in your browser. No data is collected, stored, or transmitted to any server.

## Features

- **Dashboard** — At-a-glance summary of your mortgage profile including remaining balance, interest paid, and time saved.
- **Paydown Simulator** — Model lump-sum payments, double-up schedules, payment increases, and see how they shorten your amortization.
- **Rates Comparer** — Compare renewal offers and refinancing scenarios side-by-side, including IRD and three-month interest penalties.
- **Reno & HELOC Planner** — Estimate home equity available for a HELOC and plan renovation financing.
- **Settings & Privacy** — Export/import profiles, enable passcode encryption, and clear all data.

## Canadian Mortgage Math

Mortimer uses semi-annual compounding (Canada's standard) to calculate effective periodic rates across all supported payment frequencies:

- Monthly
- Semi-monthly
- Bi-weekly (regular and accelerated)
- Weekly (regular and accelerated)

## Privacy & Compliance

- 100% client-side — no backend, no analytics, no cookies
- Optional passcode lock with Web Crypto key derivation
- PIPEDA and Loi 25 (Quebec) compliant
- Data stored only in browser `localStorage`

## Tech Stack

- [React](https://react.dev/) 19 + TypeScript 6
- [Vite](https://vite.dev/) 8
- [Chart.js](https://www.chartjs.org/) + react-chartjs-2
- [Lucide React](https://lucide.dev/) icons
- [Oxlint](https://oxc.rs/) for linting
- PWA with service worker and web manifest

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Testing & Coverage

```bash
npm test              # run the Vitest suite once
npm run test:watch    # watch mode
npm run test:coverage # run tests and generate a coverage report (./coverage)
```

Coverage is collected with the V8 provider. CI runs `test:coverage` on every push and pull
request: results are posted as a comment on the PR, and the full HTML report is uploaded as
the `coverage-report` artifact on each [CI run](https://github.com/michaelsanford/Mortimer/actions/workflows/ci.yml)
(open `index.html` after downloading).

## Supply Chain / SBOM

Generate a [CycloneDX](https://cyclonedx.org/) Software Bill of Materials locally:

```bash
npm run sbom   # writes bom.json (CycloneDX 1.6 JSON)
```

CI regenerates this on every run, publishes it as the `sbom-cyclonedx` build artifact, and
scans it for known vulnerabilities with [Grype](https://github.com/anchore/grype) — see
[SECURITY.md](SECURITY.md) for details.

## Deployment

Mortimer deploys to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.

The workflow uses `actions/configure-pages@v5` with `enablement: true`, which automatically enables GitHub Pages and configures it to build using GitHub Actions — no manual repository settings change required.

### Troubleshooting

If the **Setup Pages** step fails with `HttpError: Not Found`, ensure the repository has Pages permissions enabled:

1. Go to **Settings → Pages** in the repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Re-run the workflow.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
