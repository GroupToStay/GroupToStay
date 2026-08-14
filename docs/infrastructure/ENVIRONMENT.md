# Environment Contract

## Runtime

- Node.js reference runtime: `24.15.0`
- Supported runtime: `>=24.15.0 <25`
- pnpm: `11.7.0`
- Package lock: `pnpm-lock.yaml`
- Install: `pnpm install --frozen-lockfile`

`.node-version`, `.nvmrc`, and GitHub Actions are pinned to `24.15.0`. The package engine and build
provenance checks enforce the same Node 24 baseline in local, CI, and Vercel builds. Build metadata
records the exact patch used.
The repository uses `engine-strict=true`; unsupported Node majors and incorrect pnpm versions fail before
installation.

## Supabase

The repository authority is `supabase/config.toml` and currently identifies project
`atxecflhmphaqqkatjlm`.

Required frontend variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- one of `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`pnpm env:check` rejects missing variables, non-HTTPS URLs, and URLs that do not match the
repository project ID. Service-role credentials must never use a `NEXT_PUBLIC_` prefix.

Local values belong in `.env.local`. Runtime `.env` files are ignored and must not be committed.
The tracked `.env.example` contains names and non-secret examples only.

## Environment Mapping

| Environment | Source                               | Required Supabase project |
| ----------- | ------------------------------------ | ------------------------- |
| Local       | `.env.local`                         | `atxecflhmphaqqkatjlm`    |
| CI          | GitHub Actions secret + workflow URL | `atxecflhmphaqqkatjlm`    |
| Preview     | Vercel Preview variables             | `atxecflhmphaqqkatjlm`    |
| Production  | Vercel Production variables          | `atxecflhmphaqqkatjlm`    |

Do not copy Production secrets into repository files, logs, build metadata, or reports.
