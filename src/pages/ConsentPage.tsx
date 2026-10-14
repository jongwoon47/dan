import { useId, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { consentReturnPath, useConsent } from "@/auth/ConsentProvider";
import { legalDocumentHref } from "@/auth/consentVersions";
import { Button } from "@/components/ui/Button";
import { translate, useDanLocale } from "@/i18n/locale";
import "@/pages/pages.css";

export function ConsentPage() {
  const { mode, status } = useAuth();
  const { resolution, accept, refresh } = useConsent();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = consentReturnPath(params.get("next"));
  const locale = useDanLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const termsId = useId();
  const privacyId = useId();
  const allId = useId();

  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = terms && privacy;
  const canSubmit = allChecked && !busy;

  if (mode === "demo") return <Navigate to={next} replace />;
  if (status === "loading" || resolution === "loading") {
    return <div className="auth-screen auth-screen--resolving" aria-busy="true" />;
  }
  if (status === "anonymous" || resolution === "anonymous") {
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (resolution === "satisfied") {
    return <Navigate to={next} replace />;
  }

  async function onRetryStatus() {
    setRetryBusy(true);
    setError(null);
    try {
      await refresh();
    } catch {
      setError(t("consentStatusFailed"));
    } finally {
      setRetryBusy(false);
    }
  }

  if (resolution === "error") {
    return (
      <div className="auth-screen consent-screen">
        <div className="auth-screen__brand">
          <img
            src={`${import.meta.env.BASE_URL}dan-logo.png`}
            alt=""
            width={56}
            height={56}
          />
          <p className="auth-screen__mark">DAN</p>
          <h1 className="auth-screen__headline">{t("consentHeadline")}</h1>
          <p className="section-desc">{t("consentStatusFailed")}</p>
        </div>
        <p className="form-error" role="alert">
          {error ?? t("consentStatusFailed")}
        </p>
        <Button
          fullWidth
          size="lg"
          disabled={retryBusy}
          onClick={() => void onRetryStatus()}
        >
          {retryBusy ? t("consentRetrying") : t("consentRetry")}
        </Button>
      </div>
    );
  }

  function setAll(value: boolean) {
    setTerms(value);
    setPrivacy(value);
  }

  function onToggleAll() {
    setAll(!allChecked);
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await accept();
      navigate(next, { replace: true });
    } catch {
      setError(t("consentSaveFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen consent-screen">
      <div className="auth-screen__brand">
        <img
          src={`${import.meta.env.BASE_URL}dan-logo.png`}
          alt=""
          width={56}
          height={56}
        />
        <p className="auth-screen__mark">DAN</p>
        <h1 className="auth-screen__headline">{t("consentHeadline")}</h1>
        <p className="section-desc">{t("consentLead")}</p>
        {locale === "ja" ? (
          <p className="section-desc">{t("consentLegalPendingJa")}</p>
        ) : null}
      </div>

      <div className="consent-list" role="group" aria-label={t("consentGroup")}>
        <div className="consent-row consent-row--all">
          <label className="consent-row__main" htmlFor={allId}>
            <input
              id={allId}
              className="consent-check-input"
              type="checkbox"
              checked={allChecked}
              onChange={onToggleAll}
            />
            <span className="consent-check" aria-hidden="true" data-checked={allChecked}>
              {allChecked ? "✓" : ""}
            </span>
            <span className="consent-row__label">{t("consentAll")}</span>
          </label>
        </div>

        <div className="consent-divider" role="separator" />

        <div className="consent-row">
          <label className="consent-row__main" htmlFor={termsId}>
            <input
              id={termsId}
              className="consent-check-input"
              type="checkbox"
              checked={terms}
              onChange={() => setTerms((v) => !v)}
            />
            <span className="consent-check" aria-hidden="true" data-checked={terms}>
              {terms ? "✓" : ""}
            </span>
            <span className="consent-row__label">
              <span className="consent-row__required">{t("consentRequiredTag")}</span> {t("consentTerms")}
            </span>
          </label>
          <a
            className="consent-row__view"
            href={legalDocumentHref("terms", locale)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("consentViewTerms")}
          >
            {t("consentView")} <span aria-hidden="true">›</span>
          </a>
        </div>

        <div className="consent-row">
          <label className="consent-row__main" htmlFor={privacyId}>
            <input
              id={privacyId}
              className="consent-check-input"
              type="checkbox"
              checked={privacy}
              onChange={() => setPrivacy((v) => !v)}
            />
            <span className="consent-check" aria-hidden="true" data-checked={privacy}>
              {privacy ? "✓" : ""}
            </span>
            <span className="consent-row__label">
              <span className="consent-row__required">{t("consentRequiredTag")}</span> {t("consentPrivacy")}
            </span>
          </label>
          <a
            className="consent-row__view"
            href={legalDocumentHref("privacy", locale)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("consentViewPrivacy")}
          >
            {t("consentView")} <span aria-hidden="true">›</span>
          </a>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        fullWidth
        size="lg"
        disabled={!canSubmit}
        onClick={() => void onSubmit()}
      >
        {busy ? t("consentSaving") : t("consentSubmit")}
      </Button>
    </div>
  );
}
