"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@tracklet/ui/components/dialog";
import { Button } from "@tracklet/ui/components/button";
import { Input } from "@tracklet/ui/components/input";
import { Label } from "@tracklet/ui/components/label";

import { useCreateTracker } from "@/hooks/trackers";
import { ApiError } from "@/lib/api";
import { previewJiraTicketUrl } from "@/lib/jira";

/**
 * Create tracker (PRD FR-TRK-01..09, §9.2): paste URL → category → review →
 * submit, in a dialog off the dashboard. Duplicates raise a confirmable
 * warning (FR-TRK-09); unparsable URLs fall back to a manual ticket ID
 * (FR-TRK-05). Category is chosen once here and never switches (FR-TRK-13).
 */
export default function CreateTrackerDialog() {
  return (
    <Dialog>
      <DialogTrigger
        className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_2px_0_0_#0c3fd4,0_10px_20px_rgba(15,17,20,0.12)] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-0 active:shadow-none"
      >
        Create tracker
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Create tracker</DialogTitle>
        <DialogDescription>
          Paste the Jira ticket URL and pick a category. Tracklet stores the
          link — it never opens Jira.
        </DialogDescription>
        <CreateTrackerForm />
      </DialogContent>
    </Dialog>
  );
}

/** Lives inside the portal so its state resets every time the dialog opens. */
function CreateTrackerForm() {
  const router = useRouter();
  const create = useCreateTracker();

  const [jiraUrl, setJiraUrl] = useState("");
  const [category, setCategory] = useState<"DEVELOPMENT" | "SUPPORT" | null>(
    null,
  );
  const [manualId, setManualId] = useState<string | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  const preview = useMemo(
    () => (jiraUrl ? previewJiraTicketUrl(jiraUrl) : null),
    [jiraUrl],
  );

  const ticketId = manualId ?? preview?.ticketId ?? null;
  const ready = Boolean(ticketId && category);
  const inReview = ready && !duplicateNotice;

  const submit = async () => {
    if (!category || !ticketId) return;
    try {
      const created = await create.mutateAsync({
        jiraUrl: jiraUrl.trim(),
        category,
        ...(manualId ? { ticketId: manualId } : {}),
        allowDuplicate: duplicateConfirmed,
      });
      toast.success(`Tracking ${created.ticketId}`);
      router.push(`/dashboard/trackers/${created.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "DUPLICATE") {
        setDuplicateNotice(error.message);
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Could not create the tracker.",
      );
    }
  };

  return (
    <div className="mt-5 space-y-5">
      {/* Step 1: URL */}
      <div className="space-y-2">
        <Label htmlFor="jiraUrl" className="text-[13px] font-medium">
          Jira ticket URL
        </Label>
        <Input
          id="jiraUrl"
          value={jiraUrl}
          onChange={(e) => {
            setJiraUrl(e.target.value);
            setDuplicateConfirmed(false);
            setDuplicateNotice(null);
          }}
          placeholder="https://company.atlassian.net/browse/DEV-123"
          className="h-10 rounded-lg border-border bg-background text-sm"
        />
        {jiraUrl && !preview && !manualId ? (
          <p className="text-[13px] text-[color:var(--destructive)]">
            Couldn&apos;t parse a ticket ID from that URL.
            <button
              type="button"
              onClick={() => setManualId("")}
              className="ml-1 cursor-pointer font-semibold underline underline-offset-2"
            >
              Enter the ticket ID manually
            </button>
          </p>
        ) : null}
        {manualId !== null ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={manualId}
              onChange={(e) => setManualId(e.target.value.toUpperCase())}
              placeholder="DEV-123"
              className="h-10 w-40 rounded-lg border-border bg-background text-sm"
            />
            <button
              type="button"
              onClick={() => setManualId(null)}
              className="cursor-pointer text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Use URL parsing instead
            </button>
          </div>
        ) : null}
      </div>

      {/* Step 2: category (FR-TRK-06) */}
      <div className="space-y-2">
        <Label className="text-[13px] font-medium">Category</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {(["DEVELOPMENT", "SUPPORT"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors ${
                category === value
                  ? "border-primary bg-accent/50"
                  : "border-border hover:border-input"
              }`}
            >
              <span className="block text-sm font-bold">
                {value === "DEVELOPMENT" ? "Development" : "Support"}
              </span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                {value === "DEVELOPMENT"
                  ? "Infrastructure and platform work"
                  : "Customer-reported issues"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: review (§9.2 step 7) */}
      {inReview ? (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[.09em] text-muted-foreground">
            Review
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold tabular-nums tracking-[-.03em]">
                {ticketId}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {category === "DEVELOPMENT" ? "Development" : "Support"} ·{" "}
                {manualId ? "manual ID" : "parsed from URL"}
              </p>
            </div>
            <Button
              className="btn-3d btn-3d-primary h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
              onClick={() => void submit()}
              disabled={create.isPending}
            >
              {create.isPending ? "Creating…" : "Create tracker"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Duplicate warning (FR-TRK-09) */}
      {duplicateNotice ? (
        <div className="rounded-lg border border-[#f1c8a0] bg-[#fff0e8] px-4 py-3 text-[13px] text-[#b8400f] dark:border-[#5a3a1e] dark:bg-[#33230f] dark:text-[#fdba74]">
          <p>{duplicateNotice}</p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md text-xs"
              onClick={() => setDuplicateNotice(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-md bg-[#b8400f] px-3 text-xs text-white hover:bg-[#9a3510]"
              onClick={() => {
                setDuplicateConfirmed(true);
                setDuplicateNotice(null);
                void submit();
              }}
            >
              Create anyway
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
