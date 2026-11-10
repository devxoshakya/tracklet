/**
 * Extension self-check (run from the repo root or apps/extension):
 *   bun apps/extension/tools/check-extension.ts
 *
 * 1. manifest.json parses and every referenced local file exists.
 * 2. popup.html/css reference only existing local files.
 * 3. lib/parse.js (the no-build mirror) agrees with the package's
 *    packages/db/src/urls.ts on a table of real cases.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseGitHubPrUrl as extensionParsePr,
  parseJiraTicketUrl as extensionParse,
} from "../lib/parse.js";
import {
  parseGitHubPrUrl as packageParsePr,
  parseJiraTicketUrl as packageParse,
} from "../../../packages/db/src/urls";

const assert = (condition, message) => {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
};
const dir = fileURLToPath(new URL("../", import.meta.url));
const has = (path) => existsSync(dir + path);

// 1. Manifest.
const manifest = JSON.parse(readFileSync(dir + "manifest.json", "utf8"));
assert(manifest.manifest_version === 3, "Manifest V3 (FR-EXT-01)");
assert(
  JSON.stringify(manifest.permissions) === JSON.stringify(["activeTab"]),
  `minimal permissions (FR-EXT-10), got ${JSON.stringify(manifest.permissions)}`,
);
// The manifest's host permission must cover config.js's serverOrigin — a
// mismatched port silently breaks every popup request.
const serverOrigin = /serverOrigin:\s*"([^"]+)"/.exec(
  readFileSync(dir + "config.js", "utf8"),
)?.[1];
assert(serverOrigin, "config.js defines serverOrigin");
assert(
  manifest.host_permissions.length === 1 &&
    manifest.host_permissions[0].startsWith(serverOrigin),
  `host_permissions must match config.js serverOrigin (${serverOrigin}), got ${JSON.stringify(manifest.host_permissions)}`,
);
for (const icon of Object.values(manifest.icons)) {
  assert(has(icon), `icon exists: ${icon}`);
}
assert(has(manifest.action.default_popup), "popup.html exists");

// 2. popup.html references.
const html = readFileSync(dir + "popup.html", "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  if (!ref.startsWith("http") && !ref.startsWith("#")) {
    assert(has(ref), `popup.html references existing file: ${ref}`);
  }
}
assert(html.includes('type="module" src="popup.js"'), "popup.js loads as a module");
// Every element id popup.js touches exists in the HTML.
const js = readFileSync(dir + "popup.js", "utf8");
for (const match of js.matchAll(/\$\("([\w-]+)"\)/g)) {
  assert(html.includes(`id="${match[1]}"`), `popup.html has #${match[1]} (used by popup.js)`);
}

// 3. Parser parity (extension mirror === package) — Jira + GitHub PR.
const jiraCases = [
  "https://team.atlassian.net/browse/DEV-101",
  "https://team.atlassian.net/browse/DEV-101/",
  "https://team.atlassian.net/browse/DEV-101?foo=bar",
  "https://x.atlassian.net/jira/browse/ABC-2",
  "http://team.atlassian.net/browse/DEV-101",
  "https://team.atlassian.net/browse/dev-9",
  "https://github.com/a/b/pull/1",
  "https://localhost/browse/DEV-1",
  "chrome://extensions",
  "not a url",
  "https://team.atlassian.net/browse/1-DEV",
  "",
];
for (const url of jiraCases) {
  const a = JSON.stringify(extensionParse(url));
  const b = JSON.stringify(packageParse(url));
  assert(a === b, `parser parity for "${url}": extension=${a} package=${b}`);
}
assert(extensionParse(jiraCases[0])?.ticketId === "DEV-101", "ticket key normalizes to upper case");
assert(packageParse(jiraCases[5])?.ticketId === "DEV-9", "lowercase key upper-cased by package too");

const prCases = [
  "https://github.com/owner/repo/pull/123",
  "https://github.com/owner/repo/pull/123/",
  "https://github.com/owner/repo/pull/123#issuecomment-1",
  "http://github.com/owner/repo/pull/9",
  "https://www.github.com/o.r-e/po_9/pull/7",
  "https://github.com/owner/repo/issues/123",
  "https://gitlab.com/owner/repo/pull/123",
  "https://github.com/owner/repo/pull/abc",
  "",
];
for (const url of prCases) {
  const a = JSON.stringify(extensionParsePr(url));
  const b = JSON.stringify(packageParsePr(url));
  assert(a === b, `PR parser parity for "${url}": extension=${a} package=${b}`);
}
const prRef = extensionParsePr(prCases[0]);
assert(
  prRef && prRef.owner === "owner" && prRef.repo === "repo" && prRef.prNumber === 123,
  "PR ref extracts owner/repo/number",
);

console.log(
  `extension self-check: manifest, html refs, and ${jiraCases.length + prCases.length} parser-parity cases passed`,
);
