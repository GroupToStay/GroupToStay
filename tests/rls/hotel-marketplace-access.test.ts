/**
 * RLS suite: hotel marketplace access.
 *
 * Verifies that hotels, room inventory, amenities, and hotel media are not
 * browsable as a directory. Access is limited to:
 *   - platform admins
 *   - the hotel owner
 *   - organizers tied to a hotel through their own RFQ/invitation/quote flow
 *
 * Requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or VITE variants), and
 * SUPABASE_SERVICE_ROLE_KEY. Without the service-role key the suite self-skips.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const skip = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY;
const d = skip ? describe.skip : describe;

type Kind = "agency" | "hotel" | "admin";
type TestUser = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
};

function freshClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

d("RLS: hotel marketplace access", () => {
  const admin = skip
    ? (null as unknown as SupabaseClient)
    : createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  const users: Record<"agency" | "hotelA" | "hotelB" | "admin", TestUser> = {} as never;
  const ids: {
    hotelA?: string;
    hotelB?: string;
    rfq?: string;
    amenity?: string;
    photoPath?: string;
  } = {};

  async function createUser(kind: Kind): Promise<TestUser> {
    const email = `rls-marketplace-${kind}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.test`;
    const password = "TestPass!" + Math.random().toString(36).slice(2, 10);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: kind === "agency" ? "organizer" : kind },
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");

    await admin.from("user_roles").delete().eq("user_id", data.user.id);
    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: data.user.id,
      role: kind === "agency" ? "organizer" : kind,
    });
    if (roleErr) throw roleErr;

    const client = freshClient();
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;

    return { id: data.user.id, email, password, client };
  }

  beforeAll(async () => {
    users.agency = await createUser("agency");
    users.hotelA = await createUser("hotel");
    users.hotelB = await createUser("hotel");
    users.admin = await createUser("admin");

    const suffix = Date.now();
    const { data: hotelA, error: hotelAErr } = await admin
      .from("hotels")
      .insert({
        owner_id: users.hotelA.id,
        name: `RLS Hotel A ${suffix}`,
        city: "Riyadh",
        country: "Saudi Arabia",
        star_rating: 5,
        status: "approved",
      })
      .select("id")
      .single();
    if (hotelAErr) throw hotelAErr;
    ids.hotelA = hotelA.id as string;

    const { data: hotelB, error: hotelBErr } = await admin
      .from("hotels")
      .insert({
        owner_id: users.hotelB.id,
        name: `RLS Hotel B ${suffix}`,
        city: "Jeddah",
        country: "Saudi Arabia",
        star_rating: 4,
        status: "approved",
      })
      .select("id")
      .single();
    if (hotelBErr) throw hotelBErr;
    ids.hotelB = hotelB.id as string;

    await admin.from("hotel_rooms").insert([
      { hotel_id: ids.hotelA, room_type: "Standard", capacity: 2, count_available: 10 },
      { hotel_id: ids.hotelB, room_type: "Standard", capacity: 2, count_available: 20 },
    ]);

    const { data: amenity, error: amenityErr } = await admin
      .from("amenities")
      .insert({ name_en: `RLS Amenity ${suffix}`, name_ar: `RLS ${suffix}` })
      .select("id")
      .single();
    if (amenityErr) throw amenityErr;
    ids.amenity = amenity.id as string;

    await admin.from("hotel_amenities").insert([
      { hotel_id: ids.hotelA, amenity_id: ids.amenity },
      { hotel_id: ids.hotelB, amenity_id: ids.amenity },
    ]);

    const { data: rfq, error: rfqErr } = await admin
      .from("rfqs")
      .insert({
        organizer_id: users.agency.id,
        title: `RLS RFQ ${suffix}`,
        destination_city: "Riyadh",
        destination_country: "Saudi Arabia",
        check_in: "2027-01-10",
        check_out: "2027-01-12",
        guests_count: 20,
        rooms_needed: 10,
        currency: "USD",
        status: "open",
      })
      .select("id")
      .single();
    if (rfqErr) throw rfqErr;
    ids.rfq = rfq.id as string;

    const { error: inviteErr } = await admin
      .from("rfq_invitations")
      .insert({ rfq_id: ids.rfq, hotel_id: ids.hotelA });
    if (inviteErr) throw inviteErr;

    ids.photoPath = `${users.hotelA.id}/${ids.hotelA}/rls-photo-${suffix}.jpg`;
    await admin.storage
      .from("hotel-photos")
      .upload(ids.photoPath, new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
        contentType: "image/jpeg",
        upsert: true,
      });
  });

  afterAll(async () => {
    if (ids.photoPath) await admin.storage.from("hotel-photos").remove([ids.photoPath]);
    if (ids.rfq) await admin.from("rfqs").delete().eq("id", ids.rfq);
    if (ids.hotelA || ids.hotelB)
      await admin.from("hotels").delete().in("id", [ids.hotelA, ids.hotelB]);
    if (ids.amenity) await admin.from("amenities").delete().eq("id", ids.amenity);

    for (const user of Object.values(users)) {
      if (user?.id) await admin.auth.admin.deleteUser(user.id);
    }
  });

  it("anonymous users cannot browse hotel data", async () => {
    const anon = freshClient();

    const hotels = await anon.from("hotels").select("id").limit(1);
    const rooms = await anon.from("hotel_rooms").select("id").limit(1);
    const amenities = await anon.from("hotel_amenities").select("hotel_id").limit(1);

    expect(hotels.error || (hotels.data ?? []).length === 0).toBeTruthy();
    expect(rooms.error || (rooms.data ?? []).length === 0).toBeTruthy();
    expect(amenities.error || (amenities.data ?? []).length === 0).toBeTruthy();
  });

  it("agencies see only hotels tied to their own RFQ relationship", async () => {
    const { data, error } = await users.agency.client.from("hotels").select("id").order("id");
    expect(error).toBeNull();
    const visible = new Set((data ?? []).map((row: any) => row.id));
    expect(visible.has(ids.hotelA)).toBe(true);
    expect(visible.has(ids.hotelB)).toBe(false);
  });

  it("hotel accounts see only their own hotel and inventory", async () => {
    const hotels = await users.hotelA.client.from("hotels").select("id").order("id");
    expect(hotels.error).toBeNull();
    const visibleHotels = new Set((hotels.data ?? []).map((row: any) => row.id));
    expect(visibleHotels.has(ids.hotelA)).toBe(true);
    expect(visibleHotels.has(ids.hotelB)).toBe(false);

    const rooms = await users.hotelA.client
      .from("hotel_rooms")
      .select("hotel_id")
      .order("hotel_id");
    expect(rooms.error).toBeNull();
    const visibleRoomHotels = new Set((rooms.data ?? []).map((row: any) => row.hotel_id));
    expect(visibleRoomHotels.has(ids.hotelA)).toBe(true);
    expect(visibleRoomHotels.has(ids.hotelB)).toBe(false);
  });

  it("admins can review all hotel records", async () => {
    const { data, error } = await users.admin.client.from("hotels").select("id").order("id");
    expect(error).toBeNull();
    const visible = new Set((data ?? []).map((row: any) => row.id));
    expect(visible.has(ids.hotelA)).toBe(true);
    expect(visible.has(ids.hotelB)).toBe(true);
  });

  it("hotel photos require scoped authenticated access", async () => {
    const anon = freshClient();
    const anonSignedUrl = await anon.storage
      .from("hotel-photos")
      .createSignedUrl(ids.photoPath!, 60);
    expect(anonSignedUrl.error).not.toBeNull();

    const ownerSignedUrl = await users.hotelA.client.storage
      .from("hotel-photos")
      .createSignedUrl(ids.photoPath!, 60);
    expect(ownerSignedUrl.error).toBeNull();

    const otherHotelSignedUrl = await users.hotelB.client.storage
      .from("hotel-photos")
      .createSignedUrl(ids.photoPath!, 60);
    expect(otherHotelSignedUrl.error).not.toBeNull();
  });
});
