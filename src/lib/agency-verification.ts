export type AgencyVerificationProfile = {
  agency_verification_status?: string | null;
  legal_company_name?: string | null;
  country_id?: string | null;
  city_id?: string | null;
  full_address?: string | null;
  cr_number?: string | null;
  cr_expiry_date?: string | null;
  issuing_authority?: string | null;
  cr_document_path?: string | null;
  contact_person_name?: string | null;
  contact_person_position?: string | null;
  contact_person_email?: string | null;
  contact_person_phone?: string | null;
  agency_type?: string | null;
  annual_group_bookings?: string | null;
  avg_rooms_per_booking?: string | null;
  legal_billing_name?: string | null;
  vat_billing_number?: string | null;
  billing_address?: string | null;
  billing_email?: string | null;
  legal_agreements_accepted_at?: string | null;
};

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasCompleteAgencyVerificationProfile(
  profile: AgencyVerificationProfile | null | undefined,
) {
  if (!profile) return false;

  return (
    hasText(profile.legal_company_name) &&
    hasText(profile.country_id) &&
    hasText(profile.city_id) &&
    hasText(profile.full_address) &&
    hasText(profile.cr_number) &&
    hasText(profile.cr_expiry_date) &&
    hasText(profile.issuing_authority) &&
    hasText(profile.cr_document_path) &&
    hasText(profile.contact_person_name) &&
    hasText(profile.contact_person_position) &&
    hasText(profile.contact_person_email) &&
    hasText(profile.contact_person_phone) &&
    hasText(profile.agency_type) &&
    hasText(profile.annual_group_bookings) &&
    hasText(profile.avg_rooms_per_booking) &&
    hasText(profile.legal_billing_name) &&
    hasText(profile.vat_billing_number) &&
    hasText(profile.billing_address) &&
    hasText(profile.billing_email) &&
    hasText(profile.legal_agreements_accepted_at)
  );
}
