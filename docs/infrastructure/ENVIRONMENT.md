# Environment Contract

## Runtime

- Node.js reference runtime: `22.23.1`
- Vercel compatibility runtime: `>=22.22.2 <23`
- pnpm: `11.7.0`
- Package lock: `pnpm-lock.yaml`
- Install: `pnpm install --frozen-lockfile`

`.node-version`, `.nvmrc`, and GitHub Actions remain pinned to `22.23.1`. Vercel controls minor and
patch selection within its managed `22.x` runtime and was observed using `22.22.2`. The
`>=22.22.2 <23` engine range is a temporary Vercel-platform compatibility exception; it does not
approve Node 24 or lower the local/CI pins. Remove the exception when Vercel's managed Node 22
runtime satisfies the preferred `22.23.1` floor. Build metadata records the patch actually used.
The repository uses `engine-strict=true`; Node 23/24 and incorrect pnpm versions must fail before
installation.

## Supabase

The repository authority is `supabase/config.toml` and currently identifies project
`atxecflhmphaqqkatjlm`.

Required frontend variables:

- `VITE_SUPABASE_URL`
- one of `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

`pnpm env:check` rejects missing variables, non-HTTPS URLs, and URLs that do not match the
repository project ID. Service-role credentials must never use a `VITE_` prefix.

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
