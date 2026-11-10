import type { createAuth as CreateAuthFn } from "@tracklet/auth";
import type { Database } from "@tracklet/db";
import type { MiddlewareHandler } from "hono";

import { createAuth, getDb } from "./services";

/**
 * Hono context variables available to /api/v1 routes.
 */
export type ApiEnv = {
  Variables: {
    userId: string;
    db: Database;
    auth: Awaited<ReturnType<typeof CreateAuthFn>>;
  };
};

/** Sets the shared context (db + auth) before route handlers run. */
export const withServices: MiddlewareHandler<ApiEnv> = async (c, next) => {
  c.set("db", getDb());
  c.set("auth", await createAuth());
  await next();
};
