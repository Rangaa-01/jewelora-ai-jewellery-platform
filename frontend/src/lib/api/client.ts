import type { ApiErrorBody } from "./types";

export const API_BASE = "/api/v1";
export const CSRF_HEADER = { "X-Requested-With": "jewelora" } as const;

const FRIENDLY_MESSAGES: Record<string, string> = {
  network_error: "We couldn't reach Jewelora. Please check your connection and try again.",
  internal_error: "Something went wrong on our side. Please try again.",
  not_found: "We couldn't find what you were looking for.",
  unauthenticated: "Please sign in to continue.",
  forbidden: "You don't have permission to do that.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  validation_error: "Some of the information provided is not valid.",
  csrf_rejected: "Your session needs a refresh. Please reload the page and try again.",
};

export interface FieldError {
  field: string;
  message: string;
}

/** Error raised for any non-2xx response or network failure. `message` is always safe to show. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get fieldErrors(): FieldError[] {
    if (!Array.isArray(this.details)) return [];
    return this.details.filter(
      (d): d is FieldError => typeof d === "object" && d !== null && "field" in d && "message" in d,
    );
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Returns a customer-safe message for any thrown value. */
export function errorMessage(error: unknown, fallback = FRIENDLY_MESSAGES.internal_error!): string {
  if (isApiError(error)) return error.message;
  return fallback;
}

export type QueryValue = string | number | boolean | undefined | null | Array<string | number>;

export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, String(v));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Base URL override for server-side calls. Defaults to same-origin `/api/v1`. */
  baseUrl?: string;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = undefined;
  }
  const code = body?.error?.code ?? (response.status === 404 ? "not_found" : "internal_error");
  const message =
    body?.error?.message ?? FRIENDLY_MESSAGES[code] ?? FRIENDLY_MESSAGES.internal_error!;
  return new ApiError(
    response.status,
    code,
    message,
    body?.error?.details,
    body?.error?.request_id,
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, signal, headers = {}, baseUrl = API_BASE } = options;
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    signal,
    headers: {
      Accept: "application/json",
      ...(method !== "GET" ? CSRF_HEADER : {}),
      ...(body !== undefined && !formData ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };
  if (formData) init.body = formData;
  else if (body !== undefined) init.body = JSON.stringify(body);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "network_error", FRIENDLY_MESSAGES.network_error!);
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
  upload: <T>(path: string, formData: FormData, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "POST", formData }),
};
