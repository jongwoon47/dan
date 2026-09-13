import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import "@/pages/pages.css";

export function LoginPage() {
  const { mode, status, signIn, signUp, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (mode === "demo") {
    return <Navigate to="/my" replace />;
  }
  if (status === "authenticated") {
    return <Navigate to="/my" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setLocalError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, displayName.trim() || email.split("@")[0]!);
      } else {
        await signIn(email.trim(), password);
      }
      navigate("/my");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack" style={{ maxWidth: 420 }}>
      <header className="page-header">
        <h1 className="page-title">{isSignUp ? "Sign up" : ko.login}</h1>
        <p className="section-desc">
          Email + password. Google/Kakao/Apple OAuth is not enabled in V1.
        </p>
      </header>

      <form className="section-stack" onSubmit={onSubmit}>
        {isSignUp ? (
          <Field label="Display name">
            <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Email">
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        {(localError || error) && (
          <p className="form-error" role="alert">
            {localError || error}
          </p>
        )}
        <Button fullWidth type="submit" disabled={busy}>
          {busy ? "..." : isSignUp ? "Create account" : ko.login}
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
        {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
      </button>
      <Link to="/" className="text-link">
        {ko.goBack}
      </Link>
    </div>
  );
}
