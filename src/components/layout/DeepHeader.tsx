import { navigateBack } from "@/lib/navBack";
import { useDanLocale } from "@/i18n/locale";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import "./layout.css";

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  fallbackTo?: string;
  onBack?: () => void;
};

export function DeepHeader({ title, subtitle, right, fallbackTo = "/", onBack }: Props) {
  const navigate = useNavigate();
  const locale = useDanLocale();
  const backLabel = locale === "ja" ? "戻る" : "뒤로가기";

  return (
    <header className="deep-header">
      <button
        type="button"
        className="deep-header__back"
        aria-label={backLabel}
        onClick={() => {
          if (onBack) {
            onBack();
            return;
          }
          navigateBack(navigate, fallbackTo);
        }}
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
