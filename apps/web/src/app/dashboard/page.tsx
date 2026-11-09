"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@tracklet /ui/components/button";

import { authClient } from "@/lib/auth-client";

/**
 * Minimal placeholder so the demo has a post-login destination.
 * The full dashboard (PRD 12.2) is built in a later phase.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </main>
    );
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card px-8 py-10 text-center shadow-[0_18px_45px_rgba(15,17,20,0.08)]">
        <p className="text-[11px] font-bold uppercase tracking-[.09em] text-primary">
          Dashboard
        </p>
        <h1 className="mt-3 text-[clamp(26px,3vw,32px)] font-extrabold tracking-[-.05em]">
          Welcome, {session.user?.name?.split(" ")[0] || "friend"}
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{session.user?.email}</p>
        <p className="mt-4 text-[15px] leading-[1.5] text-muted-foreground">
          The tracker workspace is coming next: create a tracker, close it with
          PR references, and see your monthly analytics.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="btn-3d btn-3d-light h-11 rounded-lg px-5 text-[15px] font-semibold"
            onClick={() =>
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => router.push("/"),
                },
              })
            }
          >
            Sign out
          </Button>
          <Link
            href="/"
            className="btn-3d btn-3d-primary inline-flex h-11 items-center rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
