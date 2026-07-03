# Mortimer – Canadian Mortgage Insights

[![CI & Deploy](https://github.com/michaelsanford/Mortimer/actions/workflows/deploy.yml/badge.svg)](https://github.com/michaelsanford/Mortimer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
