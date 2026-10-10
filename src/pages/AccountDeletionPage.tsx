import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  accountDeletionStatus,
  deleteAccount,
  type DeletionStatus,
} from "@/auth/accountDeletion";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDanCopy } from "@/copy/useDanCopy";

function deletionErrorCopy(
  message: string,
  copy: ReturnType<typeof useDanCopy>,
): string {
  if (message === "DAN_DELETE_ACTIVE" || /진행 중 거래/.test(message)) {
    return copy.deleteAccountActiveBlock;
  }
  if (message === "DAN_DELETE_RELOGIN" || /다시 로그인/.test(message)) {
    return copy.deleteAccountRelogin;
  }
  if (message === "DAN_DELETE_FAIL_PENDING" || /삭제가 시작된/.test(message)) {
    return copy.deleteAccountFailPending;
  }
  if (message === "DAN_DELETE_STATUS_FAIL" || /삭제 가능 여부/.test(message)) {
    return copy.deleteAccountStatusFail;
  }
  return message || copy.deleteAccountFail;
}

export function AccountDeletionPage() {
  const auth = useAuth();
  const copy = useDanCopy();
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  useDeepHeader({ title: copy.deleteAccountTitle });
  useEffect(() => {
    if (!auth.user || auth.mode !== "supabase") return;
    let alive = true;
    setError(null);
    setStatus(null);
    void accountDeletionStatus()
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {
        if (alive) setError(copy.deleteAccountStatusFail);
      });
    return () => {
      alive = false;
    };
  }, [auth.user?.id, auth.mode, retry, copy.deleteAccountStatusFail]);
  if (!auth.user) {
    return (
      <EmptyState
        title={copy.needLogin}
        action={<Button to="/login">{copy.login}</Button>}
      />
    );
  }
  if (auth.mode !== "supabase") {
    return <EmptyState title={copy.deleteAccountDemoBlocked} />;
  }
  async function execute() {
    if (busy.current) return;
    busy.current = true;
    setConfirm(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      await auth.finishAccountDeletion();
    } catch (e) {
      setError(
        deletionErrorCopy(
          e instanceof Error ? e.message : "",
          copy,
        ),
      );
      busy.current = false;
      setDeleting(false);
    }
  }
  return (
    <div className="page-stack page-narrow account-deletion-page">
      <section className="account-deletion-intro">
        <h1>{copy.deleteAccountHero}</h1>
        <p>{copy.deleteAccountLead}</p>
      </section>
      <ul className="account-deletion-list">
        <li>{copy.deleteAccountBulletProfile}</li>
        <li>{copy.deleteAccountBulletActive}</li>
        <li>{copy.deleteAccountBulletRetain}</li>
        <li>{copy.deleteAccountBulletGoogle}</li>
      </ul>
      {error ? (
        <p className="account-deletion-state is-error" role="alert">
          {error}
        </p>
      ) : null}
      {!status && !error ? (
        <p className="account-deletion-state" role="status">
          {copy.deleteAccountChecking}
        </p>
      ) : null}
      {status && status.activeTransactions > 0 ? (
        <div className="account-deletion-state">
          <p role="status">
            {copy.deleteAccountActiveN.replace(
              "{n}",
              String(status.activeTransactions),
            )}
          </p>
          <Button to="/my">{copy.deleteAccountOpenMyTrades}</Button>
        </div>
      ) : null}
      {status?.pending ? (
        <p className="account-deletion-state">{copy.deleteAccountPending}</p>
      ) : null}
      {deleting ? (
        <p className="account-deletion-state" role="status" aria-live="polite">
          {copy.deleteAccountBusy}
        </p>
      ) : (
        <div className="account-deletion-actions">
          {error && !status ? (
            <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
              {copy.deleteAccountRecheck}
            </Button>
          ) : null}
          <Button
            variant="danger"
            disabled={!status || status.activeTransactions > 0}
            onClick={() => setConfirm(true)}
          >
            {copy.deleteAccountCta}
          </Button>
          <Button to="/settings" variant="secondary">
            {copy.cancel}
          </Button>
        </div>
      )}
      <ConfirmSheet
        open={confirm}
        title={copy.deleteAccountConfirmTitle}
        body={copy.deleteAccountConfirmBody}
        confirmLabel={copy.deleteAccountConfirmAction}
        danger
        onConfirm={() => void execute()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
