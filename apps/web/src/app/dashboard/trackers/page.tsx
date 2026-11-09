"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Input } from "@tracklet /ui/components/input";
import { Skeleton } from "@tracklet /ui/components/skeleton";

import { useTrackersList } from "@/hooks/trackers";
import { formatDate, formatCycleTime } from "@/lib/format";

/**
 * Trackers list (PRD FR-VIEW-01, FR-SEARCH-01..06): searchable, filterable
 * infinite list. Filters live in the URL so views can share them.
 */
export default function TrackersPage() {
  return (
    <Suspense>
      <TrackersContent />
    </Suspense>
  );
}

function TrackersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") as "OPEN" | "COMPLETED" | null;
  const category = searchParams.get("category") as "DEVOPS" | "SUPPORT" | null;

  const [searchInput, setSearchInput] = useState("");
  // Debounced into the actual query to keep cache keys stable.
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = {
    search: search || undefined,
    status: status ?? undefined,
    category: category ?? undefined,
  };
  const { data, isPending, isError, error, fetchNextPage, isFetchingNextPage } =
    useTrackersList(filters);

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/dashboard/trackers?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-[-.04em]">Trackers</h1>
        <Link
          href="/dashboard/trackers/new"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_2px_0_0_#0c3fd4,0_10px_20px_rgba(15,17,20,0.12)] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-0 active:shadow-none"
        >
          Create tracker
        </Link>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search ticket ID or PR…"
          className="h-9 w-64 rounded-lg border-border bg-card text-sm"
        />
        <PillGroup
          options={["All", "OPEN", "COMPLETED"]}
          labels={{ All: "All", OPEN: "Open", COMPLETED: "Completed" }}
          value={status ?? "All"}
          onChange={(v) => setParam("status", v === "All" ? null : v)}
        />
        <PillGroup
          options={["All", "DEVOPS", "SUPPORT"]}
          labels={{ All: "All", DEVOPS: "DevOps", SUPPORT: "Support" }}
          value={category ?? "All"}
          onChange={(v) => setParam("category", v === "All" ? null : v)}
        />
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isPending ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Could not load trackers."}
          </p>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-lg font-extrabold tracking-[-.03em]">
              Nothing to track yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a Jira ticket URL to create your first tracker.
            </p>
            <Link
              href="/dashboard/trackers/new"
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_2px_0_0_#0c3fd4]"
            >
              Create tracker
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border/60">
              {items.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/trackers/${t.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="w-28 shrink-0 text-sm font-extrabold tabular-nums tracking-[-.02em]">
                      {t.ticketId}
                    </span>
                    <CategoryChip category={t.category} />
                    <StatusChip status={t.status} />
                    <span className="ml-auto hidden text-[13px] text-muted-foreground sm:block">
                      {t.prCount} PR{t.prCount === 1 ? "" : "s"}
                    </span>
                    <span className="hidden text-[13px] text-muted-foreground md:block">
                      Started {formatDate(t.startedAt)}
                    </span>
                    {t.status === "COMPLETED" ? (
                      <span className="hidden text-[13px] text-muted-foreground lg:block">
                        Cycle {formatCycleTime(t.cycleTimeMinutes)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            {data?.pages.at(-1)?.nextCursor ? (
              <div className="border-t border-border px-5 py-3 text-center">
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-primary hover:bg-muted disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function PillGroup({
  options,
  labels,
  value,
  onChange,
}: {
  options: string[];
  labels: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`cursor-pointer rounded-md px-2.5 py-1 text-[13px] transition-colors ${
            value === option
              ? "bg-muted font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[option] ?? option}
        </button>
      ))}
    </div>
  );
}

export function CategoryChip({ category }: { category: string }) {
  const isDevops = category === "DEVOPS";
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-[4px] px-2 text-xs font-medium ${
        isDevops
          ? "bg-accent text-[color:var(--accent-foreground)]"
          : "bg-[#f0ecfc] text-[#5238b8] dark:bg-[#2a2440] dark:text-[#c4b5fd]"
      }`}
    >
      {isDevops ? "DevOps" : "Support"}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const isCompleted = status === "COMPLETED";
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 rounded-[4px] px-2 text-xs font-medium ${
        isCompleted
          ? "bg-[#e7f5ec] text-[#1e7a3a] dark:bg-[#17301f] dark:text-[#6ee7a0]"
          : "bg-[#fff0e8] text-[#b8400f] dark:bg-[#33230f] dark:text-[#fdba74]"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          isCompleted ? "bg-[#34a853]" : "bg-[#ff672f]"
        }`}
      />
      {isCompleted ? "Completed" : "Open"}
    </span>
  );
}
