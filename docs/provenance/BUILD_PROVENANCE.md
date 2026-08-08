# Build Provenance

Every successful build writes `.output/public/build-metadata.json` with exactly these public,
non-secret fields:

- `version`
- `sha`
- `branch`
- `environment`
- `timestamp`
- `node`
- `pnpm`

After Nitro creates the Vercel Build Output API tree, Vercel Git builds write the same document to
`.vercel/output/static/build-metadata.json`. The writer refuses to create that directory itself,
so a missing framework artifact fails the build instead of being hidden. Vercel builds also fail
when the GitHub provider/repository identity, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, or
`VERCEL_ENV` is absent, preventing an untraceable manual deployment from becoming a release
artifact. Local builds fall back to the checked-out Git commit; GitHub Actions uses its trusted SHA
and branch/ref context.

`pnpm provenance:verify` validates the local/CI artifact. The deployed artifact is verified by
requesting `/build-metadata.json` and comparing `sha`
with the approved `main` commit. A mismatch blocks promotion.

## Current Audit: 2026-08-08

- Git default branch: `main`
- Audited baseline: `9e0400638a40b374cdba94cf5b6d574f111ccdf9`
- Vercel project: `group-to-stay` (`prj_46BJmfJB3zXYMhwoZEvJDWee53xF`)
- Vercel Git connection: `GroupToStay/GroupToStay`, connected
- Production branch: `main`
- Preview deployments must originate from the Git connection and expose the exact PR HEAD through
  both Vercel deployment metadata and `/build-metadata.json`.
- Manual Production deployment remains prohibited.
