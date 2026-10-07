"use client";

import Link, { type LinkProps } from "next/link";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "outline" | "ghost" | "link" | "inverse" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium tracking-wide transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out)] select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none active:scale-[0.985]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gold text-ink shadow-gold hover:bg-gold-bright hover:shadow-md border border-gold-deep/30",
  outline: "border border-border-strong text-fg hover:border-fg hover:bg-bg-elevated",
  ghost: "text-fg hover:bg-bg-muted",
  link: "text-accent-text underline-offset-4 hover:underline px-0 h-auto",
  inverse: "bg-bg-inverse text-fg-inverse hover:bg-fg-soft",
  danger: "bg-danger text-white hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-xs uppercase tracking-[0.14em]",
  md: "h-11 px-6 text-sm",
  lg: "h-13 px-8 text-base",
  icon: "h-11 w-11 p-0",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
export type ButtonLinkProps<R> = CommonProps & LinkProps<R>;

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: Pick<CommonProps, "variant" | "size" | "className">): string {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    loading = false,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

/** Anchor styled as a button; use for navigation. */
export function ButtonLink<R>({
  variant,
  size,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps<R>) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
