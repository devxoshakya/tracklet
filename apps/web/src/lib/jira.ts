/**
 * Client-side copy of the Jira URL parser (packages/db/src/urls.ts) for live
 * form previews. The server re-validates — this is a preview only, never
 * authoritative.
 */
export type JiraPreview = {
  ticketId: string;
  normalized: string;
};

export function previewJiraTicketUrl(raw: string): JiraPreview | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    const match = /\/browse\/([A-Za-z][A-Za-z0-9]*-\d+)\/?$/.exec(url.pathname);
    if (!match?.[1]) return null;
    url.hash = "";
    url.search = "";
    let normalized = url.toString();
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return { ticketId: match[1].toUpperCase(), normalized };
  } catch {
    return null;
  }
}
