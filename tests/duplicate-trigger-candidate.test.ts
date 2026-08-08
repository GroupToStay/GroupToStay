import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const candidatePath = resolve(
  "supabase/migration-candidates/20260808193000_remove_duplicate_guard_triggers.sql",
);

describe("duplicate trigger cleanup candidate", () => {
  it("remains non-executable until an owner-approved reconciliation step", () => {
    const candidate = readFileSync(candidatePath, "utf8");

    expect(candidatePath).not.toContain(`${resolve("supabase/migrations")}`);
    expect(candidate).toContain(
      "DROP TRIGGER IF EXISTS restrict_organizer_booking_updates_trg ON public.bookings;",
    );
    expect(candidate).toContain(
      "DROP TRIGGER IF EXISTS trg_require_verified_agency_for_conversation ON public.conversations;",
    );
    expect(candidate).toContain(
      "DROP TRIGGER IF EXISTS trg_require_verified_agency_for_rfq ON public.rfqs;",
    );
    expect(candidate).toContain("DROP TRIGGER IF EXISTS validate_rfq_row_trg ON public.rfqs;");
    expect(candidate).toContain("survivor trigger postcondition failed");
  });
});
