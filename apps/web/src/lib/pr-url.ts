/**
 * Client-side copy of the GitHub PR URL parser (packages/db/src/urls.ts) for
 * live form previews. The server re-validates — preview only.
 */
export type PrPreview = {
  owner: string;
  repo: string;
  prNumber: number;
  normalized: string;
};

export function parseGitHubPrUrl(raw: string): PrPreview | null {
  try {
    const url = new URL(raw.trim());
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
    url.hash = "";
    url.search = "";
    let normalized = url.toString();
    if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
    return { owner, repo, prNumber: Number(prNumber), normalized };
  } catch {
    return null;
  }
}
