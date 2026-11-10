"use client";

import { Button } from "@tracklet/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

/**
 * Theme toggle (docs/design.md §6.6): a quiet, borderless ghost icon — no
 * border, no shadow, no keycap. One tap flips light ↔ dark; the icon
 * inverts per theme and the hit target stays 40px for touch.
 */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Icons are theme-dependent; stay neutral until hydration to avoid mismatch.
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="size-10 rounded-lg text-foreground/70 hover:bg-muted hover:text-foreground dark:text-foreground/70 dark:hover:bg-muted"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  );
}
