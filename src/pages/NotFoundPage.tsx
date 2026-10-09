import { useDeepHeader } from "@/components/layout/ShellChrome";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import "./pages.css";

export function NotFoundPage() {
  useDeepHeader({ title: "페이지를 찾을 수 없어요" });

  return (
    <div className="page-stack page-narrow">
      <EmptyState
        title="페이지를 찾을 수 없어요"
        body="주소가 잘못됐거나 더 이상 사용할 수 없는 화면이에요."
        action={
          <div className="action-row">
            <Button to="/">홈으로</Button>
            <Button to="/feed" variant="secondary">탐색하기</Button>
          </div>
        }
      />
    </div>
  );
}
