import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DeepHeaderConfig = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Hide AppShell deep header — page renders its own (e.g. chat). */
  hide?: boolean;
};

type ShellChromeValue = {
  header: DeepHeaderConfig | null;
  setHeader: (next: DeepHeaderConfig | null) => void;
};

const ShellChromeContext = createContext<ShellChromeValue | null>(null);

export function ShellChromeProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<DeepHeaderConfig | null>(null);
  const setHeader = useCallback((next: DeepHeaderConfig | null) => {
    setHeaderState(next);
  }, []);
  const value = useMemo(() => ({ header, setHeader }), [header, setHeader]);
  return (
    <ShellChromeContext.Provider value={value}>
      {children}
    </ShellChromeContext.Provider>
  );
}

export function useShellChrome() {
  const ctx = useContext(ShellChromeContext);
  if (!ctx) {
    throw new Error("useShellChrome must be used within ShellChromeProvider");
  }
  return ctx;
}

/** Register deep-header content for the current page; clears on unmount. */
export function useDeepHeader(config: DeepHeaderConfig) {
  const { setHeader } = useShellChrome();
  const title = config.title ?? "";
  const subtitle = config.subtitle ?? "";
  const hide = Boolean(config.hide);

  useEffect(() => {
    setHeader({ title: config.title, subtitle: config.subtitle, hide, right: config.right });
    return () => setHeader(null);
    // right intentionally omitted from deps to avoid render loops from inline nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeader, title, subtitle, hide]);
}
