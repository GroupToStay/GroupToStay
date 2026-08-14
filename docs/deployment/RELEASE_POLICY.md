# Release Policy

## Required Pull Request Checks

1. `pnpm install --frozen-lockfile`
2. `pnpm format:check`
3. `pnpm exec tsc --noEmit`
4. `pnpm exec eslint .`
5. `pnpm test`
6. `pnpm build`
7. `pnpm provenance:verify`
8. Migration reconciliation against the target Supabase migration ledger

Protect `main` by requiring a pull request, the `Verify Build` status check, resolved review
threads, and no force pushes or branch deletion. Require owner approval for production promotion.

## Vercel

- Git repository: `GroupToStay/GroupToStay`
- Production branch: `main`
- Git-based deployments only; manual `vercel deploy --prod` is prohibited.
- Preview deployments originate from reviewed branches or pull requests.
- Production and Preview variables are scoped separately and contain one canonical Supabase URL
  and one public key variable.
- The deployment's `/build-metadata.json` SHA must equal the approved commit before smoke tests.
- Local development, GitHub Actions, and Vercel builds must use Node `>=24.15.0 <25`.

## Database Gate

Application release approval requires a read-only comparison between repository migrations and
the Supabase migration ledger. Missing, manually applied, or divergent changes block release until
classified and reconciled. A frontend deployment must never replay migrations automatically.

## Rollback

Rollback means promoting a previously verified Git-backed Vercel deployment whose metadata points
to an approved commit. Database rollback is separate and must use an reviewed forward correction;
destructive rollback is not automatic.

## Owner Actions Required

1. GitHub Actions secret `VITE_SUPABASE_ANON_KEY` is configured. Keep its value external to the
   repository and rotate it through GitHub if needed.
2. Keep the public GitHub repository's `main` branch protection and required checks enabled.
3. Confirm Vercel uses Node `>=24.15.0 <25` and retains the `main` production branch; verify the
   actual patch in `/build-metadata.json` after deployment.
4. Stop manual Production deployments and promote only Git-backed builds.
5. Review duplicate Vercel environment entries and keep one canonical variable per scope.

These actions affect external systems and were intentionally not performed by this PR.
