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

## Continuous Integration

GitHub Actions runs the `Build Verification` workflow on every push and pull request. The workflow verifies:

- `pnpm install`
- `pnpm format:check`
- `pnpm exec tsc --noEmit`
- `pnpm exec eslint .`
- `pnpm build`

Any failing step blocks the workflow.
