/**
 * API contracts shared by the Hono server (validation) and the web app
 * (types). DTOs are JSON-shaped: dates are ISO strings, numbers are numbers.
 * Shaped for React Query consumption — stable, flat, cache-key friendly.
 */
import { z } from "zod";

/** §8.2: exactly one user-selected category. */
export const TRACKER_CATEGORIES = ["DEVELOPMENT", "SUPPORT"] as const;
export type TrackerCategory = (typeof TRACKER_CATEGORIES)[number];

/** IST-only product (UTC+05:30, no DST) — analytics month buckets use IST. */
export const IST_OFFSET_MINUTES = 330;

/** FR-TRK-08 / FR-CLOSE-05. */
export const TRACKER_STATUSES = ["OPEN", "COMPLETED"] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

/** FR-TRK-05: how the ticket ID was obtained. */
export const TICKET_ID_SOURCES = ["PARSED", "MANUAL"] as const;
export type TicketIdSource = (typeof TICKET_ID_SOURCES)[number];

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * POST /trackers — either a validated Jira URL (parsed server-side) or an
 * explicitly manual ticket ID (FR-TRK-05). `allowDuplicate` is only accepted
 * when the client has already confirmed the FR-TRK-09 warning.
 */
export const trackerCreateSchema = z
  .object({
    jiraUrl: z.string().trim().min(1, "Paste your Jira ticket URL"),
    category: z.enum(TRACKER_CATEGORIES),
    ticketId: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z][A-Za-z0-9]*-\d+$/,
        "Ticket ID looks like DEV-123",
      )
      .optional(),
    allowDuplicate: z.boolean().optional().default(false),
  })
  .refine((v) => v.ticketId !== undefined || v.jiraUrl.length > 0, {
    message: "A Jira URL or manual ticket ID is required",
    path: ["ticketId"],
  });

/** PATCH /trackers/:id — allowed while OPEN only (FR-TRK-13/14). */
export const trackerUpdateSchema = z
  .object({
    category: z.enum(TRACKER_CATEGORIES).optional(),
    startedAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((v) => v.category !== undefined || v.startedAt !== undefined, {
    message: "Nothing to update",
  });

/** POST /trackers/:id/complete — close flow (FR-CLOSE-02). */
export const trackerCompleteSchema = z.object({
  prUrls: z
    .array(z.string().trim().min(1, "Add at least one PR URL"))
    .min(1, "Add at least one PR URL"),
  force: z.boolean().optional().default(false),
});

/** POST /trackers/:id/prs — single PR reference (FR-CLOSE-08). */
export const prAddSchema = z.object({
  url: z.string().trim().min(1, "Paste a GitHub PR URL"),
  force: z.boolean().optional().default(false),
});

/** GET /trackers — list query params (FR-SEARCH-01..05). */
export const trackerListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.enum(TRACKER_CATEGORIES).optional(),
  status: z.enum(TRACKER_STATUSES).optional(),
  /** ISO dates (inclusive). Which field they apply to is explicit. */
  startedFrom: z.string().datetime({ offset: true }).optional(),
  startedTo: z.string().datetime({ offset: true }).optional(),
  completedFrom: z.string().datetime({ offset: true }).optional(),
  completedTo: z.string().datetime({ offset: true }).optional(),
  /** startedAt | completedAt | createdAt */
  sort: z
    .enum(["startedAt", "completedAt", "createdAt"])
    .optional()
    .default("startedAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().max(512).optional(),
});

/** GET /dashboard?from=&to= — defaults to the current month (FR-DASH-02). */
export const dashboardQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

/** GET /analytics?from=&to=&granularity=week|month — same date rules as the dashboard. */
export const analyticsQuerySchema = dashboardQuerySchema.extend({
  granularity: z.enum(["week", "month"]).default("month"),
});

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type TrackerPrDTO = {
  id: string;
  url: string;
  repoOwner: string | null;
  repoName: string | null;
  prNumber: number | null;
  addedAt: string;
};

export type TrackerDTO = {
  id: string;
  ticketId: string;
  ticketIdSource: TicketIdSource;
  jiraUrl: string;
  category: TrackerCategory;
  status: TrackerStatus;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Convenience: unique stored PR references (FR-PR-05). */
  prCount: number;
  prs: TrackerPrDTO[];
  /** §11 cycle time in minutes, present once completed (FR-TRK-12). */
  cycleTimeMinutes: number | null;
};

/** List endpoint envelope — pairs with useInfiniteQuery cursors. */
export type TrackerListDTO = {
  items: TrackerDTO[];
  nextCursor: string | null;
};

/**
 * One bucket of the analytics series (date bases stated in FR-AN-04).
 * Buckets are IST calendar months ("YYYY-MM") or IST weeks ("YYYY-MM-DD",
 * week-start Monday) depending on the requested granularity.
 */
export type AnalyticsSeriesDTO = {
  /** IST bucket key: "YYYY-MM" (month) or week-start "YYYY-MM-DD" (week). */
  bucket: string;
  /** Trackers started this month (startedAt basis). */
  started: number;
  /** Trackers completed this month (completedAt basis). */
  completed: number;
  /** Of the started ones (startedAt basis). */
  development: number;
  support: number;
  /** Unique PR references added this month (PR addedAt basis, not "merged"). */
  uniquePrs: number;
  /** Avg cycle time of trackers completed this month. */
  avgCycleTimeMinutes: number | null;
};

/** GET /analytics — everything the Analytics page needs in one response. */
export type AnalyticsDTO = {
  range: { from: string; to: string };
  /** FR-AN-06: started in range (startedAt basis). */
  started: number;
  /** FR-AN-05: completed in range (completedAt basis). */
  completed: number;
  /** FR-AN-07: category split of started-in-range, with percentages. */
  development: number;
  support: number;
  /** FR-AN-08: unique PR references added in range (addedAt basis). */
  uniquePrs: number;
  /** FR-AN-09: avg cycle time of completed-in-range. */
  avgCycleTimeMinutes: number | null;
  /** FR-AN-10: current open-tracker snapshot (now − startedAt). */
  openAgeDays: { count: number; average: number | null; oldest: number | null };
  /** IST bucket series across the range (capped at the last 12 buckets). */
  series: AnalyticsSeriesDTO[];
};

export type DashboardTotalsDTO = {
  total: number;
  completed: number;
  open: number;
  development: number;
  support: number;
  uniquePrs: number;
  avgCycleTimeMinutes: number | null;
};

export type DashboardDTO = {
  range: { from: string; to: string };
  totals: DashboardTotalsDTO;
  recentCreated: TrackerDTO[];
  recentCompleted: TrackerDTO[];
};

/** Error envelope — every non-2xx body is exactly this shape. */
export type ApiErrorDTO = {
  error: {
    code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "VALIDATION_ERROR"
      | "DUPLICATE"
      | "PR_USED_ELSEWHERE"
      | "EDIT_LOCKED"
      | "RATE_LIMITED"
      | "SERVER_ERROR";
    message: string;
    /** Field-level messages for form mapping (zod path → message). */
    fields?: Record<string, string>;
    /** Offending resource for duplicate-confirmation flows (FR-TRK-09/PR-06). */
    resource?: unknown;
  };
};
