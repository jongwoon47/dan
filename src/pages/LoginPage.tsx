import { useEffect, useRef, useState, type FormEvent } from "react";
import { availableSocialProviders, startSocialLogin, type SocialProvider } from "@/auth/socialLogin";
import { Capacitor } from "@capacitor/core";
import { NATIVE_AUTH_FINISHED } from "@/auth/nativeAuth";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { consentReturnPath, useConsent } from "@/auth/ConsentProvider";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { useDanCopy, type LocalizedCopy } from "@/copy/useDanCopy";
import { useDanLocale } from "@/i18n/locale";
import { safeReturnPath } from "@/lib/createDraft";
import "@/pages/pages.css";

function authErrorMessage(err: unknown, copy: LocalizedCopy): string {
  const msg = err instanceof Error ? err.message : "";
  if (/invalid login|invalid credentials/i.test(msg)) return copy.authInvalid;
  if (/already registered|user already/i.test(msg)) return copy.authExists;
  if (/password/i.test(msg) && /6|least|weak/i.test(msg)) return copy.authWeakPassword;
  return copy.genericError;
}

export function LoginPage() {
  const copy = useDanCopy();
  const locale = useDanLocale();
  const { mode, status, signIn, signUp, error, clearError } = useAuth();
  const { resolution } = useConsent();
  const [params] = useSearchParams();
  const next = consentReturnPath(safeReturnPath(params.get("next")));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [providers, setProviders] = useState<SocialProvider[] | null>(null);
  const submitLock = useRef(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [awaitingSession, setAwaitingSession] = useState(false);

  useEffect(() => {
    const reset = () => { submitLock.current = false; setSocialBusy(null); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) reset(); };
    window.addEventListener(NATIVE_AUTH_FINISHED, reset);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener(NATIVE_AUTH_FINISHED, reset);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (mode === "demo") return;
    const controller = new AbortController();
    void availableSocialProviders(controller.signal)
      .then(setProviders)
      .catch(() => { if (!controller.signal.aborted) setProviders([]); });
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("error") || hash.has("error")) {
      setLocalError("간편 로그인을 완료하지 못했어요. 다시 시도해 주세요.");
      const clean = new URL(window.location.href);
      for (const key of ["error", "error_code", "error_description"]) clean.searchParams.delete(key);
      clean.hash = "";
      window.history.replaceState(null, "", clean.pathname + clean.search);
    }
    return () => controller.abort();
  }, [mode, params]);

  async function onSocialLogin(provider: SocialProvider) {
    if (submitLock.current || status === "loading") return;
    submitLock.current = true;
    setSocialBusy(provider);
    setLocalError(null);
    clearError();
    try {
      await startSocialLogin(provider, next);
    } catch {
      setLocalError("간편 로그인에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSocialBusy(null);
      submitLock.current = false;
    }
  }

  if (mode === "demo") {
    return <Navigate to={next} replace />;
  }
  if (status === "authenticated") {
    if (resolution === "loading") {
      return <div className="auth-screen auth-screen--resolving" aria-busy="true" />;
    }
    if (resolution === "required" || resolution === "error") {
      return <Navigate to={`/consent?next=${encodeURIComponent(next)}`} replace />;
    }
    return <Navigate to={next} replace />;
  }
  if (status === "loading" || awaitingSession) {
    return <div className="auth-screen auth-screen--resolving" aria-busy="true" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitLock.current || status === "loading") return;
    submitLock.current = true;
    clearError();
    setLocalError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (isSignUp) {
        const result = await signUp(
          email.trim(),
          password,
          displayName.trim() || email.split("@")[0]!,
        );
        if (result.confirmationRequired) {
          setIsSignUp(false);
          setPassword("");
          setNotice(
            "가입 확인 메일을 보냈어요. 이메일의 링크를 확인한 뒤 로그인해 주세요.",
          );
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      // Keep resolving until AuthProvider + ConsentProvider finish; then Navigate above.
      setAwaitingSession(true);
    } catch (err) {
      setLocalError(authErrorMessage(err, copy));
      setAwaitingSession(false);
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }

  const shownError = localError || (error ? copy.genericError : null);

  return (
    <div className="auth-screen">
      <div className="auth-screen__brand">
        <img src={`${import.meta.env.BASE_URL}dan-logo.png`} alt="" width={56} height={56} />
        <p className="auth-screen__mark">DAN</p>
        <h1 className="auth-screen__headline">{copy.authHeadline}</h1>
        <p className="section-desc">
          {isSignUp ? copy.signupLead : copy.loginLead}
          {next === "/create" ? ` ${copy.loginToContinue}` : ""}
        </p>
      </div>

      {params.get('account') === 'deleted' && <p role="status">{locale === "ja" ? "退会が完了しました。DANのアカウントと個人情報を削除しました。" : "회원탈퇴가 완료됐어요. DAN 계정과 개인정보를 삭제했어요。"}</p>}
      <div className="auth-social" aria-label={locale === "ja" ? "ソーシャルログイン" : "간편 로그인"}>
        {(["google", "kakao", ...(Capacitor.isNativePlatform() ? ["apple" as const] : [])] as SocialProvider[]).filter((provider) => providers?.includes(provider) || (providers === null && provider === "google")).map((provider) => {
          const label = provider === "kakao" ? "카카오" : provider === "google" ? "Google" : "Apple";
          const enabled = providers?.includes(provider);
          return <button key={provider} type="button" className={`auth-social__button auth-social__button--${provider}`}
            disabled={!enabled || busy || socialBusy !== null}
            aria-busy={socialBusy === provider}
            onClick={() => void onSocialLogin(provider)}>
            <span className="auth-social__content">
              <span className="auth-social__icon" aria-hidden="true">{provider === "kakao" ? <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3C6.48 3 2 6.46 2 10.73c0 2.77 1.88 5.2 4.7 6.57l-1.2 4.1c-.1.35.3.63.59.42l4.8-3.28c.37.03.74.05 1.11.05 5.52 0 10-3.46 10-7.86S17.52 3 12 3Z" /></svg> : provider === "google" ? <img src={`${import.meta.env.BASE_URL}google-g-logo.png`} alt="" width={20} height={20} /> : null}</span>
              <span className="auth-social__label">
                <span className={socialBusy === provider ? "auth-social__label--hidden" : undefined}>{locale === "ja" ? `${label}で続ける` : `${label}로 계속하기`}</span>
                {socialBusy === provider ? <span className="auth-social__progress" role="status">{locale === "ja" ? "接続中…" : "연결 중…"}</span> : null}
              </span>
            </span>
          </button>;
        })}
        <div className="auth-social__divider"><span>{locale === "ja" ? "または" : "또는"}</span></div>
      </div>
      <form className="section-stack auth-screen__form" onSubmit={(e) => void onSubmit(e)}>
        {isSignUp ? (
          <Field label={copy.displayNameLabel}>
            <TextInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={20}
            />
          </Field>
        ) : null}
        <Field label={copy.emailLabel}>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label={copy.passwordLabel}>
          <TextInput
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        {shownError ? (
          <p className="form-error" role="alert">
            {shownError}
          </p>
        ) : null}
        {notice ? (
          <p className="section-desc" role="status">
            {notice}
          </p>
        ) : null}
        <Button fullWidth type="submit" disabled={busy || socialBusy !== null} size="lg">
          {busy ? copy.saving : isSignUp ? copy.createAccount : (locale === "ja" ? "メールで続ける" : "이메일로 계속하기")}
        </Button>
      </form>

      <p className="auth-screen__signup">
        <span>{isSignUp ? (locale === "ja" ? "アカウントをお持ちですか？" : "이미 계정이 있나요?") : (locale === "ja" ? "初めてご利用ですか？" : "계정이 없나요?")}</span>
      <button
        type="button"
        className="text-link"
        aria-label={isSignUp ? copy.haveAccount : copy.needAccount}
        disabled={busy || socialBusy !== null}
        onClick={() => {
          setIsSignUp((v) => !v);
          clearError();
          setLocalError(null);
          setNotice(null);
        }}
      >
        {isSignUp ? copy.login : copy.signup}
      </button>
      </p>
      <Link to="/" className="text-link text-link--muted">
        {copy.goBack}
      </Link>
    </div>
  );
}
