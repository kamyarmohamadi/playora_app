import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Check, Clock3, LifeBuoy, LockKeyhole, Send, X } from "lucide-react";
import {
  collectSafeSupportDiagnostics,
  normalizeSupportReportDraft,
  PLAYORA_APP_VERSION,
  SupportReportValidationError,
  type SafeSupportDiagnostics,
  type SupportLocale,
  type SupportReportCategory,
  type SupportRoute,
} from "../platform/supportReports";

export type SupportReportStatus = "open" | "triaged" | "in_progress" | "resolved" | "closed";
export interface SupportReportSummary {
  id: string;
  category: SupportReportCategory;
  title: string;
  status: SupportReportStatus;
  created_at: string;
}
export interface SupportReportSubmission {
  idempotencyKey: string;
  category: SupportReportCategory;
  title: string;
  description: string;
  locale: SupportLocale;
  routeKey: SupportRoute;
  diagnostics: SafeSupportDiagnostics;
  appVersion: typeof PLAYORA_APP_VERSION;
}
export interface SupportReportDialogProps {
  open: boolean;
  locale: SupportLocale;
  routeKey: SupportRoute;
  isSignedIn: boolean;
  recentReports: readonly SupportReportSummary[];
  reportsLoading?: boolean;
  reportsUnavailable?: boolean;
  t: (key: string) => string;
  onClose: () => void;
  onSignIn: () => void;
  onSubmit: (report: SupportReportSubmission) => Promise<SupportReportSummary>;
  onReportCreated?: (report: SupportReportSummary) => void;
}

const CATEGORY_KEYS: Record<SupportReportCategory, string> = {
  bug: "supportCategoryBug",
  account: "supportCategoryAccount",
  catalog: "supportCategoryCatalog",
  accessibility: "supportCategoryAccessibility",
  other: "supportCategoryOther",
};
const STATUS_KEYS: Record<SupportReportStatus, string> = {
  open: "supportStatusOpen",
  triaged: "supportStatusTriaged",
  in_progress: "supportStatusInProgress",
  resolved: "supportStatusResolved",
  closed: "supportStatusClosed",
};
const VALIDATION_KEYS: Record<SupportReportValidationError["code"], string> = {
  invalid_payload: "supportReportInvalid",
  invalid_category: "supportReportInvalidCategory",
  invalid_locale: "supportReportInvalid",
  invalid_route: "supportReportInvalid",
  invalid_title: "supportReportInvalidTitle",
  invalid_description: "supportReportInvalidDescription",
};

function failureMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof SupportReportValidationError) return t(VALIDATION_KEYS[error.code]);
  if (error instanceof Error && error.message === "rate_limited") return t("supportReportRateLimited");
  if (error instanceof Error && error.message === "session_changed") return t("supportReportSessionChanged");
  if (error instanceof Error && error.message === "secure_random_unavailable") return t("supportSecureContextRequired");
  return t("supportReportFailed");
}

export function SupportReportDialog({
  open, locale, routeKey, isSignedIn, recentReports, reportsLoading = false,
  reportsUnavailable = false, t, onClose, onSignIn, onSubmit, onReportCreated,
}: SupportReportDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [category, setCategory] = useState<SupportReportCategory>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onClose]);

  useEffect(() => {
    if (!open) {
      setSubmitError("");
      setSubmitted(false);
    }
  }, [open]);

  if (!open) return null;

  const close = () => { if (!submitting) onClose(); };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitted(false);
    if (!isSignedIn) {
      setSubmitError(t("supportSignInRequired"));
      return;
    }

    try {
      const draft = normalizeSupportReportDraft({ category, title, description, locale, routeKey });
      if (!idempotencyKeyRef.current) {
        if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== "function") {
          throw new Error("secure_random_unavailable");
        }
        idempotencyKeyRef.current = globalThis.crypto.randomUUID();
      }
      setSubmitting(true);
      const report = await onSubmit({
        ...draft,
        idempotencyKey: idempotencyKeyRef.current,
        appVersion: PLAYORA_APP_VERSION,
        diagnostics: collectSafeSupportDiagnostics(
          typeof navigator === "undefined" ? "" : navigator.userAgent,
          draft.locale,
          draft.routeKey,
        ),
      });
      idempotencyKeyRef.current = null;
      setTitle("");
      setDescription("");
      setCategory("bug");
      setSubmitted(true);
      onReportCreated?.(report);
    } catch (error) {
      setSubmitError(failureMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-backdrop support-backdrop" role="presentation"
      onMouseDown={event => { if (!submitting && event.target === event.currentTarget) onClose(); }}>
      <section className="auth-modal support-modal" role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="auth-modal-top">
          <span className="auth-modal-mark support-modal-mark"><LifeBuoy size={22} /></span>
          <button className="auth-close" type="button" aria-label={t("cancel")} onClick={close} disabled={submitting}>
            <X size={18} />
          </button>
        </div>
        <div className="support-dialog-heading">
          <span className="section-eyebrow">{t("supportEyebrow")}</span>
          <h2 id={titleId}>{t("help")}</h2>
          <p id={descriptionId}>{t("supportSubtitle")}</p>
        </div>

        {!isSignedIn ? (
          <div className="support-signin-required">
            <span className="support-lock-icon"><LockKeyhole size={23} /></span>
            <p>{t("supportSignInRequired")}</p>
            <button className="btn-gradient support-submit" type="button" onClick={onSignIn}>{t("signIn")}</button>
          </div>
        ) : (
          <>
            <p className="support-privacy-note"><LockKeyhole size={14} /><span>{t("supportDiagnosticsNotice")}</span></p>
            {submitted && <p className="support-success" role="status"><Check size={16} />{t("supportReportSubmitted")}</p>}
            {submitError && <p className="support-error" role="alert"><AlertCircle size={16} />{submitError}</p>}

            <form className="support-report-form" onSubmit={event => void handleSubmit(event)}>
              <label>{t("supportCategory")}
                <select name="supportCategory" value={category}
                  onChange={event => setCategory(event.target.value as SupportReportCategory)}
                  required disabled={submitting}>
                  {Object.entries(CATEGORY_KEYS).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
                </select>
              </label>
              <label>{t("supportReportTitle")}
                <input name="supportTitle" type="text" value={title}
                  onChange={event => setTitle(event.target.value)} minLength={5} maxLength={120}
                  required disabled={submitting} autoComplete="off" placeholder={t("supportTitlePlaceholder")} />
              </label>
              <label>{t("supportReportDescription")}
                <textarea aria-label={t("supportReportDescription")} name="supportDescription" value={description}
                  onChange={event => setDescription(event.target.value)} minLength={20} maxLength={4000}
                  rows={4} required disabled={submitting} placeholder={t("supportDescriptionPlaceholder")} />
                <span className="support-character-count">{description.length}/4000</span>
              </label>
              <button className="btn-gradient support-submit" type="submit" disabled={submitting}>
                <Send size={15} />{submitting ? t("loading") : t("supportSubmitReport")}
              </button>
            </form>

            <section className="support-reports-section" aria-label={t("supportMyReports")}>
              <div className="support-reports-heading">
                <h3>{t("supportMyReports")}</h3>
                {reportsLoading && <span><Clock3 size={13} />{t("loading")}</span>}
              </div>
              {reportsUnavailable && <p className="support-history-note">{t("supportHistoryUnavailable")}</p>}
              {!reportsLoading && !reportsUnavailable && recentReports.length === 0 &&
                <p className="support-history-note">{t("supportNoReports")}</p>}
              {recentReports.length > 0 && (
                <ul className="support-report-list">
                  {recentReports.slice(0, 5).map(report => {
                    const timestamp = Date.parse(report.created_at);
                    return <li key={report.id} className="support-report-list-item">
                      <div className="support-report-list-copy">
                        <b>{report.title}</b>
                        <time dateTime={report.created_at}>
                          {Number.isFinite(timestamp) ? new Date(timestamp).toLocaleDateString(locale) : report.created_at}
                        </time>
                      </div>
                      <span className={"support-report-status status-" + report.status}>{t(STATUS_KEYS[report.status])}</span>
                    </li>;
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
