import { describe, expect, it } from "vitest";
import {
  canSubmitAgencyVerification,
  getAgencyVerificationEditablePatch,
  hasCompleteAgencyVerificationProfile,
  isAgencyVerificationLocked,
} from "../src/lib/agency-verification";
import { getSafeNotificationHref } from "../src/lib/notification-link";

const completeAgency = {
  agency_verification_status: "verified",
  legal_company_name: "TEST_Agency",
  country_id: "country-id",
  city_id: "city-id",
  full_address: "TEST_Address",
  cr_number: "TEST_CR",
  cr_expiry_date: "2027-01-01",
  issuing_authority: "TEST_Authority",
  cr_document_path: "agency/test.pdf",
  contact_person_name: "TEST_Contact",
  contact_person_position: "Manager",
  contact_person_email: "test@example.com",
  contact_person_phone: "+966500000000",
  agency_type: "travel_agency",
  annual_group_bookings: "10_50",
  avg_rooms_per_booking: "20_50",
  legal_billing_name: "TEST_Billing",
  vat_billing_number: "TEST_VAT",
  billing_address: "TEST_Billing_Address",
  billing_email: "billing@example.com",
  legal_agreements_accepted_at: "2026-07-14T00:00:00Z",
};

describe("critical blocker guards", () => {
  it("accepts only complete agency verification profiles", () => {
    expect(hasCompleteAgencyVerificationProfile(completeAgency)).toBe(true);
    expect(
      hasCompleteAgencyVerificationProfile({ ...completeAgency, legal_company_name: " " }),
    ).toBe(false);
    expect(hasCompleteAgencyVerificationProfile(null)).toBe(false);
  });

  it("locks company verification only after approval", () => {
    for (const status of [null, "draft", "rejected"]) {
      expect(isAgencyVerificationLocked(status)).toBe(false);
    }
    expect(isAgencyVerificationLocked("submitted")).toBe(true);
    expect(isAgencyVerificationLocked("pending_review")).toBe(true);
    expect(isAgencyVerificationLocked("verified")).toBe(true);
  });

  it("allows only initial agency submissions and resubmissions", () => {
    expect(canSubmitAgencyVerification(null)).toBe(true);
    expect(canSubmitAgencyVerification("draft")).toBe(true);
    expect(canSubmitAgencyVerification("rejected")).toBe(true);
    expect(canSubmitAgencyVerification("submitted")).toBe(false);
    expect(canSubmitAgencyVerification("pending_review")).toBe(false);
    expect(canSubmitAgencyVerification("verified")).toBe(false);
  });

  it("sends only owner-editable verification fields to profile updates", () => {
    const patch = getAgencyVerificationEditablePatch({
      legal_company_name: "TEST_Agency",
      cr_number: "TEST_CR",
      agency_verification_status: "verified",
      verification_reviewed_by: "reviewer-id",
      approval_notes: "reviewer-only",
      account_status: "suspended",
    });

    expect(patch).toMatchObject({
      legal_company_name: "TEST_Agency",
      cr_number: "TEST_CR",
    });
    expect(patch).not.toHaveProperty("agency_verification_status");
    expect(patch).not.toHaveProperty("verification_reviewed_by");
    expect(patch).not.toHaveProperty("approval_notes");
    expect(patch).not.toHaveProperty("account_status");
  });

  it("allows only internal dashboard notification destinations", () => {
    expect(getSafeNotificationHref("/dashboard/rfqs/123")).toBe("/dashboard/rfqs/123");
    expect(getSafeNotificationHref("https://example.com")).toBeNull();
    expect(getSafeNotificationHref("//example.com/dashboard")).toBeNull();
    expect(getSafeNotificationHref(null)).toBeNull();
  });
});
