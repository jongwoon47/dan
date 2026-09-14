import type { ReactNode } from "react";
import "./ui.css";

type Props = {
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="dan-empty">
      <div className="dan-empty__icon" aria-hidden>
        ·
      </div>
      <h3 className="dan-empty__title">{title}</h3>
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
