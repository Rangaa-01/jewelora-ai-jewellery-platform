import { CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface StateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: StateProps) {
  return (
    <div
      className={cn(
        "border-border-strong bg-bg-muted/40 flex flex-col items-center justify-center rounded-lg border border-dashed text-center",
        compact ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      {Icon && (
        <span className="bg-gold/15 text-accent-text mb-4 inline-flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <h3 className="font-display text-xl">{title}</h3>
      {description && <p className="text-fg-muted mt-2 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something didn't load",
  description = "We couldn't load this right now. Please try again.",
  onRetry,
  action,
  className,
  compact,
}: Omit<StateProps, "icon" | "title"> & { title?: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        "border-danger/30 bg-danger-soft/40 flex flex-col items-center justify-center rounded-lg border text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <span className="bg-danger/10 text-danger mb-4 inline-flex size-12 items-center justify-center rounded-full">
        <CircleAlert className="size-6" aria-hidden />
      </span>
      <h3 className="font-display text-xl">{title}</h3>
      <p className="text-fg-muted mt-2 max-w-md text-sm">{description}</p>
      <div className="mt-6 flex gap-3">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
