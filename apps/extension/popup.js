/**
 * Tracklet popup logic (FR-EXT-04..09).
 *
 * Auth = the application's own Better Auth session: the popup probes
 * {serverOrigin}/api/auth/get-session with credentials — no cookie copying,
 * no token storage (FR-EXT-04). Communicates with the Tracklet API only
 * (FR-EXT-02/03); never fetches Jira or GitHub.
 */

import { parseJiraTicketUrl } from "./lib/parse.js";

/* global CONFIG */

const API = `${CONFIG.serverOrigin}/api/v1`;

const $ = (id) => document.getElementById(id);
const els = {
  status: $("status"),
  form: $("form"),
  url: $("jira-url"),
  preview: $("ticket-preview"),
  track: $("track"),
  confirm: $("confirm"),
  confirmText: $("confirm-text"),
  force: $("force"),
  openExisting: $("open-existing"),
  done: $("done"),
  openTracker: $("open-tracker"),
  signin: $("signin"),
  signinLink: $("signin-link"),
  openApp: $("open-app"),
};

let category = "DEVELOPMENT";

function show(section) {
  for (const key of ["form", "confirm", "done", "signin"]) {
    els[key].hidden = key !== section;
  }
}

function setStatus(message, kind = "") {
  els.status.textContent = message;
  els.status.className = `status ${kind}`;
}

const trackerUrl = (id) => `${CONFIG.webOrigin}/dashboard/trackers/${id}`;

async function createTracker({ jiraUrl, category, allowDuplicate }) {
  const response = await fetch(`${API}/trackers`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jiraUrl, category, allowDuplicate }),
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function submit(allowDuplicate = false) {
  const jiraUrl = els.url.value.trim();
  els.track.disabled = true;
  setStatus("Creating tracker…");
  try {
    const { ok, status, body } = await createTracker({ jiraUrl, category, allowDuplicate });
    if (ok) {
      show("done");
      setStatus("", "");
      els.openTracker.href = trackerUrl(body.id);
      return;
    }
    if (status === 409 && body?.error?.code === "DUPLICATE") {
      const existing = body.resource;
      els.confirmText.textContent = body.error.message;
      els.openExisting.href = existing?.id ? trackerUrl(existing.id) : CONFIG.webOrigin;
      els.force.dataset.pending = "1";
      show("confirm");
      setStatus("", "");
      return;
    }
    if (status === 401) {
      show("signin");
      setStatus("", "");
      return;
    }
    setStatus(body?.error?.message ?? "Request failed. Please try again.", "err");
    show("form");
  } catch {
    setStatus("Can't reach the Tracklet server. Is it running?", "err");
    show("form");
  } finally {
    els.track.disabled = false;
  }
}

async function init() {
  els.openApp.href = CONFIG.webOrigin;
  els.signinLink.href = `${CONFIG.webOrigin}/login`;

  // Session probe (FR-EXT-04): the app's own get-session endpoint. A network
  // failure here is a different story than being signed out.
  let session = null;
  try {
    const response = await fetch(`${CONFIG.serverOrigin}/api/auth/get-session`, {
      credentials: "include",
    });
    session = await response.json().catch(() => null);
  } catch {
    setStatus("Can't reach the Tracklet server. Is it running?", "err");
    return;
  }
  if (!session?.user?.id) {
    show("signin");
    setStatus("", "");
    return;
  }

  // Active-tab prefill (FR-EXT-05): URL only — never page content.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const parsed = tab?.url ? parseJiraTicketUrl(tab.url) : null;
  if (parsed) {
    els.url.value = tab.url;
    els.preview.hidden = false;
    els.preview.textContent = `${parsed.ticketId} ready to track`;
  } else {
    els.url.value = tab?.url?.startsWith("http") ? tab.url : "";
  }
  show("form");
  setStatus(parsed ? "" : "Open the Jira ticket tab, or paste its URL.");
  els.url.focus();
}

// Category pills (FR-EXT-06).
for (const pill of document.querySelectorAll(".pill")) {
  pill.addEventListener("click", () => {
    category = pill.dataset.cat;
    for (const p of document.querySelectorAll(".pill")) {
      const selected = p === pill;
      p.classList.toggle("selected", selected);
      p.setAttribute("aria-checked", String(selected));
    }
  });
}

els.track.addEventListener("click", () => submit(false));
els.force.addEventListener("click", () => {
  // "Create anyway" only fires once per duplicate warning.
  if (els.force.dataset.pending) {
    delete els.force.dataset.pending;
    submit(true);
  }
});
els.url.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && els.url.value.trim()) submit(false);
});

init();
