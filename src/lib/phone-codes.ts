export type PhoneCode = { code: string; flag: string; label: string };

export const PHONE_CODES: PhoneCode[] = [
  { code: "+966", flag: "🇸🇦", label: "Saudi Arabia" },
  { code: "+971", flag: "🇦🇪", label: "United Arab Emirates" },
  { code: "+974", flag: "🇶🇦", label: "Qatar" },
  { code: "+965", flag: "🇰🇼", label: "Kuwait" },
  { code: "+973", flag: "🇧🇭", label: "Bahrain" },
  { code: "+968", flag: "🇴🇲", label: "Oman" },
  { code: "+20",  flag: "🇪🇬", label: "Egypt" },
  { code: "+962", flag: "🇯🇴", label: "Jordan" },
  { code: "+961", flag: "🇱🇧", label: "Lebanon" },
  { code: "+212", flag: "🇲🇦", label: "Morocco" },
  { code: "+216", flag: "🇹🇳", label: "Tunisia" },
  { code: "+90",  flag: "🇹🇷", label: "Turkey" },
  { code: "+44",  flag: "🇬🇧", label: "United Kingdom" },
  { code: "+1",   flag: "🇺🇸", label: "United States" },
];

export const DEFAULT_PHONE_CODE = "+966";
