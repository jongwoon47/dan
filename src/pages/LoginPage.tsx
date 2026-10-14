import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  availableSocialProviders,
  startSocialLogin,
  type SocialProvider,
} from "@/auth/socialLogin";
import { AppleSignInCancelledError } from "@/auth/appleSignIn";
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

function AppleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.37 12.73c-.03-2.24 1.83-3.32 1.91-3.37-1.04-1.52-2.66-1.73-3.23-1.75-1.38-.14-2.69.81-3.39.81-.7 0-1.78-.79-2.93-.77-1.51.02-2.9.88-3.68 2.23-1.57 2.72-.4 6.74 1.13 8.95.75 1.08 1.64 2.29 2.81 2.25 1.13-.05 1.56-.73 2.93-.73 1.36 0 1.75.73 2.94.71 1.22-.02 1.99-1.1 2.73-2.19.86-1.26 1.21-2.48 1.23-2.54-.03-.01-2.36-.91-2.45-3.6ZM14.6 5.98c.62-.75 1.04-1.8.93-2.84-.9.04-1.99.6-2.63 1.35-.58.67-1.08 1.74-.95 2.76 1 .08 2.03-.51 2.65-1.27Z"
      />
    </svg>
  );
}

function providerLabel(provider: SocialProvider): string {
  if (provider === "kakao") return "카카오";
  if (provider === "google") return "Google";
  return "Apple";
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
    const reset = () => {
      submitLock.current = false;
      setSocialBusy(null);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
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
      .catch(() => {
        if (!controller.signal.aborted) setProviders([]);
      });
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("error") || hash.has("error")) {
      setLocalError(
        locale === "ja"
          ? "かんたんログインを完了できませんでした。もう一度お試しください。"
          : "간편 로그인을 완료하지 못했어요. 다시 시도해 주세요.",
      );
      const clean = new URL(window.location.href);
      for (const key of ["error", "error_code", "error_description"]) {
        clean.searchParams.delete(key);
      }
      clean.hash = "";
      window.history.replaceState(null, "", clean.pathname + clean.search);
    }
    return () => controller.abort();
  }, [locale, mode, params]);

  async function onSocialLogin(provider: SocialProvider) {
    if (submitLock.current || status === "loading") return;
    submitLock.current = true;
    setSocialBusy(provider);
    setLocalError(null);
    clearError();
    try {
      const result = await startSocialLogin(provider, next);
      if (result.mode === "session") {
        setAwaitingSession(true);
        setSocialBusy(null);
        submitLock.current = false;
      }
      // redirect mode: keep busy until OAuth return / NATIVE_AUTH_FINISHED
    } catch (err) {
      if (err instanceof AppleSignInCancelledError) {
        setLocalError(null);
      } else {
        setLocalError(
          locale === "ja"
            ? "かんたんログインに接続できませんでした。しばらくしてからもう一度お試しください。"
            : "간편 로그인에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      }
      setSocialBusy(null);
      submitLock.current = false;
      setAwaitingSession(false);
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
            locale === "ja"
              ? "確認メールを送りました。メールのリンクを確認してからログインしてください。"
              : "가입 확인 메일을 보냈어요. 이메일의 링크를 확인한 뒤 로그인해 주세요.",
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
  const optimisticProviders: SocialProvider[] =
    Capacitor.getPlatform() === "ios" ? ["apple", "google"] : ["google"];
  const visibleProviders = providers ?? optimisticProviders;

  return (
    <div className="auth-screen">
      <div className="auth-screen__brand">
        <img
          src={`${import.meta.env.BASE_URL}dan-logo.png`}
          alt=""
          width={56}
          height={56}
        />
        <p className="auth-screen__mark">DAN</p>
        <h1 className="auth-screen__headline">{copy.authHeadline}</h1>
        <p className="section-desc">
          {isSignUp ? copy.signupLead : copy.loginLead}
          {next === "/create" ? ` ${copy.loginToContinue}` : ""}
        </p>
      </div>

      {params.get("account") === "deleted" && (
        <p role="status">
          {locale === "ja"
            ? "退会が完了しました。DANのアカウントと個人情報を削除しました。"
            : "회원탈퇴가 완료됐어요. DAN 계정과 개인정보를 삭제했어요."}
        </p>
      )}
      <div
        className="auth-social"
        aria-label={locale === "ja" ? "ソーシャルログイン" : "간편 로그인"}
      >
        {visibleProviders.map((provider) => {
          const label = providerLabel(provider);
          const enabled =
            providers === null
              ? provider === "google" || provider === "apple"
              : providers.includes(provider);
          return (
            <button
              key={provider}
              type="button"
              className={`auth-social__button auth-social__button--${provider}`}
              disabled={!enabled || busy || socialBusy !== null}
              aria-busy={socialBusy === provider}
              onClick={() => void onSocialLogin(provider)}
            >
              <span className="auth-social__content">
                <span className="auth-social__icon" aria-hidden="true">
                  {provider === "kakao" ? (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M12 3C6.48 3 2 6.46 2 10.73c0 2.77 1.88 5.2 4.7 6.57l-1.2 4.1c-.1.35.3.63.59.42l4.8-3.28c.37.03.74.05 1.11.05 5.52 0 10-3.46 10-7.86S17.52 3 12 3Z"
                      />
                    </svg>
                  ) : provider === "google" ? (
                    <img
                      src={`${import.meta.env.BASE_URL}google-g-logo.png`}
                      alt=""
                      width={20}
                      height={20}
                    />
                  ) : (
                    <AppleMark />
                  )}
                </span>
                <span className="auth-social__label">
                  <span
                    className={
                      socialBusy === provider
                        ? "auth-social__label--hidden"
                        : undefined
                    }
                  >
                    {locale === "ja"
                      ? `${label}で続ける`
                      : `${label}로 계속하기`}
                  </span>
                  {socialBusy === provider ? (
                    <span className="auth-social__progress" role="status">
                      {locale === "ja" ? "接続中…" : "연결 중…"}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
        <div className="auth-social__divider">
          <span>{locale === "ja" ? "または" : "또는"}</span>
        </div>
      </div>
      <form
        className="section-stack auth-screen__form"
        onSubmit={(e) => void onSubmit(e)}
      >
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
        <Button
          fullWidth
          type="submit"
          disabled={busy || socialBusy !== null}
          size="lg"
        >
          {busy
            ? copy.saving
            : isSignUp
              ? copy.createAccount
              : locale === "ja"
                ? "メールで続ける"
                : "이메일로 계속하기"}
        </Button>
      </form>

      <p className="auth-screen__signup">
        <span>
          {isSignUp
            ? locale === "ja"
              ? "アカウントをお持ちですか？"
              : "이미 계정이 있나요?"
            : locale === "ja"
              ? "初めてご利用ですか？"
              : "계정이 없나요?"}
        </span>
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
