import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/auth/AuthProvider';
import { legalDocumentHref } from '@/auth/consentVersions';
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
      <section className="settings-section" aria-labelledby="settings-legal-title">
        <div className="settings-section__head">
          <h1 id="settings-legal-title">법적 정보</h1>
          <p>서비스 이용약관과 개인정보 처리방침을 확인할 수 있어요.</p>
        </div>
        <div className="settings-list">
          <a
            className="settings-link-row"
            href={legalDocumentHref('terms')}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>이용약관</span>
            <span aria-hidden>›</span>
          </a>
          <a
            className="settings-link-row"
            href={legalDocumentHref('privacy')}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>개인정보처리방침</span>
            <span aria-hidden>›</span>
          </a>
        </div>
      </section>

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
