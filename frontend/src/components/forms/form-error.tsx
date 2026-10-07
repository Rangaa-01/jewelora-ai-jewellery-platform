import { CircleAlert } from "lucide-react";
import { errorMessage, isApiError } from "@/lib/api/client";

/** Inline, customer-safe error banner for forms. Maps 404 (feature not yet available) honestly. */
export function FormError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const message =
    isApiError(error) && error.status === 404
      ? "This service isn't available right now. Please try again later or contact the store."
      : errorMessage(error);
  return (
    <p
      role="alert"
      className={`border-danger/30 bg-danger-soft text-danger flex items-start gap-2 rounded-sm border px-3 py-2.5 text-sm ${className ?? ""}`}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
