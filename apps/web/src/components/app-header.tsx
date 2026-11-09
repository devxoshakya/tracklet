"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@tracklet /ui/components/button";

import BrandMark from "./brand-mark";
import { ModeToggle } from "./mode-toggle";
import { authClient } from "@/lib/auth-client";

/** Signed-in app header: brand, primary nav, theme, sign-out. */
export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/trackers", label: "Trackers" },
  ] as const;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[17px] font-extrabold tracking-[-.05em]"
            aria-label="Tracklet home"
          >
            <BrandMark className="h-6 w-6" />
            Tracklet
          </Link>
          <nav className="flex items-center gap-1">
            {links.map(({ href, label }) => {
              const active =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-muted font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg text-sm text-muted-foreground hover:text-foreground"
            onClick={() =>
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    toast.success("Signed out");
                    router.replace("/");
                  },
                },
              })
            }
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
