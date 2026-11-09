"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import AppHeader from "@/components/app-header";
import { authClient } from "@/lib/auth-client";

/**
 * Signed-in shell (FR-AUTH-04): client-side guard + app header. Pages render
 * only for an active session.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login?redirect=/dashboard");
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
