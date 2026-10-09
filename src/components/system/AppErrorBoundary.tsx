import { Component, type ErrorInfo, type ReactNode } from "react";
import { getLocale } from "@/i18n/locale";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

const copy = {
  ko: {
    title: "화면을 불러오지 못했어요",
    body: "입력 중이던 내용은 다시 확인해야 할 수 있어요. 새로고침해도 같은 문제가 계속되면 홈에서 다시 시작해 주세요.",
    reload: "다시 불러오기",
    home: "홈으로",
  },
  ja: {
    title: "画面を表示できませんでした",
    body: "入力中の内容は再度確認が必要になることがあります。再読み込みしても続く場合は、ホームからやり直してください。",
    reload: "再読み込み",
    home: "ホームへ",
  },
} as const;

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep the UI recoverable even when no external telemetry provider is
    // configured. Production telemetry can hook into this boundary later
    // without changing the user-facing recovery path.
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    const base = import.meta.env.BASE_URL || "/";
    window.location.assign(base);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = copy[getLocale()];

    return (
      <main className="fatal-error" role="alert" aria-live="assertive">
        <div className="fatal-error__card">
          <span className="fatal-error__mark" aria-hidden>
            DAN
          </span>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
          <div className="fatal-error__actions">
            <button type="button" onClick={this.reload}>
              {t.reload}
            </button>
            <button type="button" className="is-secondary" onClick={this.goHome}>
              {t.home}
            </button>
          </div>
        </div>
      </main>
    );
  }
}
