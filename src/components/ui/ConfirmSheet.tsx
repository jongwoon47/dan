import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useDanLocale } from "@/i18n/locale";
import "./confirmSheet.css";

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When true, the confirm action button is not clickable. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const locale = useDanLocale();
  const resolvedCancel = cancelLabel ?? (locale === "ja" ? "キャンセル" : "취소");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const onConfirmRef = useRef(onConfirm);
  onCancelRef.current = onCancel;
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="confirm-sheet"
      role="presentation"
      onClick={() => onCancelRef.current()}
    >
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
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onCancelRef.current()}
          >
            {resolvedCancel}
          </Button>
          <Button
            fullWidth
            variant={danger ? "danger" : "primary"}
            disabled={confirmDisabled}
            onClick={() => onConfirmRef.current()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
