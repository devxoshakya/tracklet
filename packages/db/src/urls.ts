/**
 * URL parsing and normalization for Jira tickets and GitHub PRs.
 *
 * Pure string logic only — nothing here performs network calls (PRD
 * FR-TRK-10, FR-PR-04). The server is authoritative; the web app keeps a
 * copy for live form previews.
 */

export type JiraTicketRef = {
  /** Parsed issue key, e.g. "DEV-123". */
  ticketId: string;
  /** Canonical URL: lowercase host, no query/hash, no trailing slash. */
  normalized: string;
};

export type GitHubPrRef = {
  owner: string;
  repo: string;
  prNumber: number;
  normalized: string;
};

/** Strip query/hash, trailing slash, and lowercase the host. */
function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.search = "";
  let out = url.toString();
  if (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/**
 * PRD FR-TRK-03/04: validate protocol and Jira Cloud issue URL format.
 * Supported MVP pattern: https://<host>/browse/<PROJECT>-<number>
 * (also accepts the /jira/.../browse/ variants some tenants use).
 */
export function parseJiraTicketUrl(raw: string): JiraTicketRef | null {
  let url: URL;
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

  const normalized = normalizeUrl(raw);
  if (!normalized) return null;

  return { ticketId: ticketId.toUpperCase(), normalized };
}

/**
 * PRD FR-PR-03: valid HTTPS GitHub pull-request URL.
 * MVP format: https://github.com/{owner}/{repo}/pull/{number}
 */
export function parseGitHubPrUrl(raw: string): GitHubPrRef | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const match = /^\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/pull\/(\d+)\/?$/.exec(
    url.pathname,
  );
  const owner = match?.[1];
  const repo = match?.[2];
  const prNumber = match?.[3];
  if (!owner || !repo || !prNumber) return null;

  const normalized = normalizeUrl(raw);
  if (!normalized) return null;

  return {
    owner,
    repo,
    prNumber: Number(prNumber),
    normalized,
  };
}
