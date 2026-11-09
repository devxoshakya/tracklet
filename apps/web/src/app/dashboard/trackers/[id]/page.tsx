"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@tracklet /ui/components/button";
import { Input } from "@tracklet /ui/components/input";
import { Skeleton } from "@tracklet /ui/components/skeleton";

import {
  useAddPr,
  useCompleteTracker,
  useDeletePr,
  useDeleteTracker,
  useTrackerDetail,
  useUpdateTracker,
} from "@/hooks/trackers";
import { ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatCycleTime } from "@/lib/format";
import { parseGitHubPrUrl } from "@/lib/pr-url";
import { CategoryChip, StatusChip } from "../page";

/**
 * Tracker detail (PRD FR-TRK-12): ticket reference, category, dates, PR
 * references, close flow, and post-completion PR additions (FR-CLOSE-08).
 */
export default function TrackerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: tracker, isPending, isError, error } = useTrackerDetail(id);

  const update = useUpdateTracker();
  const complete = useCompleteTracker();
  const deleteTracker = useDeleteTracker();
  const addPr = useAddPr();
  const deletePr = useDeletePr();

  const [prInput, setPrInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !tracker) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card px-6 py-12 text-center">
        <p className="text-lg font-extrabold tracking-[-.03em]">
          Tracker not found
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "It may have been deleted."}
        </p>
        <Link
          href="/dashboard/trackers"
          className="mt-4 inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold"
        >
          Back to trackers
        </Link>
      </div>
    );
  }

  const isOpen = tracker.status === "OPEN";

  const closeWithPrs = async (urls: string[], force = false) => {
    try {
      const updated = await complete.mutateAsync({
        id: tracker.id,
        prUrls: urls,
        force,
      });
      toast.success(`${updated.ticketId} marked completed`);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "PR_USED_ELSEWHERE" && !force) {
        toast.warning(err.message, {
          duration: 8000,
          action: {
            label: "Close anyway",
            onClick: () => void closeWithPrs(urls, true),
          },
        });
        return false;
      }
      toast.error(err instanceof Error ? err.message : "Could not close tracker.");
      return false;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/trackers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Trackers
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tabular-nums tracking-[-.04em]">
            {tracker.ticketId}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <CategoryChip category={tracker.category} />
            <StatusChip status={tracker.status} />
            <span className="text-muted-foreground">
              · {tracker.ticketIdSource === "MANUAL" ? "manual ID" : "from URL"}
            </span>
          </p>
        </div>
        <a
          href={tracker.jiraUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold shadow-[0_2px_0_0_rgba(17,19,24,0.14)] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-0 active:shadow-none"
        >
          Open in Jira ↗
        </a>
      </div>

      {/* Properties */}
      <section className="rounded-xl border border-border bg-card">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-3">
          <Field label="Started">
            {isOpen && !update.isPending ? (
              <EditableDate
                value={tracker.startedAt}
                onSave={(iso) =>
                  update
                    .mutateAsync({ id: tracker.id, startedAt: iso })
                    .then(() => toast.success("Start date updated"))
                    .catch((e) => toast.error(e.message))
                }
              />
            ) : (
              <Value>{formatDate(tracker.startedAt)}</Value>
            )}
          </Field>
          <Field label="Completed">
            <Value>{formatDate(tracker.completedAt)}</Value>
          </Field>
          <Field label="Cycle time">
            <Value>{formatCycleTime(tracker.cycleTimeMinutes)}</Value>
          </Field>
          <Field label="Category">
            {isOpen ? (
              <span className="flex gap-1.5">
                {(["DEVOPS", "SUPPORT"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    disabled={update.isPending}
                    onClick={() =>
                      update
                        .mutateAsync({ id: tracker.id, category: cat })
                        .then(() => toast.success("Category updated"))
                        .catch((e) => toast.error(e.message))
                    }
                    className={`cursor-pointer rounded-[4px] px-2 py-1 text-xs font-medium transition-opacity ${
                      tracker.category === cat
                        ? "bg-accent text-[color:var(--accent-foreground)]"
                        : "bg-muted text-muted-foreground hover:opacity-80"
                    }`}
                  >
                    {cat === "DEVOPS" ? "DevOps" : "Support"}
                  </button>
                ))}
              </span>
            ) : (
              <Value>{tracker.category === "DEVOPS" ? "DevOps" : "Support"}</Value>
            )}
          </Field>
          <Field label="Status">
            <Value>{isOpen ? "Open" : "Completed"}</Value>
          </Field>
          <Field label="Jira URL">
            <Value>
              <span className="block max-w-48 truncate">{tracker.jiraUrl}</span>
            </Value>
          </Field>
        </dl>
      </section>

      {/* PR references (FR-PR-07) */}
      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-6 py-3 text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
          PR references ({tracker.prs.length})
        </h2>
        {tracker.prs.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            No pull requests referenced yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {tracker.prs.map((pr) => (
              <li key={pr.id} className="flex items-center gap-3 px-6 py-3">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:text-primary"
                >
                  {pr.repoOwner}/{pr.repoName}
                  <span className="text-muted-foreground">#{pr.prNumber}</span>
                </a>
                <span className="ml-auto text-[13px] text-muted-foreground">
                  Added {formatDate(pr.addedAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-md text-xs text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    deletePr
                      .mutateAsync({ id: tracker.id, prId: pr.id })
                      .then(() => toast.success("PR reference removed"))
                      .catch((e) => toast.error(e.message))
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Add PR — allowed open (pre-close) and after completion (FR-CLOSE-08) */}
        <div className="flex items-center gap-2 border-t border-border px-6 py-4">
          <Input
            value={prInput}
            onChange={(e) => setPrInput(e.target.value)}
            placeholder="https://github.com/{owner}/{repo}/pull/123"
            className="h-10 flex-1 rounded-lg border-border bg-background text-sm"
          />
          <Button
            variant="outline"
            className="h-10 rounded-lg px-4 text-sm font-semibold"
            disabled={!parseGitHubPrUrl(prInput) || addPr.isPending}
            onClick={() =>
              addPr
                .mutateAsync({ id: tracker.id, url: prInput.trim() })
                .then(() => {
                  setPrInput("");
                  toast.success("PR reference added");
                })
                .catch((e) => {
                  if (e instanceof ApiError && e.code === "PR_USED_ELSEWHERE") {
                    toast.warning(e.message, {
                      action: {
                        label: "Add anyway",
                        onClick: () =>
                          void addPr
                            .mutateAsync({ id: tracker.id, url: prInput.trim(), force: true })
                            .then(() => {
                              setPrInput("");
                              toast.success("PR reference added");
                            })
                            .catch((e2) => toast.error(e2.message)),
                      },
                    });
                    return;
                  }
                  toast.error(e.message);
                })
            }
          >
            {addPr.isPending ? "Adding…" : "Add PR"}
          </Button>
        </div>
      </section>

      {/* Close flow (§9.4, FR-CLOSE-01..06) */}
      {isOpen ? (
        <section className="rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-6 py-3 text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
            Close tracker
          </h2>
          <CloseFlow
            busy={complete.isPending}
            onClose={closeWithPrs}
          />
        </section>
      ) : (
        <section className="flex items-center justify-between rounded-xl border border-border bg-card px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Completed {formatDateTime(tracker.completedAt)}.
          </p>
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-md text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                Keep it
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-md bg-destructive px-3 text-xs text-white hover:opacity-90"
                onClick={() =>
                  deleteTracker
                    .mutateAsync(tracker.id)
                    .then(() => {
                      toast.success("Tracker deleted");
                      router.push("/dashboard/trackers");
                    })
                    .catch((e) => toast.error(e.message))
                }
              >
                Delete permanently
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-md text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete tracker
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums">{children}</span>;
}

function EditableDate({
  value,
  onSave,
}: {
  value: string;
  onSave: (iso: string) => void;
}) {
  const [draft, setDraft] = useState(() => value.slice(0, 10));
  return (
    <span className="flex items-center gap-1.5">
      <Input
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-36 rounded-md border-border bg-background text-[13px]"
      />
      {draft !== value.slice(0, 10) ? (
        <button
          type="button"
          onClick={() => onSave(new Date(`${draft}T00:00:00`).toISOString())}
          className="cursor-pointer rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
        >
          Save
        </button>
      ) : null}
    </span>
  );
}

/**
 * Close flow: paste one or more PR URLs → review parsed references →
 * explicit confirm (FR-CLOSE-03). Pasting into the form alone never closes
 * the tracker (§9.4).
 */
function CloseFlow({
  busy,
  onClose,
}: {
  busy: boolean;
  onClose: (urls: string[], force?: boolean) => Promise<boolean>;
}) {
  const [raw, setRaw] = useState("");

  const urls = raw
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = urls.map((url) => ({ url, ref: parseGitHubPrUrl(url) }));
  const allValid = parsed.length > 0 && parsed.every((p) => p.ref);

  return (
    <div className="space-y-3 px-6 py-5">
      <Input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Paste one or more GitHub PR URLs"
        className="h-10 rounded-lg border-border bg-background text-sm"
      />
      {parsed.length > 0 ? (
        <ul className="space-y-1 text-[13px]">
          {parsed.map(({ url, ref }, i) => (
            <li key={`${url}-${i}`} className="flex items-center gap-2">
              {ref ? (
                <>
                  <span className="font-medium">
                    {ref.owner}/{ref.repo}#{ref.prNumber}
                  </span>
                  <span className="text-muted-foreground">{ref.normalized}</span>
                </>
              ) : (
                <span className="text-[color:var(--destructive)]">
                  Invalid PR URL: {url}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Completing records the completion date and locks editing.
        </p>
        <Button
          className="btn-3d btn-3d-primary h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          disabled={!allValid || busy}
          onClick={() =>
            onClose(parsed.map((p) => p.ref!.normalized)).then((ok) => {
              if (ok) setRaw("");
            })
          }
        >
          {busy ? "Closing…" : `Close with ${parsed.length || ""} PR${parsed.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
