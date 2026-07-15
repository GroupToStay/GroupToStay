import { describe, expect, it } from "vitest";
import { hasCompleteAgencyVerificationProfile } from "../src/lib/agency-verification";
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

  it("allows only internal dashboard notification destinations", () => {
    expect(getSafeNotificationHref("/dashboard/rfqs/123")).toBe("/dashboard/rfqs/123");
    expect(getSafeNotificationHref("https://example.com")).toBeNull();
    expect(getSafeNotificationHref("//example.com/dashboard")).toBeNull();
    expect(getSafeNotificationHref(null)).toBeNull();
  });
});
