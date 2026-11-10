import { describe, expect, test } from "bun:test";

import { parseGitHubPrUrl, parseJiraTicketUrl } from "./urls";

describe("parseJiraTicketUrl", () => {
  test("parses a standard Jira Cloud issue URL", () => {
    expect(parseJiraTicketUrl("https://acme.atlassian.net/browse/DEV-123")).toEqual({
      ticketId: "DEV-123",
      normalized: "https://acme.atlassian.net/browse/DEV-123",
    });
  });

  test("uppercases the ticket id", () => {
    expect(parseJiraTicketUrl("https://acme.atlassian.net/browse/dev-9")?.ticketId).toBe(
      "DEV-9",
    );
  });

  test("strips query, hash and trailing slash from the normalized URL", () => {
    const ref = parseJiraTicketUrl(
      "HTTPS://Acme.Atlassian.Net/browse/DEV-1/?foo=bar#anchor",
    );
    expect(ref?.normalized).toBe("https://acme.atlassian.net/browse/DEV-1");
  });

  test("rejects non-http(s) schemes and hosts without a dot (localhost)", () => {
    expect(parseJiraTicketUrl("ftp://acme.atlassian.net/browse/DEV-1")).toBeNull();
    expect(parseJiraTicketUrl("http://localhost/browse/DEV-1")).toBeNull();
  });

  test("rejects non-browse paths and unnumbered keys", () => {
    expect(parseJiraTicketUrl("https://acme.atlassian.net/browse/DEV")).toBeNull();
    expect(parseJiraTicketUrl("https://acme.atlassian.net/issues/DEV-1")).toBeNull();
    expect(parseJiraTicketUrl("not a url")).toBeNull();
  });
});

describe("parseGitHubPrUrl", () => {
  test("parses a GitHub PR URL", () => {
    expect(parseGitHubPrUrl("https://github.com/acme/widgets/pull/42")).toEqual({
      owner: "acme",
      repo: "widgets",
      prNumber: 42,
      normalized: "https://github.com/acme/widgets/pull/42",
    });
  });

  test("accepts www.github.com and strips query/hash/trailing slash", () => {
    const ref = parseGitHubPrUrl("https://www.github.com/acme/widgets/pull/7?foo=1#diff");
    expect(ref?.normalized).toBe("https://www.github.com/acme/widgets/pull/7");
  });

  test("rejects other hosts and non-pull paths", () => {
    expect(parseGitHubPrUrl("https://gitlab.com/acme/widgets/-/merge_requests/1")).toBeNull();
    expect(parseGitHubPrUrl("https://github.com/acme/widgets/issues/42")).toBeNull();
    expect(parseGitHubPrUrl("https://github.com/acme/widgets/pull/abc")).toBeNull();
  });
});
