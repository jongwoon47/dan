import { useId, type ReactNode } from "react";
import "./ui.css";

type Props = {
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: Props) {
  const titleId = useId();
  return (
    <div
      className="dan-empty"
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="dan-empty__title">
        {title}
      </h2>
      {body ? <p className="dan-empty__body">{body}</p> : null}
      {action ? <div className="dan-empty__action">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn";
}) {
  return <span className={`dan-badge dan-badge--${tone}`}>{children}</span>;
}
