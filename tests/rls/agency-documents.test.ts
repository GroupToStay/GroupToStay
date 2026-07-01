/**
 * RLS suite: `agency-documents` storage bucket.
 *
 * Verifies the restrictive policies added for the Agency Verification
 * system:
 *   - agency_docs_owner_or_admin_only  — only owning agency or admin
 *   - agency_docs_mime_and_size_check  — PDF/JPG/PNG ≤ 10 MB on INSERT
 *   - agency_docs_no_anon              — anon fully blocked
 *
 * The upload path convention enforced by the app is `<user_id>/<file>` so
 * `(storage.foldername(name))[1]` matches `auth.uid()::text`.
 *
 * Requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or the VITE_ variants)
 * and SUPABASE_SERVICE_ROLE_KEY to mint throwaway users. Without the
 * service-role key the suite self-skips.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const BUCKET = "agency-documents";

const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY;
const d = skip ? describe.skip : describe;

// --- helpers ---------------------------------------------------------------

type Kind = "agency" | "hotel" | "admin";
interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

function freshClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf,
  0xd3, 0x0a,
]);

function objectPath(userId: string, name = `cr-${Date.now()}.pdf`) {
  return `${userId}/${name}`;
}

// --- suite -----------------------------------------------------------------

d("RLS: agency-documents bucket", () => {
  const admin = skip
    ? (null as unknown as SupabaseClient)
    : createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  const users: Record<"agencyA" | "agencyB" | "hotel" | "admin", TestUser> =
    {} as never;

  // Track uploaded object paths for cleanup.
  const uploaded: string[] = [];

  async function createUser(kind: Kind): Promise<TestUser> {
    const email = `rls-${kind}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.test`;
    const password = "TestPass!" + Math.random().toString(36).slice(2, 10);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: kind === "hotel" ? "hotel" : "organizer" },
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");

    // Force role in user_roles (bypasses signup default).
    // handle_new_user() inserted a row already; upsert to the desired role.
    await admin.from("user_roles").delete().eq("user_id", data.user.id);
    const roleRow = { user_id: data.user.id, role: kind };
    const { error: roleErr } = await admin.from("user_roles").insert(roleRow);
    if (roleErr) throw roleErr;

    // Agencies get marked verified so unrelated triggers don't interfere
    // with any profile writes we make later.
    if (kind === "agency") {
      await admin
        .from("profiles")
        .update({ agency_verification_status: "verified" })
        .eq("id", data.user.id);
    }

    const client = freshClient();
    const { error: signInErr } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) throw signInErr;

    return { id: data.user.id, email, password, client };
  }

  beforeAll(async () => {
    users.agencyA = await createUser("agency");
    users.agencyB = await createUser("agency");
    users.hotel = await createUser("hotel");
    users.admin = await createUser("admin");
  });

  afterAll(async () => {
    // Storage cleanup.
    if (uploaded.length) {
      await admin.storage.from(BUCKET).remove(uploaded);
    }
    // User cleanup (cascade removes profiles/user_roles).
    for (const u of Object.values(users)) {
      if (u?.id) await admin.auth.admin.deleteUser(u.id);
    }
  });

  // -- Anon --------------------------------------------------------------
  it("anon cannot upload", async () => {
    const anon = freshClient();
    const path = objectPath("00000000-0000-0000-0000-000000000000");
    const { error } = await anon.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });

  it("anon cannot download an existing object", async () => {
    // Seed one object as admin so there is something to try to read.
    const path = objectPath(users.agencyA.id, `seed-${Date.now()}.pdf`);
    const seed = await admin.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(seed.error).toBeNull();
    uploaded.push(path);

    const anon = freshClient();
    const { data, error } = await anon.storage.from(BUCKET).download(path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  // -- Owner ------------------------------------------------------------
  it("agency can upload a PDF into its own folder", async () => {
    const path = objectPath(users.agencyA.id);
    const { error } = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(error).toBeNull();
    uploaded.push(path);
  });

  it("agency can download its own object", async () => {
    const path = objectPath(users.agencyA.id, `own-read-${Date.now()}.pdf`);
    const up = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    uploaded.push(path);

    const { data, error } = await users.agencyA.client.storage
      .from(BUCKET)
      .download(path);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  // -- Cross-tenant -----------------------------------------------------
  it("agency cannot upload into another agency's folder", async () => {
    const path = objectPath(users.agencyB.id, `hijack-${Date.now()}.pdf`);
    const { error } = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });

  it("another agency cannot download the owner's object", async () => {
    const path = objectPath(users.agencyA.id, `xtenant-${Date.now()}.pdf`);
    const up = await admin.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    uploaded.push(path);

    const { data, error } = await users.agencyB.client.storage
      .from(BUCKET)
      .download(path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("hotels cannot download an agency's object", async () => {
    const path = objectPath(users.agencyA.id, `hotel-peek-${Date.now()}.pdf`);
    const up = await admin.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    uploaded.push(path);

    const { data, error } = await users.hotel.client.storage
      .from(BUCKET)
      .download(path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  // -- Admin ------------------------------------------------------------
  it("platform admin can download any agency object", async () => {
    const path = objectPath(users.agencyA.id, `admin-read-${Date.now()}.pdf`);
    const up = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    uploaded.push(path);

    const { data, error } = await users.admin.client.storage
      .from(BUCKET)
      .download(path);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  // -- Update / delete --------------------------------------------------
  it("agency can update its own object; other agency cannot", async () => {
    const path = objectPath(users.agencyA.id, `update-${Date.now()}.pdf`);
    const up = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    uploaded.push(path);

    const ownUpd = await users.agencyA.client.storage
      .from(BUCKET)
      .update(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(ownUpd.error).toBeNull();

    const otherUpd = await users.agencyB.client.storage
      .from(BUCKET)
      .update(path, PDF_BYTES, { contentType: "application/pdf" });
    expect(otherUpd.error).not.toBeNull();
  });

  it("agency can delete its own object; other agency cannot", async () => {
    const targetPath = objectPath(
      users.agencyA.id,
      `del-target-${Date.now()}.pdf`,
    );
    const seed1 = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(targetPath, PDF_BYTES, { contentType: "application/pdf" });
    expect(seed1.error).toBeNull();

    // AgencyB attempts delete — should fail (or return empty result).
    const bDel = await users.agencyB.client.storage
      .from(BUCKET)
      .remove([targetPath]);
    // The API returns success with data:[] when RLS filters the row away.
    expect(bDel.data ?? []).toHaveLength(0);

    // Owner deletes for real.
    const aDel = await users.agencyA.client.storage
      .from(BUCKET)
      .remove([targetPath]);
    expect(aDel.error).toBeNull();
    expect((aDel.data ?? []).length).toBeGreaterThan(0);
  });

  // -- MIME / size ------------------------------------------------------
  it("rejects non-PDF/JPG/PNG uploads", async () => {
    const path = `${users.agencyA.id}/bad-${Date.now()}.txt`;
    const { error } = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(path, new Uint8Array([0x68, 0x69]), { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });

  it("rejects uploads larger than 10 MB", async () => {
    const path = `${users.agencyA.id}/big-${Date.now()}.pdf`;
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1024); // 10 MB + 1 KB
    // Prefix with PDF magic so only the size check trips.
    oversized.set(PDF_BYTES, 0);
    const { error } = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(path, oversized, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });

  it("accepts JPG and PNG uploads from the owner", async () => {
    const jpg = `${users.agencyA.id}/photo-${Date.now()}.jpg`;
    const jpgRes = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(jpg, new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
        contentType: "image/jpeg",
      });
    expect(jpgRes.error).toBeNull();
    uploaded.push(jpg);

    const png = `${users.agencyA.id}/photo-${Date.now()}.png`;
    const pngRes = await users.agencyA.client.storage
      .from(BUCKET)
      .upload(png, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        contentType: "image/png",
      });
    expect(pngRes.error).toBeNull();
    uploaded.push(png);
  });
});
