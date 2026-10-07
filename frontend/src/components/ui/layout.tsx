import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("container-x", className)} {...rest} />;
}

interface SectionProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article" | "aside";
  tone?: "default" | "muted" | "inverse" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
}

const tones = {
  default: "",
  muted: "bg-bg-muted",
  inverse: "bg-bg-inverse text-fg-inverse",
  elevated: "bg-bg-elevated",
} as const;

const paddings = {
  none: "",
  sm: "py-10 md:py-14",
  md: "py-16 md:py-24",
  lg: "py-24 md:py-32",
} as const;

export function Section({
  as: Tag = "section",
  tone = "default",
  padding = "md",
  className,
  ...rest
}: SectionProps) {
  return <Tag className={cn("relative", tones[tone], paddings[padding], className)} {...rest} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  action,
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 md:mb-14",
        align === "center"
          ? "items-center text-center"
          : "items-start text-left md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <Tag className="text-3xl leading-tight text-balance md:text-5xl">{title}</Tag>
        {description && (
          <p className="text-fg-muted mt-4 text-base text-pretty md:text-lg">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Hairline({ className }: { className?: string }) {
  return <div aria-hidden className={cn("hairline w-full", className)} />;
}
