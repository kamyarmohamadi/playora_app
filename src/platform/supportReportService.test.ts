import { describe, expect, it, vi } from "vitest";
import { listMySupportReports, submitMySupportReport } from "./supportReportService";
import type { SupportReportSubmission } from "../components/SupportReportDialog";

const row = {
  id: "ticket-1",
  category: "catalog",
  title: "Search issue",
  status: "open",
  created_at: "2026-10-23T00:00:00Z",
};
const draft: SupportReportSubmission = {
  idempotencyKey: "00000000-0000-4000-8000-000000000311",
  category: "catalog",
  title: "Search issue",
  description: "The catalogue filter resets when I change pages.",
  locale: "en",
  routeKey: "games",
  appVersion: "0.1.0",
  diagnostics: {
    appVersion: "0.1.0",
    locale: "en",
    route: "games",
    browserFamily: "Firefox",
    osFamily: "Linux",
  },
};

type FakeResult = { data: unknown; error: { message: string; code?: string } | null };
interface FakeOptions {
  defaultResult?: FakeResult;
  listResult?: FakeResult;
  insertResult?: FakeResult;
  retryResult?: FakeResult;
}
function fakeClient(options: FakeOptions = {}) {
  const defaultResult = options.defaultResult ?? { data: row, error: null };
  const selectCalls: Array<{ columns: string; filters: Array<[string, string]> }> = [];
  const insert = vi.fn((payload: Record<string, unknown>) => payload);
  const from = vi.fn(() => ({
    select: vi.fn((columns: string) => {
      const filters: Array<[string, string]> = [];
      const builder: any = {
        eq: vi.fn((column: string, value: string) => {
          filters.push([column, value]);
          return builder;
        }),
        order: vi.fn(() => builder),
        limit: vi.fn(async () => options.listResult ?? defaultResult),
        maybeSingle: vi.fn(async () => options.retryResult ?? defaultResult),
      };
      selectCalls.push({ columns, filters });
      return builder;
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      insert(payload);
      return {
        select: vi.fn((_columns: string) => ({
          single: vi.fn(async () => options.insertResult ?? defaultResult),
        })),
      };
    }),
  }));
  return { client: { from }, from, insert, selectCalls };
}

describe("support report service", () => {
  it("submits only allowlisted report fields", async () => {
    const fake = fakeClient({ insertResult: { data: row, error: null } });
    expect(await submitMySupportReport(fake.client, draft, "member-1", () => "member-1")).toEqual(row);
    expect(fake.insert).toHaveBeenCalledWith({
      idempotency_key: draft.idempotencyKey,
      category: "catalog",
      title: draft.title,
      description: draft.description,
      app_version: "0.1.0",
      locale: "en",
      route_key: "games",
      diagnostics: draft.diagnostics,
    });
  });

  it("rejects requests after the active member changes", async () => {
    const fake = fakeClient({ insertResult: { data: row, error: null } });
    await expect(submitMySupportReport(fake.client, draft, "member-1", () => "member-2"))
      .rejects.toThrow("session_changed");
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("maps database rate limiting to a safe error code", async () => {
    const fake = fakeClient({ insertResult: { data: null, error: { message: "support_report_rate_limited", code: "P0001" } } });
    await expect(submitMySupportReport(fake.client, draft, "member-1", () => "member-1"))
      .rejects.toThrow("rate_limited");
  });

  it("scopes report history to the current member and limits the result to five", async () => {
    const fake = fakeClient({ listResult: { data: [row], error: null } });
    expect(await listMySupportReports(fake.client, "member-1", () => "member-1")).toEqual([row]);
    expect(fake.selectCalls[0].filters).toContainEqual(["user_id", "member-1"]);
  });

  it("returns the original ticket when a network retry hits the idempotency constraint", async () => {
    const fake = fakeClient({
      insertResult: { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } },
      retryResult: { data: row, error: null },
    });
    expect(await submitMySupportReport(fake.client, draft, "member-1", () => "member-1")).toEqual(row);
    expect(fake.from).toHaveBeenCalledTimes(2);
    expect(fake.selectCalls[0].filters).toContainEqual(["user_id", "member-1"]);
    expect(fake.selectCalls[0].filters).toContainEqual(["idempotency_key", draft.idempotencyKey]);
  });
});
