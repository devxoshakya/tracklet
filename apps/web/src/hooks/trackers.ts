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
  category?: "DEVOPS" | "SUPPORT";
  status?: "OPEN" | "COMPLETED";
  sort?: "startedAt" | "completedAt" | "createdAt";
  order?: "asc" | "desc";
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

/** Current calendar month by default (FR-DASH-02). */
export function monthRange(date = new Date()): { from: string; to: string } {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { from: from.toISOString(), to: to.toISOString() };
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
      category: "DEVOPS" | "SUPPORT";
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
      category?: "DEVOPS" | "SUPPORT";
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
