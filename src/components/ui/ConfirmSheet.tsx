import { useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import "./confirmSheet.css";

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "취소",
  danger,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  if (!open) return null;

  return (
    <div className="confirm-sheet" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        className="confirm-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-sheet__title">
          {title}
        </h2>
        {body ? <p className="confirm-sheet__body">{body}</p> : null}
        {children}
        <div className="confirm-sheet__actions">
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            fullWidth
            variant={danger ? "secondary" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
