import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import LoginPage from "./login-client";

/**
 * Only allow relative in-app paths as post-login targets — never absolute or
 * protocol-relative URLs (open-redirect guard).
 */
export function sanitizeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

/**
 * Sign-in route (adapted from the Hikari login design). Signed-in users never
 * see the login page; anonymous users get the Google-only sign-in (no
 * credentials, no GitHub — PRD FR-AUTH-01), and any `redirect` target survives
 * the authentication round trip.
 */
export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  // Public page: on auth-server trouble degrade to the anonymous view.
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

  const { redirect: redirectParam } = await searchParams;
  return (
    <LoginPage
      initialRedirect={redirectParam ? sanitizeRedirect(redirectParam) : undefined}
    />
  );
}
