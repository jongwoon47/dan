import { useId, type ElementType, type ReactNode } from "react";
import "./ui.css";

type Props = {
  title: string;
  body?: string;
  action?: ReactNode;
  /** Use 3 when the page already has an h2 section title above the empty state. */
  headingLevel?: 2 | 3;
};

export function EmptyState({ title, body, action, headingLevel = 2 }: Props) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as ElementType;
  return (
    <div
      className="dan-empty"
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
    >
      <Heading id={titleId} className="dan-empty__title">
        {title}
      </Heading>
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
