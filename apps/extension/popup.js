/**
 * Tracklet popup logic (FR-EXT-04..09 + PR attachment).
 *
 * Two modes, auto-picked from the active tab URL:
 * - "Track ticket": Jira URL (+ category) → POST /trackers
 * - "Add PR": GitHub PR URL → pick one of your trackers → POST /trackers/:id/prs
 *
 * Auth = the application's own Better Auth session: the popup probes
 * {serverOrigin}/api/auth/get-session with credentials — no cookie copying,
 * no token storage (FR-EXT-04). Communicates with the Tracklet API only
 * (FR-EXT-02/03); never fetches Jira or GitHub.
 */

import { parseGitHubPrUrl, parseJiraTicketUrl } from "./lib/parse.js";

/* global CONFIG */

const API = `${CONFIG.serverOrigin}/api/v1`;

const $ = (id) => document.getElementById(id);
const els = {
  status: $("status"),
  tabs: $("tabs"),
  tabTicket: $("tab-ticket"),
  tabPr: $("tab-pr"),
  ticket: $("ticket"),
  url: $("jira-url"),
  ticketPreview: $("ticket-preview"),
  track: $("track"),
  pr: $("pr"),
  prUrl: $("pr-url"),
  prPreview: $("pr-preview"),
  trackerSearch: $("tracker-search"),
  trackerList: $("tracker-list"),
  addPr: $("add-pr"),
  confirm: $("confirm"),
  confirmText: $("confirm-text"),
  confirmYes: $("confirm-yes"),
  openExisting: $("open-existing"),
  done: $("done"),
  doneText: $("done-text"),
  openTracker: $("open-tracker"),
  signin: $("signin"),
  signinLink: $("signin-link"),
  openApp: $("open-app"),
};

let mode = "ticket";
let category = "DEVELOPMENT";
let trackers = [];
let selectedTrackerId = null;
// The confirm panel's primary action — set by whichever flow raised the 409.
let confirmAction = null;

const trackerUrl = (id) => `${CONFIG.webOrigin}/dashboard/trackers/${id}`;

function show(section) {
  for (const key of ["ticket", "pr", "confirm", "done", "signin"]) {
    els[key].hidden = key !== section;
  }
  els.tabs.hidden = section !== "ticket" && section !== "pr";
}

function setStatus(message, kind = "") {
  els.status.textContent = message;
  els.status.className = `status ${kind}`;
}

async function api(path, init) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...(init?.method ? { method: init.method } : {}),
    ...(init?.json
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(init.json),
        }
      : {}),
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

// ---------------------------------------------------------------------------
// Mode tabs
// ---------------------------------------------------------------------------

function setMode(next) {
  mode = next;
  const ticket = next === "ticket";
  els.tabTicket.classList.toggle("selected", ticket);
  els.tabTicket.setAttribute("aria-selected", String(ticket));
  els.tabPr.classList.toggle("selected", !ticket);
  els.tabPr.setAttribute("aria-selected", String(!ticket));
  show(ticket ? "ticket" : "pr");
  setStatus("", "");
  if (!ticket) loadTrackers();
}

els.tabTicket.addEventListener("click", () => setMode("ticket"));
els.tabPr.addEventListener("click", () => setMode("pr"));

// ---------------------------------------------------------------------------
// Mode 1: track a Jira ticket (FR-TRK-05..09)
// ---------------------------------------------------------------------------

function ticketPreview() {
  const ref = els.url.value.trim() ? parseJiraTicketUrl(els.url.value.trim()) : null;
  els.ticketPreview.hidden = !els.url.value.trim();
  if (ref) {
    els.ticketPreview.textContent = `${ref.ticketId} ready to track`;
    els.ticketPreview.classList.remove("bad");
  } else {
    els.ticketPreview.textContent = "Not a Jira issue URL yet";
    els.ticketPreview.classList.add("bad");
  }
  return ref;
}

async function submitTicket(allowDuplicate = false) {
  const jiraUrl = els.url.value.trim();
  els.track.disabled = true;
  setStatus("Creating tracker…");
  try {
    const { ok, status, body } = await api("/trackers", {
      method: "POST",
      json: { jiraUrl, category, allowDuplicate },
    });
    if (ok) {
      els.doneText.textContent = `✓ Tracking ${body.ticketId}.`;
      els.openTracker.href = trackerUrl(body.id);
      show("done");
      setStatus("", "");
      return;
    }
    if (status === 409 && body?.error?.code === "DUPLICATE") {
      askConfirm(body, () => submitTicket(true), body.resource?.id);
      return;
    }
    if (status === 401) {
      show("signin");
      setStatus("", "");
      return;
    }
    setStatus(body?.error?.message ?? "Request failed. Please try again.", "err");
    show(mode);
  } catch {
    setStatus("Can't reach the Tracklet server. Is it running?", "err");
    show(mode);
  } finally {
    els.track.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Mode 2: add a PR reference to one of your trackers (FR-PR-02..06)
// ---------------------------------------------------------------------------

async function loadTrackers() {
  els.trackerList.replaceChildren();
  els.addPr.disabled = true;
  selectedTrackerId = null;
  try {
    const { ok, status, body } = await api("/trackers?limit=100");
    if (status === 401) {
      show("signin");
      setStatus("", "");
      return;
    }
    if (!ok) throw new Error("failed");
    trackers = body?.items ?? [];
  } catch {
    setStatus("Can't reach the Tracklet server. Is it running?", "err");
    return;
  }
  renderTrackers();
}

function renderTrackers() {
  const query = els.trackerSearch.value.trim().toUpperCase();
  const matches = trackers.filter((t) => !query || t.ticketId.includes(query));
  selectedTrackerId = null;
  els.addPr.disabled = true;

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = trackers.length
      ? "No tracker matches that ID."
      : "Create a tracker first.";
    els.trackerList.replaceChildren(empty);
    return;
  }

  const rows = matches.map((t) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "row-btn";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", "false");
    row.dataset.id = t.id;

    const ticket = document.createElement("span");
    ticket.className = "ticket";
    ticket.textContent = t.ticketId;
    const meta = document.createElement("span");
    meta.className = "meta";
    const dot = document.createElement("span");
    dot.className = `dot${t.status === "COMPLETED" ? " completed" : ""}`;
    const prs = document.createElement("span");
    prs.textContent = `${t.prCount} PR${t.prCount === 1 ? "" : "s"}`;
    meta.append(dot, prs);
    row.append(ticket, meta);

    row.addEventListener("click", () => {
      selectedTrackerId = t.id;
      for (const other of els.trackerList.querySelectorAll(".row-btn")) {
        other.classList.toggle("selected", other === row);
        other.setAttribute("aria-selected", String(other === row));
      }
      els.addPr.disabled = false;
    });
    return row;
  });
  els.trackerList.replaceChildren(...rows);

  // One match → it's the answer.
  if (matches.length === 1) rows[0].click();
}

function prPreview() {
  const ref = els.prUrl.value.trim() ? parseGitHubPrUrl(els.prUrl.value.trim()) : null;
  els.prPreview.hidden = !els.prUrl.value.trim();
  if (ref) {
    els.prPreview.textContent = `${ref.owner}/${ref.repo} #${ref.prNumber}`;
    els.prPreview.classList.remove("bad");
  } else {
    els.prPreview.textContent = "Not a GitHub PR URL yet";
    els.prPreview.classList.add("bad");
  }
  return ref;
}

async function submitPr(force = false) {
  const ref = prPreview();
  const url = els.prUrl.value.trim();
  if (!ref || !selectedTrackerId) return;
  els.addPr.disabled = true;
  setStatus("Adding PR…");
  try {
    const { ok, status, body } = await api(`/trackers/${selectedTrackerId}/prs`, {
      method: "POST",
      json: { url, force },
    });
    if (ok) {
      els.doneText.textContent = "✓ PR reference added.";
      els.openTracker.href = trackerUrl(selectedTrackerId);
      show("done");
      setStatus("", "");
      return;
    }
    if (status === 409 && body?.error?.code === "PR_USED_ELSEWHERE") {
      // Same-user duplicate → confirmable. The API names the other tracker's
      // ticket but not its id; resolve it from the cached list for the link.
      const existingId = trackers.find(
        (t) => t.ticketId === body.resource?.ticketId,
      )?.id;
      askConfirm(body, () => submitPr(true), existingId);
      return;
    }
    if (status === 401) {
      show("signin");
      setStatus("", "");
      return;
    }
    setStatus(body?.error?.message ?? "Request failed. Please try again.", "err");
    show(mode);
  } catch {
    setStatus("Can't reach the Tracklet server. Is it running?", "err");
    show(mode);
  } finally {
    els.addPr.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Shared: confirmable 409s (FR-TRK-09, FR-PR-06)
// ---------------------------------------------------------------------------

function askConfirm(errorBody, onYes, existingTrackerId) {
  els.confirmText.textContent = errorBody?.error?.message ?? "Are you sure?";
  els.openExisting.href = existingTrackerId ? trackerUrl(existingTrackerId) : CONFIG.webOrigin;
  els.openExisting.hidden = !existingTrackerId;
  confirmAction = onYes;
  show("confirm");
  setStatus("", "");
}

els.confirmYes.addEventListener("click", () => {
  const action = confirmAction;
  confirmAction = null;
  action?.();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  els.openApp.href = CONFIG.webOrigin;
  els.signinLink.href = `${CONFIG.webOrigin}/login`;
  wireInputs();

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
  afterAuth();
}

function afterAuth() {
  // Active-tab prefill (FR-EXT-05): URL only — never page content.
  chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => {
      const tabUrl = tab?.url ?? "";
      const jira = parseJiraTicketUrl(tabUrl);
      const pr = parseGitHubPrUrl(tabUrl);
      if (pr) {
        setMode("pr");
        els.prUrl.value = tabUrl;
        prPreview();
      } else if (jira) {
        setMode("ticket");
        els.url.value = tabUrl;
        ticketPreview();
      } else {
        setMode("ticket");
        els.url.value = tabUrl.startsWith("http") ? tabUrl : "";
        ticketPreview();
      }
      els.url.focus();
    })
    .catch(() => {
      setMode("ticket");
      setStatus("Open the Jira ticket tab, or paste its URL.");
    });
}

function wireInputs() {
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

  els.url.addEventListener("input", ticketPreview);
  els.prUrl.addEventListener("input", prPreview);
  els.trackerSearch.addEventListener("input", () => renderTrackers());
  els.track.addEventListener("click", () => submitTicket(false));
  els.addPr.addEventListener("click", () => submitPr(false));
  els.url.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && els.url.value.trim()) submitTicket(false);
  });
  els.prUrl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !els.addPr.disabled) submitPr(false);
  });
}

init();
