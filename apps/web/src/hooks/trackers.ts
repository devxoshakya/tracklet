"use client";

import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";

import type {
  AnalyticsDTO,
  DashboardDTO,
  TrackerDTO,
  TrackerListDTO,
} from "@tracklet /db/schemas";

import { api } from "@/lib/api";

/**
 * React Query data-access layer for /api/v1.
 *
 * Conventions that keep the cache predictable:
 * - Every query key hangs off `trackerKeys.all` so mutations invalidate with
 *   one call.
 * - List endpoints are cursor-paginated and pair with `useInfiniteQuery`.
 * - Mutations return the full updated tracker (single round trip), which we
 *   write straight into the detail cache — no refetch after most actions.
 */

export type TrackerFilters = {
  search?: string;
  category?: "DEVELOPMENT" | "SUPPORT";
  status?: "OPEN" | "COMPLETED";
  sort?: "startedAt" | "completedAt" | "createdAt";
  order?: "asc" | "desc";
  startedFrom?: string;
  startedTo?: string;
  completedFrom?: string;
  completedTo?: string;
  limit?: number;
};

export const trackerKeys = {
  all: ["trackers"] as const,
  lists: () => [...trackerKeys.all, "list"] as const,
  list: (filters: TrackerFilters) => [...trackerKeys.lists(), filters] as const,
  detail: (id: string) => [...trackerKeys.all, "detail", id] as const,
  dashboard: (from?: string, to?: string) =>
    ["dashboard", { from: from ?? null, to: to ?? null }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function trackersListQuery(filters: TrackerFilters) {
  return {
    queryKey: trackerKeys.list(filters),
    queryFn: ({ pageParam }: { pageParam?: string }) => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.order) params.set("order", filters.order);
      if (filters.startedFrom) params.set("startedFrom", filters.startedFrom);
      if (filters.startedTo) params.set("startedTo", filters.startedTo);
      if (filters.completedFrom) params.set("completedFrom", filters.completedFrom);
      if (filters.completedTo) params.set("completedTo", filters.completedTo);
      if (filters.limit) params.set("limit", String(filters.limit));
      if (pageParam) params.set("cursor", String(pageParam));
      const qs = params.toString();
      return api<TrackerListDTO>(`/trackers${qs ? `?${qs}` : ""}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TrackerListDTO) =>
      lastPage.nextCursor ?? undefined,
  };
}

export function trackerDetailQuery(id: string) {
  return queryOptions({
    queryKey: trackerKeys.detail(id),
    queryFn: () => api<TrackerDTO>(`/trackers/${id}`),
    enabled: Boolean(id),
  });
}

/** IST-only product (UTC+05:30, no DST) — all calendar math uses IST. */
export const IST_MS = 330 * 60_000;

/**
 * IST calendar anchor: a Date whose UTC parts are the IST calendar parts
 * (e.g. 2026-11-01T00:00Z represents 1 Nov 2026 IST). Shifted-space math
 * keeps day cells, keys, and labels off-by-one free.
 */
export function istAnchor(date = new Date()): Date {
  const shifted = new Date(date.getTime() + IST_MS);
  return new Date(`${shifted.toISOString().slice(0, 7)}-01T00:00:00Z`);
}

/** Month bounds as UTC instants for an IST calendar anchor (FR-DASH-02). */
export function istMonthRange(anchor: Date): { from: string; to: string } {
  return {
    from: new Date(anchor.getTime() - IST_MS).toISOString(),
    to: new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1) - IST_MS - 1,
    ).toISOString(),
  };
}

/** Current calendar month by default (FR-DASH-02). */
export function monthRange(date = new Date()) {
  return istMonthRange(istAnchor(date));
}

export function dashboardQuery(range = monthRange()) {
  return queryOptions({
    queryKey: trackerKeys.dashboard(range.from, range.to),
    queryFn: () =>
      api<DashboardDTO>(
        `/dashboard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
  });
}

/** GET /analytics — full page payload under one cache key (FR-AN-01). */
export function analyticsQuery(
  range: { from: string; to: string },
  granularity: "week" | "month" = "month",
) {
  return queryOptions({
    queryKey: [...trackerKeys.all, "analytics", range.from, range.to, granularity] as const,
    queryFn: () =>
      api<AnalyticsDTO>(
        `/analytics?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&granularity=${granularity}`,
      ),
  });
}

export function useAnalytics(
  range: { from: string; to: string },
  granularity: "week" | "month" = "month",
) {
  return useQuery(analyticsQuery(range, granularity));
}

export function useTrackersList(filters: TrackerFilters) {
  return useInfiniteQuery(trackersListQuery(filters));
}

export function useTrackerDetail(id: string) {
  return useQuery(trackerDetailQuery(id));
}

export function useDashboard(range = monthRange()) {
  return useQuery(dashboardQuery(range));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Patch every cached list page + the detail entry in one pass. */
function patchCachedTracker(
  queryClient: ReturnType<typeof useQueryClient>,
  updated: TrackerDTO,
) {
  queryClient.setQueriesData<UseInfiniteQueryResult<InfiniteData<TrackerListDTO>>["data"]>(
    { queryKey: trackerKeys.lists() },
    (data) =>
      data && {
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((t) => (t.id === updated.id ? updated : t)),
        })),
        pageParams: data.pageParams,
      },
  );
  queryClient.setQueryData(trackerKeys.detail(updated.id), updated);
}

function removeCachedTracker(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  queryClient.setQueriesData<UseInfiniteQueryResult<InfiniteData<TrackerListDTO>>["data"]>(
    { queryKey: trackerKeys.lists() },
    (data) =>
      data && {
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.filter((t) => t.id !== id),
        })),
        pageParams: data.pageParams,
      },
  );
  queryClient.removeQueries({ queryKey: trackerKeys.detail(id) });
}

export function useCreateTracker() {  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      jiraUrl: string;
      category: "DEVELOPMENT" | "SUPPORT";
      ticketId?: string;
      allowDuplicate?: boolean;
    }) => api<TrackerDTO>("/trackers", { json: input }),
    onSuccess: async (created) => {
      queryClient.setQueryData(trackerKeys.detail(created.id), created);
      await queryClient.invalidateQueries({ queryKey: trackerKeys.lists() });
      await queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });
    },
  });
}

export function useUpdateTracker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      category?: "DEVELOPMENT" | "SUPPORT";
      startedAt?: string;
    }) =>
      api<TrackerDTO>(`/trackers/${input.id}`, {
        method: "PATCH",
        json: {
          ...(input.category ? { category: input.category } : {}),
          ...(input.startedAt ? { startedAt: input.startedAt } : {}),
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: trackerKeys.detail(input.id),
      });
      const previous = queryClient.getQueryData<TrackerDTO>(
        trackerKeys.detail(input.id),
      );
      if (previous) {
        patchCachedTracker(queryClient, {
          ...previous,
          ...(input.category ? { category: input.category } : {}),
          ...(input.startedAt ? { startedAt: input.startedAt } : {}),
        });
      }
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context && typeof context === "object" && "previous" in context) {
        queryClient.setQueryData(
          trackerKeys.detail(input.id),
          (context as { previous?: TrackerDTO }).previous,
        );
      }
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({
        queryKey: trackerKeys.detail(input.id),
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteTracker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string }>(`/trackers/${id}`, { method: "DELETE" }),
    onMutate: (id) => removeCachedTracker(queryClient, id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: trackerKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** Close flow (FR-CLOSE): PRs + explicit confirm → COMPLETED. */
export function useCompleteTracker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; prUrls: string[]; force?: boolean }) =>
      api<TrackerDTO>(`/trackers/${input.id}/complete`, {
        json: { prUrls: input.prUrls, force: input.force ?? false },
      }),
    onSuccess: (updated) => {
      patchCachedTracker(queryClient, updated);
      void queryClient.invalidateQueries({ queryKey: trackerKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** Add one PR reference; the API returns the full tracker (single round trip). */
export function useAddPr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; url: string; force?: boolean }) =>
      api<TrackerDTO>(`/trackers/${input.id}/prs`, {
        json: { url: input.url, force: input.force ?? false },
      }),
    onSuccess: (updated) => {
      patchCachedTracker(queryClient, updated);
      void queryClient.invalidateQueries({ queryKey: trackerKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeletePr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; prId: string }) =>
      api<TrackerDTO>(`/trackers/${input.id}/prs/${input.prId}`, {
        method: "DELETE",
      }),
    onSuccess: (updated) => {
      patchCachedTracker(queryClient, updated);
      void queryClient.invalidateQueries({ queryKey: trackerKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
