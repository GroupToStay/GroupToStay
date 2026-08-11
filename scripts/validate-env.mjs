import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supabaseConfig = readFileSync(resolve(repositoryRoot, "supabase/config.toml"), "utf8");
const projectId = supabaseConfig.match(/^project_id\s*=\s*"([a-z0-9]+)"\s*$/m)?.[1];

if (!projectId) {
  console.error("[env] supabase/config.toml must declare project_id.");
  process.exit(1);
}

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
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.trim();
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  process.env.VITE_SUPABASE_ANON_KEY?.trim() ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL (or VITE_SUPABASE_URL)");
if (!publicKey) {
  missing.push(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY)",
  );
}

if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:") throw new Error("Supabase URL must use HTTPS.");
    const expectedHost = `${projectId}.supabase.co`;
    if (parsed.hostname !== expectedHost) {
      console.error(`[env] VITE_SUPABASE_URL must target ${expectedHost}.`);
      process.exit(1);
    }
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

console.log(`[env] Required Supabase environment variables target project ${projectId}.`);
