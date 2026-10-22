import { describe, expect, it, vi } from "vitest";
import { listMySupportReports, submitMySupportReport } from "./supportReportService";
import type { SupportReportSubmission } from "../components/SupportReportDialog";

const row = { id: "ticket-1", category: "catalog", title: "Search issue", status: "open", created_at: "2026-10-23T00:00:00Z" };
const draft: SupportReportSubmission = {
  idempotencyKey: "00000000-0000-4000-8000-000000000311", category: "catalog",
  title: "Search issue", description: "The catalogue filter resets when I change pages.",
  locale: "en", routeKey: "games", appVersion: "0.1.0",
  diagnostics: { appVersion: "0.1.0", locale: "en", route: "games", browserFamily: "Firefox", osFamily: "Linux" },
};
function fakeClient(result: { data: unknown; error: { message: string; code?: string } | null }) {
  const single = vi.fn(async () => result);
  const limit = vi.fn(async () => result);
  const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
  const from = vi.fn(() => ({ insert, select: vi.fn(() => ({ order: vi.fn(() => ({ limit })) })) }));
  return { client: { from }, from, insert, single, limit };
}
describe("support report service", () => {
  it("submits only allowlisted report fields", async () => {
    const fake = fakeClient({ data: row, error: null });
    expect(await submitMySupportReport(fake.client, draft, "member-1", () => "member-1")).toEqual(row);
    expect(fake.insert).toHaveBeenCalledWith({
      idempotency_key: draft.idempotencyKey, category: "catalog", title: draft.title,
      description: draft.description, app_version: "0.1.0", locale: "en", route_key: "games",
      diagnostics: draft.diagnostics,
    });
  });
  it("rejects requests after the active member changes", async () => {
    const fake = fakeClient({ data: row, error: null });
    await expect(submitMySupportReport(fake.client, draft, "member-1", () => "member-2")).rejects.toThrow("session_changed");
    expect(fake.from).not.toHaveBeenCalled();
  });
  it("maps database rate limiting to a safe error code", async () => {
    const fake = fakeClient({ data: null, error: { message: "support_report_rate_limited", code: "P0001" } });
    await expect(submitMySupportReport(fake.client, draft, "member-1", () => "member-1")).rejects.toThrow("rate_limited");
  });
  it("loads only five recent reports", async () => {
    const fake = fakeClient({ data: [row], error: null });
    expect(await listMySupportReports(fake.client, "member-1", () => "member-1")).toEqual([row]);
    expect(fake.limit).toHaveBeenCalledWith(5);
  });
});
