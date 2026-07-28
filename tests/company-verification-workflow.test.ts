import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728153000_fix_company_verification_editability.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("company verification database contract", () => {
  it("keeps pending agency profiles read-only and locks verified agency data", () => {
    expect(migration).toContain("COALESCE(OLD.agency_verification_status::text, 'draft')");
    expect(migration).toContain("NOT IN ('draft', 'rejected')");
    expect(migration).toContain("NEW.agency_verification_status = 'pending_review'");
  });

  it("allows only an agency owner to submit draft or rejected verification", () => {
    expect(migration).toContain("auth.uid() = NEW.id");
    expect(migration).toContain(
      "COALESCE(OLD.agency_verification_status::text, 'draft') IN ('draft', 'rejected')",
    );
    expect(migration).toContain("NEW.agency_verification_status::text = 'pending_review'");
    expect(migration).toContain("NOT public.has_role(NEW.id, 'organizer')");
    expect(migration).toContain("_previous_status NOT IN ('draft', 'rejected')");
    expect(migration).toContain("NEW.verification_submitted_at := now()");
    expect(migration).toContain("NEW.verification_rejection_reason := NULL");
  });

  it("keeps submission validation and verification history in the existing trigger", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.validate_agency_verification_submission()",
    );
    expect(migration).toContain("INSERT INTO public.agency_verification_events");
    expect(migration).not.toContain("submit_agency_verification");
    expect(migration).toContain('CREATE POLICY "Users update own profile"');
    expect(migration).toContain("agency_verification_status::text = 'pending_review'");
  });
});
