import type { HTMLAttributes, ReactNode } from "react";
import "./ui.css";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padded?: boolean;
  interactive?: boolean;
};

export function Card({
  children,
  className = "",
  padded = true,
  interactive = false,
  ...rest
}: Props) {
  return (
    <div
      className={[
        "dan-card",
        padded ? "dan-card--padded" : "",
        interactive ? "dan-card--interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
