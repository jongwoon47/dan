import type { LocalizedCopy } from "@/copy/useDanCopy";

export type ReportReason = "spam" | "fraud" | "abuse" | "other";

type Props = {
  value: ReportReason;
  onChange: (reason: ReportReason) => void;
  copy: Pick<
    LocalizedCopy,
    "reportReason" | "reportSpam" | "reportFraud" | "reportAbuse" | "reportOther"
  >;
};

const OPTIONS: ReportReason[] = ["spam", "fraud", "abuse", "other"];

function labelFor(
  reason: ReportReason,
  copy: Props["copy"],
): string {
  if (reason === "spam") return copy.reportSpam;
  if (reason === "fraud") return copy.reportFraud;
  if (reason === "abuse") return copy.reportAbuse;
  return copy.reportOther;
}

export function ReportReasonChoices({ value, onChange, copy }: Props) {
  return (
    <div
      className="confirm-sheet__choices"
      role="radiogroup"
      aria-label={copy.reportReason}
    >
      {OPTIONS.map((reason) => (
        <button
          key={reason}
          type="button"
          role="radio"
          aria-checked={value === reason}
          className={
            value === reason
              ? "confirm-sheet__choice is-selected"
              : "confirm-sheet__choice"
          }
          onClick={() => onChange(reason)}
        >
          {labelFor(reason, copy)}
        </button>
      ))}
    </div>
  );
}
