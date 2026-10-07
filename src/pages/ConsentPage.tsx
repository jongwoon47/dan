import { useId, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { consentReturnPath, useConsent } from "@/auth/ConsentProvider";
import { legalDocumentHref } from "@/auth/consentVersions";
import { Button } from "@/components/ui/Button";
import "@/pages/pages.css";

export function ConsentPage() {
  const { mode, status } = useAuth();
  const { resolution, accept } = useConsent();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = consentReturnPath(params.get("next"));
  const termsId = useId();
  const privacyId = useId();
  const allId = useId();

  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
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
      setError("동의 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
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
        <h1 className="auth-screen__headline">DAN 시작하기</h1>
        <p className="section-desc">서비스 이용을 위해 아래 내용을 확인해 주세요.</p>
      </div>

      <div className="consent-list" role="group" aria-label="필수 동의">
        <div className="consent-row consent-row--all">
          <button
            type="button"
            id={allId}
            className="consent-row__main"
            aria-pressed={allChecked}
            onClick={onToggleAll}
          >
            <span className="consent-check" aria-hidden="true" data-checked={allChecked}>
              {allChecked ? "✓" : ""}
            </span>
            <span className="consent-row__label">전체 동의</span>
          </button>
        </div>

        <div className="consent-divider" role="separator" />

        <div className="consent-row">
          <button
            type="button"
            id={termsId}
            className="consent-row__main"
            aria-pressed={terms}
            onClick={() => setTerms((v) => !v)}
          >
            <span className="consent-check" aria-hidden="true" data-checked={terms}>
              {terms ? "✓" : ""}
            </span>
            <span className="consent-row__label">
              <span className="consent-row__required">[필수]</span> 이용약관 동의
            </span>
          </button>
          <a
            className="consent-row__view"
            href={legalDocumentHref("terms")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="이용약관 보기"
          >
            보기 <span aria-hidden="true">›</span>
          </a>
        </div>

        <div className="consent-row">
          <button
            type="button"
            id={privacyId}
            className="consent-row__main"
            aria-pressed={privacy}
            onClick={() => setPrivacy((v) => !v)}
          >
            <span className="consent-check" aria-hidden="true" data-checked={privacy}>
              {privacy ? "✓" : ""}
            </span>
            <span className="consent-row__label">
              <span className="consent-row__required">[필수]</span> 개인정보처리방침 동의
            </span>
          </button>
          <a
            className="consent-row__view"
            href={legalDocumentHref("privacy")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="개인정보처리방침 보기"
          >
            보기 <span aria-hidden="true">›</span>
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
        {busy ? "저장 중…" : "동의하고 시작하기"}
      </Button>
    </div>
  );
}
