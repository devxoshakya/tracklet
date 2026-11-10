// Popup configuration — edit these to point the extension at your Tracklet.
//
// serverOrigin: the Tracklet API (auth session cookies are sent here).
// webOrigin:    the Tracklet web app (sign-in + "open tracker" links).
// After editing, reload the extension at chrome://extensions.
//
// FR-EXT-02/10: these are the ONLY origins the extension talks to.
const CONFIG = {
  serverOrigin: "http://localhost:8787",
  webOrigin: "http://localhost:3000",
};
