/**
 * Mirror of packages/db/src/urls.ts parseJiraTicketUrl — the extension has no
 * build step or shared package, so this is a verbatim standalone copy.
 * tools/check-extension.ts asserts parity against the package version.
 */

/**
 * @param {string} raw
 * @returns {{ ticketId: string, normalized: string } | null}
 */
export function parseJiraTicketUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Unsafe/localhost hosts can't be real Jira tenants (FR-TRK-03).
  if (!url.hostname.includes(".")) return null;

  const match = /\/browse\/([A-Za-z][A-Za-z0-9]*-\d+)\/?$/.exec(url.pathname);
  const ticketId = match?.[1];
  if (!ticketId) return null;

  url.hash = "";
  url.search = "";
  let normalized = url.toString();
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);

  return { ticketId: ticketId.toUpperCase(), normalized };
}
