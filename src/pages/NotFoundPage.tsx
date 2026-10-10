import { useDeepHeader } from "@/components/layout/ShellChrome";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDanCopy } from "@/copy/useDanCopy";
import "./pages.css";

export function NotFoundPage() {
  const copy = useDanCopy();
  useDeepHeader({ title: copy.notFoundTitle });

  return (
    <div className="page-stack page-narrow">
      <EmptyState
        title={copy.notFoundTitle}
        body={copy.notFoundBody}
        action={
          <div className="action-row">
            <Button to="/">{copy.notFoundHome}</Button>
            <Button to="/feed" variant="secondary">
              {copy.notFoundExplore}
            </Button>
          </div>
        }
      />
    </div>
  );
}
