# Build Provenance

Every successful build writes `.output/public/build-metadata.json` with public, non-secret data:

- full Git SHA
- branch
- environment
- build time
- release/build version
- Node version
- package manager version
- provenance source

`pnpm provenance:verify` validates the artifact. Vercel builds fail when
`VERCEL_GIT_COMMIT_SHA` is absent, preventing an untraceable manual deployment from becoming a
release artifact. Local builds fall back to the checked-out Git commit and record whether the
working tree was dirty.

The production artifact is verified by requesting `/build-metadata.json` and comparing `gitSha`
with the approved `main` commit. A mismatch blocks promotion.

## Current Audit: 2026-08-04

- Git default branch: `main`
- Audited baseline: `9e0400638a40b374cdba94cf5b6d574f111ccdf9`
- Vercel project: `group-to-stay` (`prj_46BJmfJB3zXYMhwoZEvJDWee53xF`)
- Vercel Git connection: `Rmdn96/GroupToStay`, connected
- Production branch: `main`
- Current Production deployment: `dpl_9J86GkDzoQCmwGxHNr875U3KwSt4`
- Current Preview deployment: `dpl_5XVanET2LJTY8iaUZE6FyGy5kDp2`

Both current deployments were initiated with `vercel deploy` and expose no Git SHA in Vercel.
They therefore fail the V3 provenance standard even though the project itself is Git-connected.
No deployment configuration was changed during this PR.
