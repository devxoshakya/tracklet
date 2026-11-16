import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import RedirectIfAuthenticated from "@/components/redirect-if-authenticated";
import BrandMark from "@/components/brand-mark";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@tracklet/ui/lib/utils";

const mountainImage = "/tracklet-mountains.png";

/**
 * Public landing page (hero frozen per design.md §9). Signed-in users skip
 * the marketing page entirely and go straight to the dashboard.
 */
export default async function LandingPage() {
  // Public page: on auth-server trouble degrade to the anonymous view rather
  // than erroring (only a *valid session* skips the landing page).
  let session: { user: { id: string } } | null = null;
  try {
    session = await authClient.getSession({
      fetchOptions: { headers: await headers(), throw: true },
    });
  } catch {
    session = null;
  }
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <>
      <RedirectIfAuthenticated />
      <main
        className="grid min-h-screen grid-cols-[minmax(0,1fr)_minmax(0,1200px)_minmax(0,1fr)] grid-rows-[38px_minmax(0,1fr)_38px] bg-background text-foreground overflow-hidden max-[700px]:grid-cols-[12px_minmax(0,1fr)_12px] max-[700px]:grid-rows-[20px_minmax(0,1fr)_20px]"
      >
        <HorizontalScales className="z-10 col-start-1 col-end-4 row-start-1" ticks="bottom" />
        <HorizontalScales className="z-10 col-start-1 col-end-4 row-start-3" ticks="top" />
        <VerticalScales className="col-start-1 row-span-3 row-start-1 justify-self-end" ticks="right" />
        <VerticalScales className="col-start-3 row-span-3 row-start-1" ticks="left" />

        <section
          className="relative col-start-2 row-start-2 min-h-0 overflow-hidden rounded-sm border border-border bg-card shadow-[0_18px_45px_rgba(15,17,20,0.08)]"
          aria-labelledby="hero-title"
        >
          <div
            className="landing-art absolute inset-0 bg-cover bg-top opacity-[.83] saturate-[.72] brightness-[1.08] dark:opacity-[.5] dark:brightness-[.8] dark:saturate-[.5] max-[700px]:bg-[position:58%_top]"
            style={{ backgroundImage: `url(${mountainImage})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,246,247,.25)_0%,rgba(244,246,247,.05)_38%,#f2f5f6_82%,#f2f5f6_100%)] dark:bg-[linear-gradient(180deg,rgba(15,17,19,.72)_0%,rgba(15,17,19,.55)_30%,rgba(15,17,19,.6)_58%,#101314_85%)]"
            aria-hidden="true"
          />

          <header className="relative z-[1] grid grid-cols-[1fr_auto] items-center px-8 py-7 text-xs max-[700px]:px-5 max-[700px]:py-[22px]">
            <p
              className="flex items-center gap-2 text-[19px] font-extrabold tracking-[-.06em]"
              aria-label="Tracklet home"
            >
              <BrandMark className="h-8 w-8" />
              <span className="text-2xl">Tracklet</span>
            </p>
            <ModeToggle />
          </header>

          <div
            className="relative z-[1] flex min-h-[calc(100vh-172px)] max-w-[760px] flex-col items-start justify-end px-8 pb-[50px] max-[700px]:min-h-[calc(100vh-132px)] max-[700px]:px-5 max-[700px]:pb-[34px]"
            id="top"
          >
            <p className="landing-rise rise-d1 mb-[14px] flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[.09em] text-primary dark:text-accent-foreground">
              <span className="h-px w-6 shrink-0 bg-primary/60 dark:bg-accent-foreground/50" aria-hidden="true" />
              Your Jira tickets and PRs, finally in one place.
            </p>
            <h1
              className="landing-rise rise-d2 m-0 max-w-[800px] text-[clamp(46px,6.2vw,84px)] font-extrabold leading-[.91] tracking-[-.075em] text-balance max-[700px]:text-[clamp(47px,14vw,72px)]"
              id="hero-title"
            >
              Every Jira ticket, tracked to{" "}
              <span className="relative inline-block whitespace-nowrap">
                done.
                <svg
                  className="landing-underline absolute bottom-[-0.11em] left-[-0.02em] h-[0.14em] w-[104%]"
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
            </h1>
            <p className="landing-rise rise-d3 my-0 mt-7 max-w-[640px] text-[clamp(17px,1.65vw,23px)] leading-[1.35] tracking-[-.035em] text-muted-foreground text-balance max-[700px]:text-[17px]">
              Sign in with Google, paste a ticket URL, and log the pull
              requests when work ships. Monthly stats, cycle time, and Excel
              &amp; PDF exports.
            </p>
            <div className="landing-rise rise-d4 mt-7.75 flex items-center gap-6.25">
              <Link
                href="/login"
                className="btn-3d btn-3d-primary group inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg bg-primary px-8 text-[15px] font-semibold whitespace-nowrap text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                Get started
                <ArrowRight
                  className="h-[18px] w-[18px] transition-transform duration-200 ease-out group-hover:translate-x-[3px]"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function HorizontalScales({
  className,
  ticks,
}: {
  className?: string;
  /** Which edge carries the graduation ticks (the inner edge faces the hero). */
  ticks: "bottom" | "top";
}) {
  return (
    <div
      className={cn(
        "scale-strip h-10 w-full border-y border-[color:var(--border)] max-[700px]:h-5",
        ticks === "bottom" ? "scale-ticks-b" : "scale-ticks-t",
        className,
      )}
    />
  );
}

function VerticalScales({
  className,
  ticks,
}: {
  className?: string;
  ticks: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "scale-strip h-full w-10 border-x border-[color:var(--border)] max-[700px]:w-3",
        ticks === "right" ? "scale-ticks-r" : "scale-ticks-l",
        className,
      )}
    />
  );
}

// Design note: the source image is a soft watercolor landscape, used as the
// hero artwork with a gentle fade into the page surface. The dark theme
// dims/desaturates the artwork and fades into the dark canvas instead.
