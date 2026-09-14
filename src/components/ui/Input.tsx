import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
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
