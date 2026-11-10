// Popup configuration — edit these to point the extension at your Tracklet.
//
// serverOrigin: the Tracklet API (auth session cookies are sent here).
// webOrigin:    the Tracklet web app (sign-in + "open tracker" links).
// After editing, reload the extension at chrome://extensions.
//
// FR-EXT-02/10: these are the ONLY origins the extension talks to.
const CONFIG = {
  serverOrigin: "https://tracklet-server-live-devxoshakya-cjztvkdlzw57ggpd.devxoshakya.workers.dev",
  webOrigin: "https://tracklet-web-live-devxoshakya-4qpu2t7yncdoitcp.devxoshakya.workers.dev",
};
