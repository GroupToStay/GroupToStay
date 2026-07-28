# Company Verification Workflow Fix Report

## PHASE

Company Verification Workflow Remediation

## SUMMARY

The existing company verification architecture is retained. Agency owners use the
normal `profiles` update path for drafts and submission; no new RPC or database API is
introduced.

The corrected workflow is:

- Not submitted, `draft`, and `rejected` agency profiles are editable.
- Owners may submit only through `draft -> pending_review` or
  `rejected -> pending_review`.
- `submitted`, `pending_review`, and `verified` agency profiles are read-only to the
  owner.
- Reviewers continue to use the unchanged `admin_decide_approval()` function.
- Existing hotel verification behavior is unchanged.

## ROOT CAUSE

`restrict_profile_company_fields()` treated every change to company identity fields as
an attempt to alter an approved company. It did not consider verification status.

`prevent_profile_approval_self_update()` treated every agency status change as
reviewer-only, including the two legitimate owner submission transitions.

The frontend compounded the problem by spreading the complete profile record into
updates, which could include reviewer-owned fields.

## FILES CHANGED

- `src/lib/agency-verification.ts`
  - Centralizes editable agency fields, lock states, and valid submission states.
- `src/routes/_authenticated/dashboard.agency-profile.tsx`
  - Sends an allowlisted draft payload.
  - Uses the existing profile update path for submission.
  - Sends no reviewer-owned fields.
  - Makes pending and verified records read-only.
- `supabase/migrations/20260728153000_fix_company_verification_editability.sql`
  - Corrects the three existing trigger functions.
  - Replaces the owner profile policy with owner-row scope; exact transitions remain
    enforced by the existing approval trigger, where both `OLD` and `NEW` are
    available.
- `tests/critical-blockers.test.ts`
  - Covers edit locks, valid submission states, and the client field allowlist.
- `tests/company-verification-workflow.test.ts`
  - Covers migration and transition contracts and confirms no submission RPC exists.

## DATABASE CHANGES

One migration updates only existing database behavior:

`supabase/migrations/20260728153000_fix_company_verification_editability.sql`

It replaces:

- `restrict_profile_company_fields()`
- `prevent_profile_approval_self_update()`
- `validate_agency_verification_submission()`
- the existing `"Users update own profile"` RLS policy

It creates no tables, columns, RPCs, or parallel APIs. It does not modify existing
business records. `admin_decide_approval()` is unchanged.

The migration was applied transactionally to Supabase project
`atxecflhmphaqqkatjlm`. A post-apply catalog check confirmed:

- The migration is registered.
- All three existing trigger functions contain the corrected status-aware behavior.
- The owner profile policy remains scoped to `auth.uid() = id`.
- The definition hash of `admin_decide_approval()` is unchanged.

## SECURITY IMPACT

- RLS still limits owners to their own profile row.
- Only `draft/rejected -> pending_review` owner transitions are accepted.
- Reviewer decision fields, trust level, hotel approval fields, and account status
  remain protected by existing backend triggers.
- Pending and verified agency verification data is locked at the database layer.
- Submission time and rejection-reason clearing are assigned server-side.
- Submission history is appended exactly once by the existing validation trigger.

## PERFORMANCE IMPACT

Negligible. Draft and submission updates send smaller payloads, and the separate
client-side verification-event insert is removed.

## LOCALIZATION IMPACT

None. No translation catalog or user-visible wording changed.

## QUALITY GATES

- `pnpm install --frozen-lockfile`: passed.
- `pnpm format:check`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm exec eslint .`: passed.
- `pnpm test`: passed, 65 tests passed and 18 skipped.
- `pnpm build`: passed.
- Vercel Production environment check: required Supabase URL and public key variables
  are present.

A rollback-only database workflow test confirmed:

- Draft agency fields remain editable.
- Rejected agency fields remain editable.
- Rejected agencies can transition to `pending_review`.
- The server assigns the submission timestamp and clears the rejection reason.
- Exactly one submission event is appended.
- Pending-review agency fields are locked.
- Verified agency fields are locked.
- The rollback left no test suffixes in profile data.

## REMAINING RISKS

Authenticated browser smoke testing depends on an existing production session for an
agency and an approval reviewer. Database-level workflow coverage has passed without
persisting test business data.

## READY FOR REVIEW

Implementation and database validation are complete. Production deployment and
post-deployment browser smoke testing are recorded in the completion response.
