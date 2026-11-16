"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import GoogleIcon from "@/components/google-icon";
import BrandMark from "@/components/brand-mark";
import { authClient } from "@/lib/auth-client";

/**
 * Google-only sign-in (PRD FR-AUTH-01) — no credentials, no GitHub.
 * Split-screen layout per design.md §8; theming per docs/design.md §3.
 */
export default function LoginPage({
  initialRedirect,
}: {
  initialRedirect?: string;
}) {
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const { data: session } = authClient.useSession();

  const target = initialRedirect ?? "/dashboard";

  // Signed-in users land on the dashboard; a `?redirect=` carried through an
  // invite-esque link keeps working after the auth round trip.
  useEffect(() => {
    if (session?.user && !signingIn) {
      router.replace(target as Route);
    }
  }, [router, session?.user, signingIn, target]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      // The OAuth callback must be an ABSOLUTE URL on the web app's origin: a
      // relative path resolves against the auth server instead (different
      // hosts in this deployment).
      const callbackURL = `${window.location.origin}${target}`;
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      // Only surfaces when navigation to Google didn't happen (e.g. the auth
      // server is down or a popup was blocked).
      if (error) {
        setSigningIn(false);
        toast.error(error.message || "Google sign in failed. Please try again.");
      }
    } catch {
      setSigningIn(false);
      toast.error("Could not reach the server to start Google sign-in. Please try again.");
    }
  };

  return (
    <div className="grid min-h-svh grid-cols-1 bg-background text-foreground lg:grid-cols-2">
      {/* Brand panel */}
      <aside
        className="relative hidden overflow-hidden lg:block"
        aria-hidden="true"
      >
        <div
          className="landing-art absolute inset-0 bg-cover bg-top opacity-[.9] saturate-[.72] brightness-[1.05] dark:opacity-[.5] dark:brightness-[.8] dark:saturate-[.5]"
          style={{ backgroundImage: "url(/tracklet-mountains.png)" }}
        />
        {/* The fade lands on the theme's own canvas color so the panel, the
            page, and the artwork knit together in light and dark. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,246,247,0)_0%,rgba(244,246,247,.12)_55%,#f4f6f7_100%)] dark:bg-[linear-gradient(180deg,rgba(15,17,19,.6)_0%,rgba(15,17,19,.3)_48%,#0f1113_90%)]" />

        <div className="absolute inset-x-0 bottom-0 z-[1] p-10">
          <p className="landing-rise rise-d1 mb-2 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[.09em] text-primary dark:text-accent-foreground">
            <span
              className="h-px w-6 shrink-0 bg-primary/60 dark:bg-accent-foreground/50"
              aria-hidden="true"
            />
            Welcome back
          </p>
          <p className="landing-rise rise-d2 m-0 max-w-[420px] text-[clamp(24px,2.6vw,34px)] font-extrabold leading-[1.08] tracking-[-.05em]">
            Your Jira tickets and PRs, one{" "}
            <span className="relative inline-block whitespace-nowrap">
              quiet tracker.
              <svg
                className="landing-underline absolute bottom-[-0.12em] left-[-0.02em] h-[0.15em] w-[104%]"
                viewBox="0 0 100 9"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M1.5 5.8 C 18 3.4, 40 7.4, 62 4.6 C 78 2.9, 90 5.4, 98.5 4.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              </svg>
            </span>
          </p>
        </div>
      </aside>

      {/* Sign-in panel */}
      <section className="relative grid place-items-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <BrandMark className="landing-rise rise-d1 mx-auto h-14 w-14" />

          <div className="landing-rise rise-d2 mt-6 text-center">
            <h1 className="m-0 text-[clamp(26px,3vw,32px)] font-extrabold tracking-[-.05em]">
              Sign in to Tracklet
            </h1>
            <p className="mx-0 mt-2.5 mb-0 text-[15px] leading-[1.45] text-muted-foreground text-balance">
              One account, no passwords. Tracklet uses Google sign-in only —
              your tracker stays yours.
            </p>
          </div>

          <div className="landing-rise rise-d3 mt-9">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="btn-3d btn-3d-light inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-border bg-card px-6 text-[15px] font-semibold text-card-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
            >
              {signingIn ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <GoogleIcon className="size-5" />
              )}
              {signingIn ? "Signing you in…" : "Continue with Google"}
            </button>
            {initialRedirect ? (
              <p className="mt-3 mb-0 text-center text-[13px] text-muted-foreground">
                You&apos;ll be taken to your destination right after signing in.
              </p>
            ) : null}
          </div>

          <p className="landing-rise rise-d4 mt-9 mb-0 text-center text-[12px] leading-[1.5] text-[color:var(--muted-foreground)] opacity-75">
            By continuing, you agree to Tracklet&apos;s{" "}
            <a
              href="#"
              className="cursor-pointer text-foreground underline underline-offset-2 hover:opacity-75"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="cursor-pointer text-foreground underline underline-offset-2 hover:opacity-75"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
