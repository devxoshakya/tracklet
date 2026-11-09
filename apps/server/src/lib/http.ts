import { z } from "zod";

import type { ApiErrorDTO } from "@tracklet /db/schemas";
import { ZodError } from "zod";

/**
 * Thrown by route handlers; converted to the shared ApiErrorDTO envelope by
 * `handleRoute`. React Query consumers get a stable shape to branch on.
 */
export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    public code: ApiErrorDTO["error"]["code"],
    message: string,
    public fields?: Record<string, string>,
    public resource?: unknown,
  ) {
    super(message);
  }
}

/** Map a ZodError to field-level messages for form consumers. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Wrap a handler so every throw becomes a consistent JSON error response. */
export async function handleRoute<T>(
  fn: () => Promise<T>,
): Promise<T | Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) {
      const body: ApiErrorDTO = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
          ...(error.resource !== undefined ? { resource: error.resource } : {}),
        },
      };
      return new Response(JSON.stringify(body), {
        status: error.status,
        headers: { "content-type": "application/json" },
      });
    }
    if (error instanceof z.ZodError) {
      const body: ApiErrorDTO = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields.",
          fields: zodFields(error),
        },
      };
      return new Response(JSON.stringify(body), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("[api] unexpected error", error);
    const body: ApiErrorDTO = {
      error: { code: "SERVER_ERROR", message: "Something went wrong." },
    };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/** Safe JSON body parse — malformed bodies become a 422, not a 500. */
export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(422, "VALIDATION_ERROR", "Request body must be JSON.");
  }
}
