import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { accountDeletionStatus, deleteAccount, type DeletionStatus } from '@/auth/accountDeletion';
import { useDeepHeader } from '@/components/layout/ShellChrome';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { EmptyState } from '@/components/ui/EmptyState';

export function AccountDeletionPage() {
  const auth = useAuth();
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  useDeepHeader({ title: '회원탈퇴' });
  useEffect(() => {
    if (!auth.user || auth.mode !== 'supabase') return;
    let alive = true;
    setError(null); setStatus(null);
    void accountDeletionStatus().then(s => { if (alive) setStatus(s); }).catch(() => {
      if (alive) setError('삭제 가능 여부를 확인하지 못했어요. 다시 시도해 주세요.');
    });
    return () => { alive = false; };
  }, [auth.user?.id, auth.mode, retry]);
  if (!auth.user) return <EmptyState title="로그인이 필요해요" action={<Button to="/login">로그인</Button>} />;
  if (auth.mode !== 'supabase') return <EmptyState title="데모 계정은 탈퇴할 수 없어요" />;
  async function execute() {
    if (busy.current) return;
    busy.current = true; setConfirm(false); setDeleting(true); setError(null);
    try {
      await deleteAccount();
      await auth.finishAccountDeletion();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제를 완료하지 못했어요. 다시 시도해 주세요.');
      busy.current = false; setDeleting(false);
    }
  }
  return <div className="page-stack page-narrow account-deletion-page">
    <section className="account-deletion-intro">
      <h1>계정을 삭제하면 되돌릴 수 없어요</h1>
      <p>탈퇴 전에 삭제되는 정보와 유지되는 거래 기록을 확인해 주세요.</p>
    </section>
    <ul className="account-deletion-list">
      <li>프로필, 인증 정보, 개인정보와 업로드한 파일을 삭제해요.</li>
      <li>진행 중 거래·미정산 결제·열린 분쟁은 기존 완료 또는 취소 절차로 먼저 정리해 주세요.</li>
      <li>종료된 거래의 상태·금액·완료 시점은 상대방의 거래 기록을 위해 유지해요. 이름은 ‘탈퇴한 사용자’로 바꾸고 개인 작성 내용과 인증 계정 연결은 제거해요.</li>
      <li>DAN 서비스 계정만 삭제돼요. Google 계정 자체는 삭제하지 않아요.</li>
    </ul>
    {error && <p className="account-deletion-state is-error" role="alert">{error}</p>}
    {!status && !error && <p className="account-deletion-state" role="status">삭제 가능 여부를 확인하고 있어요…</p>}
    {status && status.activeTransactions > 0 && <div className="account-deletion-state"><p role="status">먼저 정리할 거래 또는 분쟁이 {status.activeTransactions}건 있어요.</p><Button to="/my">내 거래 확인</Button></div>}
    {status?.pending && <p className="account-deletion-state">이전에 시작한 삭제를 이어서 완료해 주세요.</p>}
    {deleting ? <p className="account-deletion-state" role="status" aria-live="polite">계정을 삭제하고 있어요. 잠시 기다려 주세요…</p> : <div className="account-deletion-actions">
      {error && !status && <Button variant="secondary" onClick={() => setRetry(n => n + 1)}>다시 확인</Button>}
      <Button variant="danger" disabled={!status || status.activeTransactions > 0} onClick={() => setConfirm(true)}>계정 삭제</Button>
      <Button to="/settings" variant="secondary">취소</Button>
    </div>}
    <ConfirmSheet open={confirm} title="정말 탈퇴할까요?" body="계정과 개인정보가 삭제되고 복구할 수 없어요. 안내한 거래 기록은 개인 식별정보와 분리하여 남아요."
      confirmLabel="계정 영구 삭제" danger onConfirm={() => void execute()} onCancel={() => setConfirm(false)} />
  </div>;
}
