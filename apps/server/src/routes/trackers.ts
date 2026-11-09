import type { Tracker, TrackerPr } from "@tracklet /db/models";

import type {
  TrackerDTO,
  TrackerListDTO,
  TrackerPrDTO,
} from "@tracklet /db/schemas";
import {
  prAddSchema,
  trackerCompleteSchema,
  trackerCreateSchema,
  trackerListQuerySchema,
  trackerUpdateSchema,
} from "@tracklet /db/schemas";
import { parseGitHubPrUrl, parseJiraTicketUrl } from "@tracklet /db/urls";
import { Hono } from "hono";

import type { ApiEnv } from "../env.api";
import { HttpError, handleRoute, parseJson } from "../lib/http";

export const trackers = new Hono<ApiEnv>();

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------

export function toPrDTO(pr: Pick<TrackerPr, keyof TrackerPrDTO>): TrackerPrDTO {
  return {
    id: pr.id,
    url: pr.url,
    repoOwner: pr.repoOwner ?? null,
    repoName: pr.repoName ?? null,
    prNumber: pr.prNumber ?? null,
    addedAt: pr.addedAt.toISOString(),
  };
}

export function toTrackerDTO(
  tracker: Tracker & { prs: TrackerPr[] },
): TrackerDTO {
  const completedAt = tracker.completedAt ?? null;
  return {
    id: tracker.id,
    ticketId: tracker.ticketId,
    ticketIdSource: tracker.ticketIdSource as TrackerDTO["ticketIdSource"],
    jiraUrl: tracker.jiraUrl,
    category: tracker.category as TrackerDTO["category"],
    status: tracker.status as TrackerDTO["status"],
    startedAt: tracker.startedAt.toISOString(),
    completedAt: completedAt?.toISOString() ?? null,
    createdAt: tracker.createdAt.toISOString(),
    updatedAt: tracker.updatedAt.toISOString(),
    prCount: tracker.prs.length,
    prs: tracker.prs.map(toPrDTO),
    cycleTimeMinutes: completedAt
      ? Math.max(
          0,
          Math.round(
            (completedAt.getTime() - tracker.startedAt.getTime()) / 60_000,
          ),
        )
      : null,
  };
}

/** Prisma select that includes every PR (detail responses need them all). */
const withPrs = { prs: { orderBy: { addedAt: "asc" as const } } };

/** Load an owned tracker or 404 — ownership enforced server-side (FR-AUTH-05). */
async function getOwnedTracker(
  db: ApiEnv["Variables"]["db"],
  userId: string,
  id: string,
) {
  const tracker = await db.tracker.findUnique({
    where: { id },
    include: withPrs,
  });
  if (!tracker || tracker.userId !== userId) {
    throw new HttpError(404, "NOT_FOUND", "Tracker not found.");
  }
  return tracker;
}

// ---------------------------------------------------------------------------
// List + create
// ---------------------------------------------------------------------------

trackers.get("/", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");
    const query = trackerListQuerySchema.parse(c.req.query());

    // Cursor pagination on (sort, id): stable while rows are inserted.
    const sortValue = (t: Tracker) => {
      const date =
        query.sort === "completedAt"
          ? (t.completedAt ?? t.startedAt)
          : t[query.sort];
      return date.getTime();
    };

    let cursorFilter: object | undefined;
    if (query.cursor) {
      const [msRaw, id] = atob(query.cursor).split("|");
      const ms = Number(msRaw);
      const cmp = query.order === "desc" ? "lt" : "gt";
      // Wrapped in AND so it can't collide with the search OR below.
      cursorFilter = {
        AND: [
          {
            OR: [
              { [query.sort]: { [cmp]: new Date(ms) } },
              { [query.sort]: new Date(ms), id: { [cmp]: id } },
            ],
          },
        ],
      };
    }

    const rows = await db.tracker.findMany({
      where: {
        userId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.startedFrom || query.startedTo
          ? {
              startedAt: {
                ...(query.startedFrom
                  ? { gte: new Date(query.startedFrom) }
                  : {}),
                ...(query.startedTo ? { lte: new Date(query.startedTo) } : {}),
              },
            }
          : {}),
        ...(query.completedFrom || query.completedTo
          ? {
              completedAt: {
                ...(query.completedFrom
                  ? { gte: new Date(query.completedFrom) }
                  : {}),
                ...(query.completedTo
                  ? { lte: new Date(query.completedTo) }
                  : {}),
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { ticketId: { contains: query.search.toUpperCase() } },
                {
                  prs: {
                    some: {
                      OR: [
                        {
                          urlNormalized: {
                            contains: query.search.toLowerCase(),
                          },
                        },
                        { repoName: { contains: query.search } },
                        ...(Number.isFinite(Number(query.search))
                          ? [{ prNumber: Number(query.search) }]
                          : []),
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
        ...cursorFilter,
      },
      include: withPrs,
      orderBy: [
        { [query.sort]: query.order },
        { id: query.order },
      ],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last ? btoa(`${sortValue(last)}|${last.id}`) : null;

    const body: TrackerListDTO = {
      items: page.map(toTrackerDTO),
      nextCursor,
    };
    return c.json(body);
  });
});

trackers.post("/", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");
    const input = trackerCreateSchema.parse(await parseJson(c.req.raw));

    // FR-TRK-05: a manually supplied ID is stored with its own source marker.
    let ticketId: string;
    let ticketIdSource: TrackerDTO["ticketIdSource"];
    let normalized: string | null;

    if (input.ticketId) {
      ticketId = input.ticketId.toUpperCase();
      ticketIdSource = "MANUAL";
      const ref = parseJiraTicketUrl(input.jiraUrl);
      normalized = ref?.normalized ?? null;
    } else {
      const ref = parseJiraTicketUrl(input.jiraUrl);
      if (!ref) {
        throw new HttpError(
          422,
          "VALIDATION_ERROR",
          "That doesn't look like a Jira issue URL. Paste the ticket URL or enter the ID manually.",
          { jiraUrl: "Unsupported Jira URL format" },
        );
      }
      ticketId = ref.ticketId;
      ticketIdSource = "PARSED";
      normalized = ref.normalized;
    }

    // FR-TRK-09: block duplicates unless the client explicitly confirmed.
    const existing = await db.tracker.findUnique({
      where: { userId_ticketId: { userId, ticketId } },
      include: { prs: true },
    });
    if (existing && !input.allowDuplicate) {
      throw new HttpError(
        409,
        "DUPLICATE",
        `You already track ${ticketId}. Create anyway?`,
        undefined,
        toTrackerDTO(existing),
      );
    }

    const tracker = await db.tracker.create({
      data: {
        userId,
        ticketId,
        ticketIdSource,
        jiraUrl: input.jiraUrl,
        jiraUrlNormalized: normalized,
        category: input.category,
        status: "OPEN", // FR-TRK-08
      },
      include: withPrs,
    });

    return c.json(toTrackerDTO(tracker), 201);
  });
});

// ---------------------------------------------------------------------------
// Detail + edit + delete
// ---------------------------------------------------------------------------

trackers.get("/:id", async (c) => {
  return handleRoute(async () => {
    const tracker = await getOwnedTracker(c.get("db"), c.get("userId"), c.req.param("id"));
    return c.json(toTrackerDTO(tracker));
  });
});

trackers.patch("/:id", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const tracker = await getOwnedTracker(db, c.get("userId"), c.req.param("id"));
    const input = trackerUpdateSchema.parse(await parseJson(c.req.raw));

    // Editing rules (FR-TRK-13/14): category and start date are locked once
    // completed so cycle time and analytics stay trustworthy.
    if (tracker.status === "COMPLETED") {
      throw new HttpError(
        409,
        "EDIT_LOCKED",
        "Completed trackers are read-only.",
      );
    }

    const updated = await db.tracker.update({
      where: { id: tracker.id },
      data: {
        ...(input.category ? { category: input.category } : {}),
        ...(input.startedAt ? { startedAt: new Date(input.startedAt) } : {}),
      },
      include: withPrs,
    });
    return c.json(toTrackerDTO(updated));
  });
});

trackers.delete("/:id", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const tracker = await getOwnedTracker(db, c.get("userId"), c.req.param("id"));
    await db.tracker.delete({ where: { id: tracker.id } });
    return c.json({ id: tracker.id });
  });
});

// ---------------------------------------------------------------------------
// Completion + PR references
// ---------------------------------------------------------------------------

/**
 * FR-CLOSE-02..08: validate PR URLs, store references, then mark completed
 * with a timestamp — only on explicit confirmation from the client.
 * Idempotent (FR-CLOSE-06): completing a completed tracker returns its
 * current state and never moves `completedAt`.
 */
trackers.post("/:id/complete", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");
    const tracker = await getOwnedTracker(db, userId, c.req.param("id"));
    const input = trackerCompleteSchema.parse(await parseJson(c.req.raw));

    const refs = input.prUrls
      .map((url) => ({ raw: url, ref: parseGitHubPrUrl(url) }))
      .map(({ raw, ref }) => {
        if (!ref) {
          throw new HttpError(
            422,
            "VALIDATION_ERROR",
            "PR URLs must look like https://github.com/{owner}/{repo}/pull/{number}.",
            { prUrls: `Invalid GitHub PR URL: ${raw}` },
          );
        }
        return ref;
      });

    if (refs.length === 0) {
      throw new HttpError(422, "VALIDATION_ERROR", "Add at least one PR URL.", {
        prUrls: "Add at least one PR URL",
      });
    }

    // FR-PR-06: warn (confirmable 409) when a PR already belongs to another
    // tracker of the same user, unless the client sent force=true.
    if (!input.force) {
      const seen = new Set<string>();
      for (const ref of refs) {
        if (seen.has(ref.normalized)) continue;
        seen.add(ref.normalized);
        const elsewhere = await db.trackerPr.findFirst({
          where: {
            userId,
            urlNormalized: ref.normalized,
            trackerId: { not: tracker.id },
          },
          include: { tracker: { select: { ticketId: true } } },
        });
        if (elsewhere) {
          throw new HttpError(
            409,
            "PR_USED_ELSEWHERE",
            `${ref.normalized} is already referenced by ${elsewhere.tracker.ticketId}. Close anyway?`,
            undefined,
            { ticketId: elsewhere.tracker.ticketId },
          );
        }
      }
    }

    // Sequential writes (the D1 adapter has no interactive transactions).
    // Upsert keeps re-closing idempotent (FR-CLOSE-06): a PR already on this
    // tracker is a no-op, and completing an already-completed tracker never
    // moves completedAt.
    for (const ref of refs) {
      await db.trackerPr.upsert({
        where: {
          trackerId_urlNormalized: {
            trackerId: tracker.id,
            urlNormalized: ref.normalized,
          },
        },
        create: {
          trackerId: tracker.id,
          userId,
          url: ref.normalized,
          urlNormalized: ref.normalized,
          repoOwner: ref.owner,
          repoName: ref.repo,
          prNumber: ref.prNumber,
        },
        update: {},
      });
    }
    const wasOpen = tracker.status === "OPEN";
    const completed = await db.tracker.update({
      where: { id: tracker.id },
      data: {
        status: "COMPLETED",
        ...(wasOpen ? { completedAt: new Date() } : {}),
      },
      include: withPrs,
    });

    return c.json(toTrackerDTO(completed));
  });
});

/**
 * FR-CLOSE-08: PR references may be added after completion — the tracker's
 * completion date is never touched; the PR carries its own addedAt.
 */
trackers.post("/:id/prs", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const userId = c.get("userId");
    const tracker = await getOwnedTracker(db, userId, c.req.param("id"));
    const input = prAddSchema.parse(await parseJson(c.req.raw));

    const ref = parseGitHubPrUrl(input.url);
    if (!ref) {
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "PR URLs must look like https://github.com/{owner}/{repo}/pull/{number}.",
        { url: "Unsupported GitHub PR URL" },
      );
    }

    // FR-PR-06: same URL twice on this tracker → 409.
    const dupOnTracker = await db.trackerPr.findUnique({
      where: {
        trackerId_urlNormalized: { trackerId: tracker.id, urlNormalized: ref.normalized },
      },
    });
    if (dupOnTracker) {
      throw new HttpError(409, "DUPLICATE", "This PR is already on the tracker.");
    }

    // FR-PR-06: same URL on another tracker of this user → confirmable 409.
    if (!input.force) {
      const elsewhere = await db.trackerPr.findFirst({
        where: { userId, urlNormalized: ref.normalized, trackerId: { not: tracker.id } },
        include: { tracker: { select: { ticketId: true } } },
      });
      if (elsewhere) {
        throw new HttpError(
          409,
          "PR_USED_ELSEWHERE",
          `This PR is already referenced by ${elsewhere.tracker.ticketId}. Add it here too?`,
          undefined,
          { ticketId: elsewhere.tracker.ticketId },
        );
      }
    }

    await db.trackerPr.create({
      data: {
        trackerId: tracker.id,
        userId,
        url: ref.normalized,
        urlNormalized: ref.normalized,
        repoOwner: ref.owner,
        repoName: ref.repo,
        prNumber: ref.prNumber,
      },
    });

    // Return the fresh tracker so React Query can swap the cached detail in
    // one round trip (no refetch).
    const fresh = await db.tracker.findUnique({
      where: { id: tracker.id },
      include: withPrs,
    });
    return c.json(toTrackerDTO(fresh!));
  });
});

trackers.delete("/:id/prs/:prId", async (c) => {
  return handleRoute(async () => {
    const db = c.get("db");
    const tracker = await getOwnedTracker(db, c.get("userId"), c.req.param("id"));

    const pr = await db.trackerPr.findUnique({
      where: { id: c.req.param("prId") },
    });
    if (!pr || pr.trackerId !== tracker.id) {
      throw new HttpError(404, "NOT_FOUND", "PR reference not found.");
    }

    await db.trackerPr.delete({ where: { id: pr.id } });

    const fresh = await db.tracker.findUnique({
      where: { id: tracker.id },
      include: withPrs,
    });
    return c.json(toTrackerDTO(fresh!));
  });
});
