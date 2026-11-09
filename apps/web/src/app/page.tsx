import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import RedirectIfAuthenticated from "@/components/redirect-if-authenticated";
import BrandMark from "@/components/brand-mark";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@tracklet /ui/lib/utils";

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
        <HorizontalScales className="z-10 col-start-1 col-end-4 row-start-1" />
        <HorizontalScales className="z-10 col-start-1 col-end-4 row-start-3" />
        <VerticalScales className="col-start-1 row-span-3 row-start-1 justify-self-end" />
        <VerticalScales className="col-start-3 row-span-3 row-start-1" />

        <section
          className="relative col-start-2 row-start-2 min-h-0 overflow-hidden rounded-sm border border-border bg-card shadow-[0_18px_45px_rgba(15,17,20,0.08)]"
          aria-labelledby="hero-title"
        >
          <div
            className="absolute inset-0 bg-cover bg-top opacity-[.83] saturate-[.72] brightness-[1.08] dark:opacity-.3 dark:brightness-.4 dark:saturate-.45 max-[700px]:bg-[position:58%_top]"
            style={{ backgroundImage: `url(${mountainImage})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,246,247,.25)_0%,rgba(244,246,247,.05)_38%,#f2f5f6_82%,#f2f5f6_100%)] dark:bg-[linear-gradient(180deg,rgba(15,17,19,.55)_0%,rgba(15,17,19,.45)_25%,rgba(15,17,19,.75)_55%,#101314_78%,#101314_100%)]"
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
            <p className="mb-[14px] text-[11px] font-bold uppercase tracking-[.09em] text-primary">
              Your Jira tickets and PRs, finally in one place.
            </p>
            <h1
              className="m-0 max-w-[800px] text-[clamp(46px,6.2vw,84px)] font-extrabold leading-[.91] tracking-[-.075em] max-[700px]:text-[clamp(47px,14vw,72px)]"
              id="hero-title"
            >
              Every Jira ticket, tracked to done.
            </h1>
            <p className="my-0 mt-7 text-[clamp(17px,1.65vw,23px)] leading-[1.35] tracking-[-.035em] text-muted-foreground max-[700px]:text-[17px]">
              Sign in with Google, paste a ticket URL, and log the pull
              requests when work ships.
              <br className="max-[700px]:hidden" /> Monthly stats, cycle time,
              and Excel &amp; PDF exports.
            </p>
            <div className="mt-7.75 flex items-center gap-6.25">
              <Link
                href="/login"
                className="btn-3d btn-3d-primary inline-flex min-h-12 cursor-pointer items-center rounded-lg bg-primary px-8 text-[15px] font-semibold whitespace-nowrap text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                Get started
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function HorizontalScales({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-10 w-full border-y border-[color:var(--border)] bg-size-[10px_10px] max-[700px]:h-5",
        "bg-[repeating-linear-gradient(315deg,#c9ced4_0,#c9ced4_1px,transparent_1px,transparent_50%)]",
        "dark:bg-[repeating-linear-gradient(315deg,#272c31_0,#272c31_1px,transparent_1px,transparent_50%)]",
        className,
      )}
    />
  );
}

function VerticalScales({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-full w-10 border-x border-[color:var(--border)] bg-size-[10px_10px] max-[700px]:w-3",
        "bg-[repeating-linear-gradient(315deg,#c9ced4_0,#c9ced4_1px,transparent_1px,transparent_50%)]",
        "dark:bg-[repeating-linear-gradient(315deg,#272c31_0,#272c31_1px,transparent_1px,transparent_50%)]",
        className,
      )}
    />
  );
}

// Design note: the source image is a soft watercolor landscape, used as the
// hero artwork with a gentle fade into the page surface. The dark theme
// dims/desaturates the artwork and fades into the dark canvas instead.
