import type { SupportReportSubmission, SupportReportSummary, SupportReportStatus } from "../components/SupportReportDialog";
import type { SupportReportCategory } from "./supportReports";

type DbError = { message: string; code?: string };
type QueryResult<T> = { data: T | null; error: DbError | null };
type SupportClient = {
  from: (table: "support_reports") => {
    select: (columns: string) => {
      order: (column: "created_at", options: { ascending: boolean }) => {
        limit: (count: number) => Promise<QueryResult<unknown[]>>;
      };
    };
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => { single: () => Promise<QueryResult<unknown>> };
    };
  };
};
const categories = new Set<SupportReportCategory>(["bug","account","catalog","accessibility","other"]);
const statuses = new Set<SupportReportStatus>(["open","triaged","in_progress","resolved","closed"]);
const columns = "id,category,title,status,created_at";

function assertMember(expected: string, current: () => string | null) {
  if (!expected || current() !== expected) throw new Error("session_changed");
}
function parseSummary(value: unknown): SupportReportSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_report_response");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.created_at !== "string" ||
      typeof row.category !== "string" || !categories.has(row.category as SupportReportCategory) ||
      typeof row.status !== "string" || !statuses.has(row.status as SupportReportStatus)) {
    throw new Error("invalid_report_response");
  }
  return { id: row.id, category: row.category as SupportReportCategory, title: row.title,
    status: row.status as SupportReportStatus, created_at: row.created_at };
}

/** Adapter for a pending migration. Generated types stay a snapshot of the live schema until deployment. */
export async function listMySupportReports(client: unknown, expectedUserId: string,
  getCurrentUserId: () => string | null): Promise<SupportReportSummary[]> {
  assertMember(expectedUserId, getCurrentUserId);
  const db = client as SupportClient;
  const { data, error } = await db.from("support_reports").select(columns)
    .order("created_at", { ascending: false }).limit(5);
  assertMember(expectedUserId, getCurrentUserId);
  if (error) throw new Error("reports_unavailable");
  if (!Array.isArray(data)) throw new Error("invalid_report_response");
  return data.map(parseSummary);
}

export async function submitMySupportReport(client: unknown, report: SupportReportSubmission,
  expectedUserId: string, getCurrentUserId: () => string | null): Promise<SupportReportSummary> {
  assertMember(expectedUserId, getCurrentUserId);
  const db = client as SupportClient;
  const { data, error } = await db.from("support_reports").insert({
    idempotency_key: report.idempotencyKey, category: report.category, title: report.title,
    description: report.description, app_version: report.appVersion, locale: report.locale,
    route_key: report.routeKey, diagnostics: report.diagnostics as unknown as Record<string, unknown>,
  }).select(columns).single();
  if (error) {
    if (error.code === "P0001" || error.message.includes("support_report_rate_limited")) throw new Error("rate_limited");
    throw new Error("submit_failed");
  }
  assertMember(expectedUserId, getCurrentUserId);
  return parseSummary(data);
}
