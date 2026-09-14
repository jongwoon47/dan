import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import { safeReturnPath } from "@/lib/createDraft";
import "@/pages/pages.css";

function authErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (/invalid login|invalid credentials/i.test(msg)) return ko.authInvalid;
  if (/already registered|user already/i.test(msg)) return ko.authExists;
  if (/password/i.test(msg) && /6|least|weak/i.test(msg)) return ko.authWeakPassword;
  return ko.genericError;
}

export function LoginPage() {
  const { mode, status, signIn, signUp, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeReturnPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (mode === "demo") {
    return <Navigate to={next} replace />;
  }
  if (status === "authenticated") {
    return <Navigate to={next} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        await signUp(
          email.trim(),
          password,
          displayName.trim() || email.split("@")[0]!,
        );
      } else {
        await signIn(email.trim(), password);
      }
      navigate(next);
    } catch (err) {
      setLocalError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const shownError = localError || (error ? ko.genericError : null);

  return (
    <div className="auth-screen">
      <div className="auth-screen__brand">
        <img src="/dan-logo.png" alt="" width={56} height={56} />
        <p className="auth-screen__mark">DAN</p>
        <h1 className="auth-screen__headline">{ko.authHeadline}</h1>
        <p className="section-desc">
          {isSignUp ? ko.signupLead : ko.loginLead}
          {next === "/create" ? ` ${ko.loginToContinue}` : ""}
        </p>
      </div>

      <form className="section-stack" onSubmit={(e) => void onSubmit(e)}>
        {isSignUp ? (
          <Field label={ko.displayNameLabel}>
            <TextInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={20}
            />
          </Field>
        ) : null}
        <Field label={ko.emailLabel}>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label={ko.passwordLabel}>
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
        <Button fullWidth type="submit" disabled={busy} size="lg">
          {busy ? ko.saving : isSignUp ? ko.createAccount : ko.login}
        </Button>
      </form>

      <button
        type="button"
        className="text-link"
        onClick={() => {
          setIsSignUp((v) => !v);
          clearError();
          setLocalError(null);
        }}
      >
        {isSignUp ? ko.haveAccount : ko.needAccount}
      </button>
      <Link to="/" className="text-link text-link--muted">
        {ko.goBack}
      </Link>
    </div>
  );
}
