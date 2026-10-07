import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "./api/client";

/** Copies backend field-level validation errors onto the matching form fields. Returns true if any matched. */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: Array<Path<T>>,
): boolean {
  if (!isApiError(error)) return false;
  let matched = false;
  for (const fe of error.fieldErrors) {
    const field = fe.field.split(".").pop() as Path<T> | undefined;
    if (field && fields.includes(field)) {
      setError(field, { type: "server", message: fe.message });
      matched = true;
    }
  }
  return matched;
}

export const PHONE_PATTERN = /^\+?[0-9\s\-()]{8,18}$/;
