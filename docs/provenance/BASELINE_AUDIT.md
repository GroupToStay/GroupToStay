# Infrastructure and Provenance Baseline Audit

Date: 2026-08-08

## Repository

- Default branch: `main`
- Remote baseline: `9e0400638a40b374cdba94cf5b6d574f111ccdf9`
- Package manager: pnpm with one tracked lockfile
- Generated runtime/build directories: ignored and untracked
- Generated source files intentionally tracked: `src/routeTree.gen.ts` and Supabase database types
- Finding: a runtime `.env` for obsolete project `divgqjlotvmlmkzjtlzw` was still tracked despite
  `.gitignore`. This PR removes it and adds a build-time project guard.
- GitHub Actions secret `VITE_SUPABASE_ANON_KEY` is configured and is consumed only by the build
  workflow; its value is not stored in repository files.
- Branch protection for `main` is configured. GitHub reports it cannot be enforced while this
  repository remains private on GitHub Free, so it is a documented governance control rather than
  a technical merge gate until the repository is moved to an eligible plan or organization.

## Vercel

Vercel is connected to `Rmdn96/GroupToStay`, and Production tracks `main`. The current Production
and latest Preview are manual CLI deployments without visible commit provenance. Git-backed
deployments exist historically, so the correction is procedural plus the build metadata gate in
this PR. Rollback exists at the deployment level, but an untraceable deployment must not be used as
an approved rollback target.

## Supabase

- Repository project: `atxecflhmphaqqkatjlm`
- Runtime Production bundle: external project `atxecflhmphaqqkatjlm`
- Repository migration files at the audited baseline: 79
- Live migration ledger entries observed during reconciliation: 60

The ledger does not exactly match repository history. Live functions and triggers include changes
whose migration versions are absent from the ledger, indicating manual application. The live
ledger also contains `20260729180000_global_country_city_experience`, which is absent from the
audited baseline. The generated types omit at least one live field observed during reconciliation.
These are database-provenance blockers for the next reconciliation PR; this PR does not alter the
database, migrations, or generated types.

## CI

The existing workflow pinned Node and pnpm but installed without `--frozen-lockfile`, cached
`node_modules`, omitted tests, and relied on the tracked `.env`. This PR uses the pnpm store cache
provided by `actions/setup-node`, adds tests and provenance verification, and requires the public
Supabase key through the configured GitHub Actions secret `VITE_SUPABASE_ANON_KEY`.

## Classification

| Finding                                    | Severity | Status                                           |
| ------------------------------------------ | -------- | ------------------------------------------------ |
| Tracked obsolete `.env`                    | High     | Corrected locally                                |
| Current deployments lack Git SHA           | High     | External process change required                 |
| Supabase migration ledger drift            | High     | Deferred to database reconciliation              |
| Generated types do not match live schema   | High     | Deferred to database reconciliation              |
| GitHub Free cannot enforce private rules   | High     | Upgrade or organization move required            |
| GitHub Actions public-key secret           | High     | Configured; value remains external               |
| Local host uses Node 24.18.0 / pnpm 11.9.0 | Medium   | Source enforcement added; host remains unchanged |
| CI omitted tests and frozen install        | Medium   | Corrected locally                                |
