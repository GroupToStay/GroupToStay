export const dealActivationEnabled =
  String(import.meta.env.VITE_V3_DEAL_ACTIVATION_ENABLED ?? "false").toLowerCase() === "true";
