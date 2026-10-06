import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/auth/AuthProvider';
import { useDeepHeader } from '@/components/layout/ShellChrome';

export function SettingsPage() {
  const auth = useAuth();
  useDeepHeader({ title: '설정' });
  if (!auth.user) return <EmptyState title="로그인이 필요해요" action={<Button to="/login">로그인</Button>} />;
  return <div className="page-stack page-narrow"><h1 className="page-title">설정</h1>
    <Button to="/settings/delete-account" variant="secondary" fullWidth>회원탈퇴</Button></div>;
}
