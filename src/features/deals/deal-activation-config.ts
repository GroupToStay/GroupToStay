const legacyDealActivationFlag = process.env.VITE_V3_DEAL_ACTIVATION_ENABLED ?? "false";

export const dealActivationEnabled =
  String(
    process.env.NEXT_PUBLIC_V3_DEAL_ACTIVATION_ENABLED ?? legacyDealActivationFlag,
  ).toLowerCase() === "true";
