import type { MiddlewareHandler } from "hono";

import type { ApiEnv } from "../env.api";
import { HttpError } from "../lib/http";

/**
 * FR-AUTH-04/05: every /api/v1 route requires a valid Better Auth session
 * and all queries are scoped server-side to the session user.
 */
export const requireAuth: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    throw new HttpError(401, "UNAUTHORIZED", "Sign in to continue.");
  }

  c.set("userId", session.user.id);
  await next();
};
