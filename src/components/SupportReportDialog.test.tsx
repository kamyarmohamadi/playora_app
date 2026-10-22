import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { SupportReportDialog, type SupportReportSummary, type SupportReportSubmission } from "./SupportReportDialog";

const translations: Record<string, string> = {
  help: "Help & support", supportEyebrow: "PLAYORA SUPPORT",
  supportSubtitle: "Send a report to the Playora team.",
  supportSignInRequired: "Sign in to submit and track a support report.",
  signIn: "Sign in", cancel: "Cancel",
  supportDiagnosticsNotice: "Only app version, language, page key and coarse browser/OS families are sent.",
  supportReportSubmitted: "Your report was submitted.",
  supportCategory: "Category", supportCategoryBug: "Bug report",
  supportCategoryAccount: "Account", supportCategoryCatalog: "Game catalogue",
  supportCategoryAccessibility: "Accessibility", supportCategoryOther: "Other",
  supportReportTitle: "Title", supportTitlePlaceholder: "Summarize what happened",
  supportReportDescription: "What happened?", supportDescriptionPlaceholder: "Describe the steps and what you expected.",
  supportSubmitReport: "Submit report", supportMyReports: "My reports",
  supportHistoryUnavailable: "Report history is temporarily unavailable.",
  supportNoReports: "You have not submitted any reports yet.",
  supportStatusOpen: "Open", supportStatusTriaged: "Triaged",
  supportStatusInProgress: "In progress", supportStatusResolved: "Resolved", supportStatusClosed: "Closed",
  supportReportInvalid: "Please review the report fields.",
  supportReportInvalidCategory: "Choose a category.",
  supportReportInvalidTitle: "Enter a title between 5 and 120 characters.",
  supportReportInvalidDescription: "Enter a description between 20 and 4000 characters.",
  supportReportRateLimited: "You have submitted too many reports. Please try again later.",
  supportReportSessionChanged: "Your session changed. Please try again.",
  supportSecureContextRequired: "Secure browser context is required to submit a report.",
  supportReportFailed: "Your report could not be submitted. Please retry.",
  loading: "Loading…",
};
const t = (key: string) => translations[key] ?? key;
const createdReport: SupportReportSummary = {
  id: "ticket-1", category: "bug", title: "Search filter resets", status: "open",
  created_at: "2026-10-23T10:00:00.000Z",
};

function renderDialog(overrides: Partial<ComponentProps<typeof SupportReportDialog>> = {}) {
  const onClose = vi.fn();
  const onSignIn = vi.fn();
  const onSubmit = vi.fn(async (_submission: SupportReportSubmission) => createdReport);
  const props: ComponentProps<typeof SupportReportDialog> = {
    open: true, backendReady: true, locale: "en", routeKey: "games", isSignedIn: true, recentReports: [],
    t, onClose, onSignIn, onSubmit, ...overrides,
  };
  render(<SupportReportDialog {...props} />);
  return { onClose, onSignIn, onSubmit };
}
afterEach(() => vi.unstubAllGlobals());

describe("SupportReportDialog", () => {
  it("fails closed when the support backend is not enabled", () => {
    const { onSubmit } = renderDialog({ backendReady: false });
    expect(screen.getByRole("status")).toHaveTextContent(/not connected yet/i);
    expect(screen.queryByRole("button", { name: "Submit report" })).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires sign-in before creating a persistent report", () => {
    const { onSubmit, onSignIn } = renderDialog({ isSignedIn: false });
    expect(screen.getByText("Sign in to submit and track a support report.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits validated fields with minimized diagnostics and a stable idempotency key", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000311" });
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "catalog" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Search filter resets" } });
    fireEvent.change(screen.getByLabelText(/What happened\?/i), { target: { value: "The filter disappears when I return to the catalogue page." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).toMatchObject({
      idempotencyKey: "00000000-0000-4000-8000-000000000311",
      category: "catalog", title: "Search filter resets", locale: "en",
      routeKey: "games", appVersion: "0.1.0",
      diagnostics: { appVersion: "0.1.0", locale: "en", route: "games" },
    });
    expect(Object.keys(submitted.diagnostics).sort()).toEqual(["appVersion","browserFamily","locale","osFamily","route"]);
    expect(await screen.findByRole("status")).toHaveTextContent("Your report was submitted.");
  });

  it("does not call the backend for invalid text", async () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "bad" } });
    fireEvent.change(screen.getByLabelText(/What happened\?/i), { target: { value: "too short" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
  });

  it("shows a capped recent-report list and its current server-owned status", () => {
    const reports = Array.from({ length: 7 }, (_, index) => ({
      ...createdReport, id: "ticket-" + index, title: "Report " + index,
    }));
    renderDialog({ recentReports: reports });
    expect(screen.getByText("My reports")).toBeInTheDocument();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("shows a specific rate-limit message and retains the idempotency key for retries", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000311" });
    const onSubmit = vi.fn(async (_submission: SupportReportSubmission) => createdReport)
      .mockRejectedValueOnce(new Error("rate_limited"))
      .mockResolvedValueOnce(createdReport);
    renderDialog({ onSubmit });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Search filter resets" } });
    fireEvent.change(screen.getByLabelText(/What happened\?/i), { target: { value: "The filter disappears when I return to the catalogue page." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many reports/i);
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[0][0].idempotencyKey).toBe(onSubmit.mock.calls[1][0].idempotencyKey);
  });
});
