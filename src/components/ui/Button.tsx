import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import "./ui.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm" | "lg";

type Common = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };

type ButtonAsLink = Common &
  Omit<LinkProps, "className" | "children"> & { to: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: Common) {
  return [
    "dan-btn",
    `dan-btn--${variant}`,
    `dan-btn--${size}`,
    fullWidth ? "dan-btn--block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonProps) {
  const cls = buttonClassName(props);

  if (props.to != null) {
    const { to, children, variant, size, fullWidth, className, ...rest } = props;
    void variant;
    void size;
    void fullWidth;
    void className;
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  const {
    children,
    variant,
    size,
    fullWidth,
    className,
    type = "button",
    ...rest
  } = props;
  void variant;
  void size;
  void fullWidth;
  void className;
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
