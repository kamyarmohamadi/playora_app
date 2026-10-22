export const SUPPORT_REPORT_CATEGORIES = [
  "bug",
  "account",
  "catalog",
  "accessibility",
  "other",
] as const;

export type SupportReportCategory = typeof SUPPORT_REPORT_CATEGORIES[number];
export type SupportLocale = "en" | "fa";
export type SupportRoute =
  | "home" | "games" | "online" | "tournaments" | "friends"
  | "rooms" | "leaderboard" | "wallet" | "profile" | "settings";

export const SUPPORT_ROUTES: readonly SupportRoute[] = [
  "home", "games", "online", "tournaments", "friends",
  "rooms", "leaderboard", "wallet", "profile", "settings",
];

export const PLAYORA_APP_VERSION = "0.1.0";

export interface SupportReportDraft {
  category: SupportReportCategory;
  title: string;
  description: string;
  locale: SupportLocale;
  routeKey: SupportRoute;
}

export interface SafeSupportDiagnostics {
  appVersion: string;
  locale: SupportLocale;
  route: SupportRoute;
  browserFamily: "Edge" | "Firefox" | "Chrome" | "Safari" | "Other";
  osFamily: "Windows" | "macOS" | "iOS" | "Android" | "Linux" | "Other";
}

export type SupportReportValidationCode =
  | "invalid_payload"
  | "invalid_category"
  | "invalid_locale"
  | "invalid_route"
  | "invalid_title"
  | "invalid_description";

export class SupportReportValidationError extends Error {
  constructor(readonly code: SupportReportValidationCode, message: string) {
    super(message);
    this.name = "SupportReportValidationError";
  }
}

const DRAFT_KEYS = new Set(["category", "title", "description", "locale", "routeKey"]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanText(value: string, preserveLineBreaks: boolean): string {
  const normalized = value.replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (!preserveLineBreaks) return normalized.replace(/\s+/g, " ").trim();
  return normalized
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeSupportReportDraft(input: unknown): SupportReportDraft {
  if (!isPlainRecord(input) || Object.keys(input).some(key => !DRAFT_KEYS.has(key)) ||
      !Object.keys(input).every(key => DRAFT_KEYS.has(key)) ||
      !["category", "title", "description", "locale", "routeKey"].every(key => Object.hasOwn(input, key))) {
    throw new SupportReportValidationError("invalid_payload", "The support report form is invalid.");
  }

  if (typeof input.category !== "string" ||
      !SUPPORT_REPORT_CATEGORIES.includes(input.category as SupportReportCategory)) {
    throw new SupportReportValidationError("invalid_category", "Choose a valid report category.");
  }
  if (input.locale !== "en" && input.locale !== "fa") {
    throw new SupportReportValidationError("invalid_locale", "Choose a supported language.");
  }
  if (typeof input.routeKey !== "string" || !SUPPORT_ROUTES.includes(input.routeKey as SupportRoute)) {
    throw new SupportReportValidationError("invalid_route", "The current page is not a supported route.");
  }
  if (typeof input.title !== "string") {
    throw new SupportReportValidationError("invalid_title", "Add a short report title.");
  }
  if (typeof input.description !== "string") {
    throw new SupportReportValidationError("invalid_description", "Describe what happened.");
  }

  const title = cleanText(input.title, false);
  const description = cleanText(input.description, true);
  if (title.length < 5 || title.length > 120) {
    throw new SupportReportValidationError("invalid_title", "The title must be between 5 and 120 characters.");
  }
  if (description.length < 20 || description.length > 4000) {
    throw new SupportReportValidationError("invalid_description", "The description must be between 20 and 4000 characters.");
  }

  return {
    category: input.category as SupportReportCategory,
    title,
    description,
    locale: input.locale,
    routeKey: input.routeKey as SupportRoute,
  };
}

function detectBrowserFamily(userAgent: string): SafeSupportDiagnostics["browserFamily"] {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/(?:Chrome|CriOS)\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Other";
}

function detectOsFamily(userAgent: string): SafeSupportDiagnostics["osFamily"] {
  if (/Android/i.test(userAgent)) return "Android";
  if (/(?:iPhone|iPad|iPod)/i.test(userAgent)) return "iOS";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/(?:Macintosh|Mac OS X)/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Other";
}

/**
 * Deliberately records only coarse browser/OS families and a known app route.
 * Never send raw URLs, query strings, stack traces, user-agent strings, cookies,
 * local storage, access tokens, private messages, or form contents as diagnostics.
 */
export function collectSafeSupportDiagnostics(
  userAgent: string,
  locale: SupportLocale,
  routeKey: SupportRoute,
): SafeSupportDiagnostics {
  if (!SUPPORT_ROUTES.includes(routeKey)) {
    throw new SupportReportValidationError("invalid_route", "The current page is not a supported route.");
  }
  return {
    appVersion: PLAYORA_APP_VERSION,
    locale,
    route: routeKey,
    browserFamily: detectBrowserFamily(userAgent),
    osFamily: detectOsFamily(userAgent),
  };
}
