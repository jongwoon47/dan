import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/auth/AuthProvider';
import { useDeepHeader } from '@/components/layout/ShellChrome';

export function SettingsPage() {
  const auth = useAuth();
  useDeepHeader({ title: '설정' });

  if (!auth.user) {
    return (
      <EmptyState
        title="로그인이 필요해요"
        body="계정 설정을 확인하려면 로그인해 주세요."
        action={<Button to="/login">로그인</Button>}
      />
    );
  }

  return (
    <div className="page-stack page-narrow settings-page">
      <section className="settings-section" aria-labelledby="settings-account-title">
        <div className="settings-section__head">
          <h1 id="settings-account-title">계정</h1>
          <p>계정과 개인정보 관련 설정을 관리할 수 있어요.</p>
        </div>
        <div className="settings-list">
          <Button to="/settings/delete-account" variant="secondary" fullWidth>
            회원탈퇴
          </Button>
        </div>
      </section>
    </div>
  );
}
