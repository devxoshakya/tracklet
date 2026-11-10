"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tracklet/ui/components/dropdown-menu";
import { Skeleton } from "@tracklet/ui/components/skeleton";
import { Button } from "@tracklet/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { DownloadIcon } from "lucide-react";

/**
 * Circle avatar (Google profile image when present, neutral initial
 * otherwise) with an account header + sign out in the dropdown.
 */
export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="size-9 rounded-full" />;
  }

  if (!session) {
    return (
      <Link href="/login">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  const initial = (session.user.name?.trim() || session.user.email || "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Avatar image={session.user.image} initial={initial} className="size-9" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar image={session.user.image} initial={initial} className="size-8" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-foreground">
              {session.user.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {session.user.email}
            </span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <a
              href="/extension.zip"
              download="tracklet-chrome-extension.zip"
              // Chrome loads unpacked extensions from an unzipped folder —
              // steps are in the zip's README.
              title="Download, unzip, then load unpacked via chrome://extensions"
            />
          }
        >
          <DownloadIcon aria-hidden="true" />
          Install Chrome extension
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  toast.success("Signed out");
                  router.replace("/");
                },
              },
            });
          }}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({
  image,
  initial,
  className,
}: {
  image?: string | null;
  initial: string;
  className: string;
}) {
  if (image) {
    return (
      // Google profile URLs vary; plain img avoids next/image domain config.
      <img
        src={image}
        alt=""
        className={`shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground ring-1 ring-border ${className}`}
    >
      {initial}
    </span>
  );
}
