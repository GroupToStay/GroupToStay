/**
 * Payment gateway abstraction layer.
 * Currently DISABLED — controlled by `platform_settings.subscriptions_enabled`.
 * Providers prepared for future integration:
 *  - Moyasar
 *  - Stripe
 *  - Tabby
 *
 * Do not invoke `createCheckoutSession` while the feature flag is false; the
 * UI redirects to /subscription/coming-soon instead.
 */
export type SubscriptionPlan = "professional" | "featured";
export type PaymentProvider = "moyasar" | "stripe" | "tabby";

export interface CheckoutRequest {
  plan: SubscriptionPlan;
  provider: PaymentProvider;
  hotelId: string;
  amount: number;
  currency: "SAR";
}

export async function createCheckoutSession(_req: CheckoutRequest): Promise<never> {
  throw new Error("Payments are disabled. Subscriptions launch soon.");
}
