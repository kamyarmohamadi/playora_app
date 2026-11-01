import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { FinanceAdminPanel } from "./FinanceAdminPanel";

describe("FinanceAdminPanel", () => {
  it("maps the finance endpoint dashboard contract and loads owner identities", async () => {
    const invoke = vi.fn(async (_functionName: string, { body }: { body: { action: string } }) => {
      const { action } = body;
      if (action === "check_access") {
        return { data: { ok: true, result: { role: "owner" } }, error: null };
      }
      if (action === "dashboard") {
        return {
          data: {
            ok: true,
            result: {
              deposits: [{
                id: "deposit-1", user_id: "member-1", asset_code: "BTC",
                network_code: "BTC", expected_amount: "0.01", tx_hash: "deposit-hash-123456",
                status: "under_review", coin_amount: 100, created_at: "2026-10-31T00:00:00.000Z",
              }],
              duplicateAttempts: [{
                id: "duplicate-1", duplicate_request_id: "duplicate-request",
                first_request_id: "first-request", attempted_at: "2026-10-31T00:01:00.000Z",
              }],
              withdrawals: [{
                id: "withdrawal-1", user_id: "member-2", asset_code: "BTC",
                network_code: "BTC", requested_coins: 500, destination_address: "bc1-example-address",
                net_asset_amount: "0.004", status: "pending", created_at: "2026-10-31T00:02:00.000Z",
              }],
              payoutAddresses: [],
              memberVerifications: [],
              depositNetworks: [],
              withdrawalNetworks: [],
            },
          },
          error: null,
        };
      }
      if (action === "list_admins") {
        return { data: { ok: true, result: [] }, error: null };
      }
      return { data: { ok: true, result: {} }, error: null };
    });
    const database = { functions: { invoke } } as unknown as SupabaseClient<any>;

    render(<FinanceAdminPanel database={database} locale="en" />);

    expect(await screen.findByText(/BTC · BTC · 0.01/)).toBeInTheDocument();
    expect(screen.getByText("duplicate-request")).toBeInTheDocument();
    expect(screen.getByText(/500 Coins/)).toBeInTheDocument();
    expect(screen.getByText("No admin identities seeded.")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("admin-finance", { body: { action: "list_admins" } });
  });

  it("submits a deposit review through the privileged endpoint", async () => {
    const invoke = vi.fn(async (_functionName: string, { body }: { body: { action: string } }) => {
      const { action } = body;
      if (action === "check_access") {
        return { data: { ok: true, result: { role: "finance_admin" } }, error: null };
      }
      if (action === "dashboard") {
        return {
          data: {
            ok: true,
            result: {
              deposits: [{
                id: "deposit-2", user_id: "member-2", asset_code: "ETH",
                network_code: "ETH", expected_amount: "0.2", tx_hash: "deposit-hash-abcdef",
                status: "under_review", coin_amount: 200, created_at: "2026-10-31T00:00:00.000Z",
              }],
              duplicateAttempts: [], withdrawals: [], payoutAddresses: [],
              memberVerifications: [], depositNetworks: [], withdrawalNetworks: [],
            },
          },
          error: null,
        };
      }
      return { data: { ok: true, result: {} }, error: null };
    });
    const database = { functions: { invoke } } as unknown as SupabaseClient<any>;

    render(<FinanceAdminPanel database={database} locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve and credit" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("admin-finance", { body: {
        action: "review_deposit", request_id: "deposit-2", approve: true, note: "",
      }});
    });
  });
});
