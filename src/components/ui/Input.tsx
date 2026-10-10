import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDanLocale, type DanLocale } from "@/i18n/locale";
import "./ui.css";

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="dan-field">
      <span className="dan-field__label">{label}</span>
      {children}
      {hint ? <span className="dan-field__hint">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="dan-input" {...props} />;
}

type DatetimeLocalInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: string;
  /** BCP 47 language for the native picker; defaults to active DAN locale. */
  language?: DanLocale;
};

/** Native datetime-local with locale-aware empty placeholder (hides mm/dd/yyyy ghost). */
export function DatetimeLocalInput({
  value,
  onChange,
  placeholder,
  required,
  min,
  language,
}: DatetimeLocalInputProps) {
  const locale = useDanLocale();
  const copy = useDanCopy();
  const lang = language ?? locale;
  const empty = !value.trim();
  const resolvedPlaceholder = placeholder ?? copy.datetimePh;
  return (
    <span className={empty ? "datetime-local is-empty" : "datetime-local"}>
      {empty ? (
        <span className="datetime-local__ph" aria-hidden="true">
          {resolvedPlaceholder}
        </span>
      ) : null}
      <input
        className="dan-input datetime-local__input"
        type="datetime-local"
        lang={lang === "ja" ? "ja-JP" : "ko-KR"}
        step={60}
        value={value}
        min={min}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

export function TextSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="dan-input dan-select" {...props} />;
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="dan-chip-group">{children}</div>;
}

type ChipProps = {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
};

export function Chip({ selected, onClick, children, disabled, title }: ChipProps) {
  return (
    <button
      type="button"
      className={["dan-chip", selected ? "dan-chip--selected" : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
