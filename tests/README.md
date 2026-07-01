# RLS test suites

These tests verify Supabase Row-Level Security behavior against a **real
Supabase project**. They provision throwaway users, exercise storage /
table policies with real access tokens, and clean up.

## Prerequisites

Set the following environment variables (e.g. in a local `.env` — do NOT
commit real secrets):

```
SUPABASE_URL=...                 # or VITE_SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=...     # or VITE_SUPABASE_PUBLISHABLE_KEY / ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=...    # service role — server-only, never ship to client
```

Without `SUPABASE_SERVICE_ROLE_KEY` the suites self-skip (the CI runner has
no way to mint test users otherwise).

## Run

```
bun run test:rls
```

## What is covered

- `tests/rls/agency-documents.test.ts` — enforces that only the owning
  agency and platform admins can read/write objects inside the private
  `agency-documents` bucket. Also confirms anon is blocked, that
  cross-agency access is denied, that non-PDF/JPG/PNG uploads are rejected,
  and that oversize (>10 MB) uploads are rejected.
