import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2 rounded-xs", className)}
      aria-label="Jewelora home"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        aria-hidden
        className="text-gold shrink-0 transition-transform duration-500 group-hover:rotate-[30deg]"
      >
        <path d="M16 2 30 12 16 30 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M2 12h28M16 2 10 12l6 18 6-18-6-10M10 12 16 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity=".8"
        />
      </svg>
      {!compact && (
        <span className="font-display text-fg text-xl tracking-[0.08em] sm:text-2xl">
          JEWEL<span className="text-accent-text">ORA</span>
        </span>
      )}
    </Link>
  );
}
