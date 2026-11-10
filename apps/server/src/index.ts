import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { ENV } from "./env.server";
import type { ApiEnv } from "./env.api";
import { withServices } from "./env.api";
import { toErrorResponse } from "./lib/http";
import { requireAuth } from "./middleware/auth";
import { createAuth } from "./services";
import { analytics } from "./routes/analytics";
import { dashboard } from "./routes/dashboard";
import { trackers } from "./routes/trackers";

const app = new Hono<ApiEnv>();

app.use(logger());
// Middleware throws (401 from requireAuth, failures in withServices, zod
// parsing in handlers) all funnel into the shared JSON error envelope.
app.onError((error) => toErrorResponse(error));
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    // PATCH/DELETE are needed for tracker edits and PR reference removal.
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => (await createAuth()).handler(c.req.raw));

// Authenticated JSON API (FR-AUTH-04): session required, ownership enforced
// server-side, responses shaped for React Query (stable DTOs + error envelope).
const api = new Hono<ApiEnv>();
api.use("*", withServices);
api.use("*", requireAuth);
api.route("/trackers", trackers);
api.route("/dashboard", dashboard);
api.route("/analytics", analytics);
app.route("/api/v1", api);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
