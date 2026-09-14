import { navigateBack } from "@/lib/navBack";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import "./layout.css";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  fallbackTo?: string;
};

export function DeepHeader({ title, subtitle, right, fallbackTo = "/" }: Props) {
  const navigate = useNavigate();

  return (
    <header className="deep-header">
      <button
        type="button"
        className="deep-header__back"
        aria-label="뒤로가기"
        onClick={() => navigateBack(navigate, fallbackTo)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 5 8 12l7 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="deep-header__center">
        <h1 className="deep-header__title">{title}</h1>
        {subtitle ? <p className="deep-header__sub">{subtitle}</p> : null}
      </div>
      <div className="deep-header__right">{right ?? null}</div>
    </header>
  );
}
