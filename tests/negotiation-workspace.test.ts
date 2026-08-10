import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  classifyDealWorkspaceError,
  getDealActions,
  getOfferActions,
  getOfferSubmittingSide,
  groupOfferHistory,
  isDealId,
  isLatestOfferVersion,
  resolveDealWorkspaceActor,
  selectCommercialOffer,
  type DealRow,
  type MembershipRow,
  type OfferRow,
} from "../src/features/deals/deal-workspace-model";
import {
  executeCounterOffer,
  executeDealWorkspaceAction,
} from "../src/features/deals/deal-workspace-service";

const deal: DealRow = {
  id: "10000000-0000-4000-8000-000000000001",
  buyer_organization_id: "20000000-0000-4000-8000-000000000001",
  supplier_organization_id: "30000000-0000-4000-8000-000000000001",
  source_rfq_id: null,
  source_invitation_id: null,
  source_hotel_id: null,
  status: "active",
  created_by: null,
  created_at: "2026-08-10T08:00:00.000Z",
  updated_at: "2026-08-10T08:00:00.000Z",
};

const submittedOffer: OfferRow = {
  id: "40000000-0000-4000-8000-000000000001",
  deal_id: deal.id,
  supplier_organization_id: deal.supplier_organization_id,
  offer_thread_id: "50000000-0000-4000-8000-000000000001",
  version_number: 1,
  submitted_by_organization_id: deal.supplier_organization_id,
  parent_offer_id: null,
  amount: 125000,
  currency: "SAR",
  valid_until: "2026-08-20T08:00:00.000Z",
  notes: "Breakfast included",
  status: "submitted",
  created_by: null,
  created_at: "2026-08-10T09:00:00.000Z",
  updated_at: "2026-08-10T09:00:00.000Z",
};

function membership(
  organizationId: string,
  role: MembershipRow["membership_role"],
  status: MembershipRow["status"] = "active",
): MembershipRow {
  return { organization_id: organizationId, membership_role: role, status };
}

describe("Negotiation Workspace v1", () => {
  it("validates deep-link Deal identifiers before querying", () => {
    expect(isDealId(deal.id)).toBe(true);
    expect(isDealId("not-a-deal")).toBe(false);
    expect(isDealId("10000000-0000-0000-0000-000000000001")).toBe(false);
  });

  it("derives buyer, supplier, inactive and inspection contexts fail-closed", () => {
    expect(
      resolveDealWorkspaceActor(deal, [membership(deal.buyer_organization_id, "agent")]),
    ).toEqual({ side: "buyer", role: "agent", isActive: true });
    expect(
      resolveDealWorkspaceActor(deal, [membership(deal.supplier_organization_id, "sales")]),
    ).toEqual({ side: "supplier", role: "sales", isActive: true });
    expect(
      resolveDealWorkspaceActor(deal, [
        membership(deal.buyer_organization_id, "owner", "suspended"),
      ]),
    ).toEqual({ side: "inspector", role: null, isActive: false });
    expect(resolveDealWorkspaceActor(deal, [])).toEqual({
      side: "inspector",
      role: null,
      isActive: false,
    });
    expect(
      resolveDealWorkspaceActor(deal, [
        membership(deal.buyer_organization_id, "owner"),
        membership(deal.supplier_organization_id, "owner"),
      ]),
    ).toEqual({ side: "inspector", role: null, isActive: false });
  });

  it("shows only canonical buyer and supplier commands", () => {
    const buyer = resolveDealWorkspaceActor(deal, [
      membership(deal.buyer_organization_id, "owner"),
    ]);
    const supplier = resolveDealWorkspaceActor(deal, [
      membership(deal.supplier_organization_id, "sales"),
    ]);

    expect(getOfferActions(deal, submittedOffer, buyer, new Date("2026-08-11"))).toEqual([
      "accept",
      "reject",
      "counter",
    ]);
    expect(getOfferActions(deal, submittedOffer, supplier, new Date("2026-08-11"))).toEqual([
      "withdraw",
    ]);
    expect(getDealActions(deal, buyer)).toEqual(["cancel"]);
    expect(getDealActions({ ...deal, status: "agreed" }, buyer)).toEqual(["close"]);
    expect(getDealActions({ ...deal, status: "closed" }, buyer)).toEqual([]);
    expect(getDealActions({ ...deal, status: "cancelled" }, buyer)).toEqual([]);
    expect(getDealActions(deal, supplier)).toEqual([]);
  });

  it("alternates counteroffer authority using immutable submitter identity", () => {
    const buyer = resolveDealWorkspaceActor(deal, [
      membership(deal.buyer_organization_id, "agent"),
    ]);
    const supplier = resolveDealWorkspaceActor(deal, [
      membership(deal.supplier_organization_id, "reservations"),
    ]);
    const agencyCounter: OfferRow = {
      ...submittedOffer,
      id: "40000000-0000-4000-8000-000000000002",
      parent_offer_id: submittedOffer.id,
      version_number: 2,
      submitted_by_organization_id: deal.buyer_organization_id,
      amount: 120000,
      created_at: "2026-08-10T10:00:00.000Z",
      updated_at: "2026-08-10T10:00:00.000Z",
    };
    const history = [{ ...submittedOffer, status: "superseded" as const }, agencyCounter];

    expect(getOfferSubmittingSide(deal, submittedOffer)).toBe("supplier");
    expect(getOfferSubmittingSide(deal, agencyCounter)).toBe("buyer");
    expect(isLatestOfferVersion(submittedOffer, history)).toBe(false);
    expect(isLatestOfferVersion(agencyCounter, history)).toBe(true);
    expect(getOfferActions(deal, history[0], buyer, new Date("2026-08-11"), history)).toEqual([]);
    expect(getOfferActions(deal, agencyCounter, buyer, new Date("2026-08-11"), history)).toEqual(
      [],
    );
    expect(getOfferActions(deal, agencyCounter, supplier, new Date("2026-08-11"), history)).toEqual(
      ["reject", "counter"],
    );
  });

  it("handles expired and terminal Offers without reopening them", () => {
    const buyer = resolveDealWorkspaceActor(deal, [
      membership(deal.buyer_organization_id, "admin"),
    ]);
    expect(getOfferActions(deal, submittedOffer, buyer, new Date("2026-08-21"))).toEqual([
      "reject",
      "expire",
    ]);

    for (const status of ["accepted", "rejected", "withdrawn", "expired", "superseded"] as const) {
      expect(getOfferActions(deal, { ...submittedOffer, status }, buyer)).toEqual([]);
    }
    expect(getOfferActions({ ...deal, status: "agreed" }, submittedOffer, buyer)).toEqual([]);
  });

  it("groups immutable Offer Versions by thread in sequence order", () => {
    const laterVersion: OfferRow = {
      ...submittedOffer,
      id: "40000000-0000-4000-8000-000000000002",
      parent_offer_id: submittedOffer.id,
      version_number: 2,
      submitted_by_organization_id: deal.buyer_organization_id,
      created_at: "2026-08-10T10:00:00.000Z",
      updated_at: "2026-08-10T10:00:00.000Z",
    };
    const otherThread: OfferRow = {
      ...submittedOffer,
      id: "40000000-0000-4000-8000-000000000003",
      offer_thread_id: "50000000-0000-4000-8000-000000000002",
      created_at: "2026-08-10T11:00:00.000Z",
      updated_at: "2026-08-10T11:00:00.000Z",
    };

    expect(groupOfferHistory([laterVersion, otherThread, submittedOffer])).toEqual([
      { id: submittedOffer.offer_thread_id, offers: [submittedOffer, laterVersion] },
      { id: otherThread.offer_thread_id, offers: [otherThread] },
    ]);
  });

  it("selects accepted or current commercial terms while preserving empty history", () => {
    const rejected = { ...submittedOffer, id: crypto.randomUUID(), status: "rejected" as const };
    const accepted = { ...submittedOffer, id: crypto.randomUUID(), status: "accepted" as const };
    expect(selectCommercialOffer([rejected, submittedOffer])).toBe(submittedOffer);
    expect(selectCommercialOffer([rejected, accepted, submittedOffer])).toBe(accepted);
    expect(selectCommercialOffer([])).toBeNull();
  });

  it("maps database and concurrency failures to safe UI states", () => {
    expect(classifyDealWorkspaceError({ code: "PGRST205" })).toBe("backend_unavailable");
    expect(classifyDealWorkspaceError({ code: "42501" })).toBe("permission");
    expect(classifyDealWorkspaceError({ code: "40001" })).toBe("stale");
    expect(classifyDealWorkspaceError({ code: "55000" })).toBe("state_changed");
    expect(classifyDealWorkspaceError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyDealWorkspaceError(new Error("Internal database detail"))).toBe("unknown");
  });

  it("uses RLS reads and Feature 3 RPCs as the only mutation boundary", () => {
    const service = readFileSync(resolve("src/features/deals/deal-workspace-service.ts"), "utf8");
    for (const rpc of [
      "accept_deal_offer",
      "reject_deal_offer",
      "withdraw_deal_offer",
      "expire_deal_offer",
      "cancel_deal",
      "close_deal",
      "counter_deal_offer",
    ]) {
      expect(service).toContain(`"${rpc}"`);
    }
    expect(service).toContain("supabase.rpc(rpc, args as never)");
    expect(service).not.toMatch(/\.from\(["'](?:deals|offers)["']\)\s*\.update/u);
    expect(service).not.toMatch(/\.from\(["'](?:deals|offers)["']\)\s*\.delete/u);
  });

  it("submits counteroffers only through the canonical structured command", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: { offer_id: crypto.randomUUID(), version_number: 2 },
      error: null,
    });
    const input = {
      parentOfferId: submittedOffer.id,
      amount: 120000,
      currency: "SAR",
      validUntil: "2026-08-22T08:00:00.000Z",
      notes: "Revised commercial terms",
    };

    await expect(executeCounterOffer(input, rpcMock)).resolves.toMatchObject({ version_number: 2 });
    expect(rpcMock).toHaveBeenCalledWith({
      _parent_offer_id: submittedOffer.id,
      _amount: 120000,
      _currency: "SAR",
      _valid_until: "2026-08-22T08:00:00.000Z",
      _notes: "Revised commercial terms",
    });
  });

  it("dispatches every lifecycle command to its canonical Feature 3 RPC", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: { status: "ok" }, error: null });
    const targetId = submittedOffer.id;
    const commands = [
      ["accept", "accept_deal_offer", "_offer_id"],
      ["reject", "reject_deal_offer", "_offer_id"],
      ["withdraw", "withdraw_deal_offer", "_offer_id"],
      ["expire", "expire_deal_offer", "_offer_id"],
      ["cancel", "cancel_deal", "_deal_id"],
      ["close", "close_deal", "_deal_id"],
    ] as const;

    for (const [action, rpc, argument] of commands) {
      rpcMock.mockClear();
      await expect(executeDealWorkspaceAction(action, targetId, rpcMock)).resolves.toEqual({
        status: "ok",
      });
      expect(rpcMock).toHaveBeenCalledOnce();
      expect(rpcMock).toHaveBeenCalledWith(rpc, { [argument]: targetId });
    }
  });

  it("preserves authoritative RPC failures for safe stale-state handling", async () => {
    const concurrentChange = { code: "40001", message: "Offer state changed concurrently" };
    const rpcMock = vi.fn().mockResolvedValueOnce({ data: null, error: concurrentChange });

    await expect(executeDealWorkspaceAction("accept", submittedOffer.id, rpcMock)).rejects.toBe(
      concurrentChange,
    );
  });

  it("keeps the route lazy, authenticated, accessible and out of global navigation", () => {
    const route = readFileSync(resolve("src/routes/_authenticated/deals.$dealId.tsx"), "utf8");
    const workspace = readFileSync(resolve("src/features/deals/NegotiationWorkspace.tsx"), "utf8");
    const authLayout = readFileSync(resolve("src/routes/_authenticated/route.tsx"), "utf8");

    expect(route).toContain('createFileRoute("/_authenticated/deals/$dealId")');
    expect(route).toContain("isDealId(dealId)");
    expect(workspace).toContain('aria-live="polite"');
    expect(workspace).toContain("AlertDialog");
    expect(workspace).toContain("CounterOfferDialog");
    expect(workspace).toContain('type="submit"');
    expect(workspace).toContain("event.preventDefault()");
    expect(workspace).toContain("min-h-11");
    expect(workspace).toContain("motion-reduce:animate-none");
    expect(workspace).toContain("actionMutation.isPending");
    expect(workspace).toContain("disabled={pending}");
    expect(workspace).toContain("await queryClient.invalidateQueries");
    expect(workspace).toContain('kind === "stale" || kind === "state_changed"');
    expect(authLayout).not.toContain('to: "/deals');
  });

  it("keeps English and Arabic Deal catalogs structurally identical", () => {
    const english = JSON.parse(readFileSync(resolve("src/locales/en/deals.json"), "utf8"));
    const arabic = JSON.parse(readFileSync(resolve("src/locales/ar/deals.json"), "utf8"));

    function keys(value: unknown, prefix = ""): string[] {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
      return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        keys(child, prefix ? `${prefix}.${key}` : key),
      );
    }

    expect(keys(arabic).sort()).toEqual(keys(english).sort());
  });
});
