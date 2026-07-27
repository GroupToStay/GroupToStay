import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const mode = process.env.NODE_ENV === "development" ? "development" : "production";
const candidates = [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"].map((file) =>
  resolve(process.cwd(), file),
);

config({
  path: candidates.filter(existsSync),
  override: false,
  quiet: true,
});

const missing = [];
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const publicKey =
  process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
if (!publicKey) {
  missing.push("VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY");
}

if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:") throw new Error("Supabase URL must use HTTPS.");
  } catch {
    console.error("[env] VITE_SUPABASE_URL must be a valid HTTPS URL.");
    process.exit(1);
  }
}

if (missing.length > 0) {
  console.error(`[env] Missing required environment variable(s): ${missing.join(", ")}.`);
  console.error("[env] Build stopped before application compilation.");
  process.exit(1);
}

console.log("[env] Required Supabase environment variables are configured.");
