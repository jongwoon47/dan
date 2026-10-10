import { useDeepHeader } from "@/components/layout/ShellChrome";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDanLocale } from "@/i18n/locale";
import "./pages.css";

export function NotFoundPage() {
  const locale = useDanLocale();
  const title = locale === "ja" ? "ページが見つかりません" : "페이지를 찾을 수 없어요";
  const body = locale === "ja"
    ? "アドレスが間違っているか、利用できない画面です。"
    : "주소가 잘못됐거나 더 이상 사용할 수 없는 화면이에요.";
  useDeepHeader({ title });

  return (
    <div className="page-stack page-narrow">
      <EmptyState
        title={title}
        body={body}
        action={
          <div className="action-row">
            <Button to="/">{locale === "ja" ? "ホームへ" : "홈으로"}</Button>
            <Button to="/feed" variant="secondary">
              {locale === "ja" ? "探す" : "탐색하기"}
            </Button>
          </div>
        }
      />
    </div>
  );
}
