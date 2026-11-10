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
import { parseJiraTicketUrl as extensionParse } from "../lib/parse.js";
import { parseJiraTicketUrl as packageParse } from "../../../packages/db/src/urls";

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
assert(
  manifest.host_permissions.length === 1 &&
    manifest.host_permissions[0].includes("localhost:8787"),
  "host_permissions limited to the app API (FR-EXT-02/10)",
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

// 3. Parser parity (extension mirror === package).
const cases = [
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
for (const url of cases) {
  const a = JSON.stringify(extensionParse(url));
  const b = JSON.stringify(packageParse(url));
  assert(a === b, `parser parity for "${url}": extension=${a} package=${b}`);
}
assert(extensionParse(cases[0])?.ticketId === "DEV-101", "ticket key normalizes to upper case");
assert(packageParse(cases[5])?.ticketId === "DEV-9", "lowercase key upper-cased by package too");

console.log(`extension self-check: manifest, html/css refs, and ${cases.length} parser-parity cases passed`);
