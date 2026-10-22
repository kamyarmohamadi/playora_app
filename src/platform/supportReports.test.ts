import { describe, expect, it } from "vitest";
import {
  collectSafeSupportDiagnostics,
  normalizeSupportReportDraft,
  SupportReportValidationError,
} from "./supportReports";

const validDraft = () => ({
  category: "bug",
  title: "Search filter resets",
  description: "The game catalogue loses my selected filter after I return from another page.",
  locale: "en",
  routeKey: "games",
});

describe("support report sanitization", () => {
  it("normalizes report text and accepts a valid bilingual-platform route", () => {
    expect(normalizeSupportReportDraft({
      ...validDraft(),
      title: "  Search\t filter   resets  ",
      description: "  The filter resets.\r\n\r\nI have to select it again.  ",
    })).toEqual({
      category: "bug",
      title: "Search filter resets",
      description: "The filter resets.\n\nI have to select it again.",
      locale: "en",
      routeKey: "games",
    });
  });

  it("rejects categories and routes outside the allowlists", () => {
    expect(() => normalizeSupportReportDraft({ ...validDraft(), category: "security_audit" }))
      .toThrowError(SupportReportValidationError);
    expect(() => normalizeSupportReportDraft({ ...validDraft(), routeKey: "../../account?token=secret" }))
      .toThrowError(SupportReportValidationError);
  });

  it("rejects payload keys intended to smuggle user IDs, statuses, or diagnostics", () => {
    expect(() => normalizeSupportReportDraft({ ...validDraft(), user_id: "another-member" }))
      .toThrowError(SupportReportValidationError);
    expect(() => normalizeSupportReportDraft({ ...validDraft(), status: "resolved" }))
      .toThrowError(SupportReportValidationError);
  });

  it("enforces title and description length bounds after normalizing input", () => {
    expect(() => normalizeSupportReportDraft({ ...validDraft(), title: "bad" }))
      .toThrowError(/title/i);
    expect(() => normalizeSupportReportDraft({ ...validDraft(), title: "x".repeat(121) }))
      .toThrowError(/title/i);
    expect(() => normalizeSupportReportDraft({ ...validDraft(), description: "too short" }))
      .toThrowError(/description/i);
    expect(() => normalizeSupportReportDraft({ ...validDraft(), description: "x".repeat(4001) }))
      .toThrowError(/description/i);
  });

  it("strips control characters without destroying useful multiline descriptions", () => {
    const result = normalizeSupportReportDraft({
      ...validDraft(),
      description: "The view freezes.\u0000\u0007\nI can reproduce it every time.",
    });
    expect(result.description).toBe("The view freezes.\nI can reproduce it every time.");
  });
});

describe("safe support diagnostics", () => {
  it("records coarse browser/OS families but never stores a raw user-agent or URL", () => {
    const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36";
    const diagnostics = collectSafeSupportDiagnostics(userAgent, "fa", "settings");
    expect(diagnostics).toEqual({
      appVersion: "0.1.0",
      locale: "fa",
      route: "settings",
      browserFamily: "Chrome",
      osFamily: "Linux",
    });
    expect(JSON.stringify(diagnostics)).not.toContain(userAgent);
    expect(JSON.stringify(diagnostics)).not.toContain("token=");
  });

  it("prioritizes Edge over the Chromium token and recognizes mobile operating systems", () => {
    expect(collectSafeSupportDiagnostics("Mozilla Chrome/120 Edg/120", "en", "home").browserFamily).toBe("Edge");
    expect(collectSafeSupportDiagnostics("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", "en", "home").osFamily).toBe("iOS");
    expect(collectSafeSupportDiagnostics("Android 14 Chrome/120", "en", "home").osFamily).toBe("Android");
  });
});
