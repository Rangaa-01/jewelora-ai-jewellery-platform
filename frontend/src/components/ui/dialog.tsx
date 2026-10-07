"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([type="hidden"]):not([disabled]), select, [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** `center` renders a modal card; `right`/`left`/`bottom` render a Sheet. */
  side?: "center" | "right" | "left" | "bottom";
  size?: "sm" | "md" | "lg";
  hideTitle?: boolean;
  className?: string;
}

const sizeClasses = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" } as const;

/**
 * Accessible modal built on the native <dialog> element: focus is trapped, Escape closes,
 * backdrop click closes and body scroll is locked while open.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "center",
  size = "md",
  hideTitle = false,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const lastFocused = useRef<Element | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      lastFocused.current = document.activeElement;
      el.showModal();
      document.body.style.overflow = "hidden";
      const first =
        el.querySelector<HTMLElement>("[data-autofocus]") ??
        el.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    } else if (!open && el.open) {
      el.close();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = useCallback(() => {
    document.body.style.overflow = "";
    onClose();
    const target = lastFocused.current;
    if (target instanceof HTMLElement) target.focus();
  }, [onClose]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab" || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const sideClasses: Record<NonNullable<DialogProps["side"]>, string> = {
    center: cn("m-auto w-[calc(100%-2rem)] rounded-lg", sizeClasses[size]),
    right: "ml-auto mr-0 my-0 h-dvh max-h-dvh w-[min(100%,26rem)] rounded-none",
    left: "mr-auto ml-0 my-0 h-dvh max-h-dvh w-[min(100%,26rem)] rounded-none",
    bottom: "mt-auto mb-0 mx-auto w-full max-w-3xl max-h-[90dvh] rounded-t-xl",
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={handleClose}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === ref.current) handleClose();
      }}
      className={cn(
        "bg-bg-elevated text-fg backdrop:bg-ink/55 fixed inset-0 overflow-hidden p-0 shadow-lg backdrop:backdrop-blur-[2px] open:flex open:flex-col",
        sideClasses[side],
        className,
      )}
    >
      <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className={cn("font-display text-xl", hideTitle && "sr-only")}>
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-fg-muted mt-1 text-sm">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="touch-target text-fg-muted hover:bg-bg-muted hover:text-fg -mt-2 -mr-2 inline-flex items-center justify-center rounded-sm"
          aria-label="Close"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="border-border border-t px-5 py-4">{footer}</div>}
    </dialog>
  );
}

export function Sheet(props: Omit<DialogProps, "side"> & { side?: "right" | "left" | "bottom" }) {
  return <Dialog {...props} side={props.side ?? "right"} />;
}
