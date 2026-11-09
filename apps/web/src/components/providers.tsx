"use client";

import { Toaster } from "@tracklet /ui/components/sonner";

import { ThemeProvider } from "./theme-provider";
import QueryProvider from "./query-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        {children}
        <Toaster richColors />
      </QueryProvider>
    </ThemeProvider>
  );
}
