# GroupToStay

GroupToStay is a B2B accommodation RFQ marketplace built with TanStack Start, React, Vite, pnpm, and Supabase.

## Environment

Use the repository-pinned runtime versions:

- Node.js: `22.23.1`
- pnpm: `11.7.0`

The Node version is declared in `.nvmrc`, `.node-version`, and `package.json` engines. The package manager is declared in `package.json` as `pnpm@11.7.0`.

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Code Quality

Check formatting:

```bash
pnpm format:check
```

Format files:

```bash
pnpm format
```

Lint:

```bash
pnpm exec eslint .
```

Typecheck:

```bash
pnpm exec tsc --noEmit
```

## Production Build

```bash
pnpm build
```

## Vercel Test Deployment

Use the `Other` framework preset. Nitro detects Vercel during the build and emits the Vercel
Build Output API automatically, so leave the Output Directory setting empty.

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: leave empty

For the test deployment, add these variables to the Vercel Preview environment only:

```text
VITE_SUPABASE_URL=https://atxecflhmphaqqkatjlm.supabase.co
VITE_SUPABASE_ANON_KEY=<external Supabase anon or publishable key>
```

Copy the current publishable or anon key from the external Supabase project's API settings. Do not
reuse an older locally stored key, and do not add these variables to Vercel Production until the
preview deployment has been approved.

Do not add a service-role key to the frontend environment. The current application runtime does
not import the dormant server-admin Supabase client.

## Continuous Integration

GitHub Actions runs the `Build Verification` workflow on every push and pull request. The workflow verifies:

- `pnpm install`
- `pnpm format:check`
- `pnpm exec tsc --noEmit`
- `pnpm exec eslint .`
- `pnpm build`

Any failing step blocks the workflow.
