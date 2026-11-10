import type { ApiErrorDTO } from "@tracklet /db/schemas";

/**
 * Tiny typed fetch wrapper for the /api/v1 API.
 *
 * - Always sends credentials (the auth server is a different origin and its
 *   session cookies are SameSite=None).
 * - Throws `ApiError` on any non-2xx, carrying the shared error envelope
 *   (code, message, field map, offending resource) so forms and mutations
 *   can branch on typed codes (DUPLICATE, PR_USED_ELSEWHERE, EDIT_LOCKED…).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorDTO["error"]["code"],
    message: string,
    public fields?: Record<string, string>,
    public resource?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const API_BASE_URL = `${process.env.NEXT_PUBLIC_SERVER_URL ?? ""}/api/v1`;

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    ...(json !== undefined
      ? {
          method: rest.method ?? "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(json),
        }
      : {}),
  });

  if (!response.ok) {
    let payload: ApiErrorDTO["error"] | undefined;
    try {
      const body = (await response.json()) as ApiErrorDTO;
      payload = body?.error;
    } catch {
      // Non-JSON error (proxy, offline) — fall through to generic message.
    }
    throw new ApiError(
      response.status,
      payload?.code ?? "SERVER_ERROR",
      payload?.message ?? "Request failed. Please try again.",
      payload?.fields,
      payload?.resource,
    );
  }

  // 204s and empty bodies.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Fetch a binary download (exports) with the same auth/error handling. */
export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
  });
  if (!response.ok) {
    let payload: ApiErrorDTO["error"] | undefined;
    try {
      payload = ((await response.json()) as ApiErrorDTO)?.error;
    } catch {
      // Non-JSON error — fall through to the generic message.
    }
    throw new ApiError(
      response.status,
      payload?.code ?? "SERVER_ERROR",
      payload?.message ?? "Download failed. Please try again.",
    );
  }
  return response.blob();
}
