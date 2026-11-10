/*
  Data layer for the faculty journey site.
  Both pages only talk to window.Store (load, save, reset, hasDraft).
  To change where data is saved, edit CONFIG below or replace the adapter at the bottom.

  Default behaviour (no backend needed):
    - Public page loads data/events.json.
    - Admin page loads the saved draft from this browser if one exists, otherwise data/events.json.
    - Saving in admin stores a draft in this browser only. Add ?preview=draft to index.html to see it.

  Remote behaviour (when you are ready):
    - Set CONFIG.endpoint to a URL (for example a Google Apps Script web app).
    - load: GET endpoint            -> returns the full data JSON
    - save: POST endpoint with JSON {key, data} -> returns {ok:true}
    - The public page then reads from the endpoint too.
*/
(function () {
  var CONFIG = {
    endpoint: "",          // leave empty to use the browser draft
    dataUrl: "data/events.json",
    draftKey: "mse-journey-draft-v1"
  };

  function fetchJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + url + " (" + r.status + ")");
      return r.json();
    });
  }

  function readDraft() {
    try {
      var raw = localStorage.getItem(CONFIG.draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  var Store = {
    config: CONFIG,
    usesRemote: function () { return !!CONFIG.endpoint; },
    hasDraft: function () { return !!readDraft(); },

    // mode: "public" (default), "preview" (draft if present), "admin" (draft if present)
    load: function (mode) {
      if (CONFIG.endpoint) return fetchJSON(CONFIG.endpoint);
      if (mode === "preview" || mode === "admin") {
        var d = readDraft();
        if (d) return Promise.resolve(d);
      }
      return fetchJSON(CONFIG.dataUrl);
    },

    // Returns a promise resolving to {ok:boolean, where:string, message:string}
    save: function (data, adminKey) {
      if (CONFIG.endpoint) {
        return fetch(CONFIG.endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ key: adminKey || "", data: data })
        }).then(function (r) { return r.json(); }).then(function (res) {
          return { ok: !!res.ok, where: "server", message: res.ok ? "Saved to the server." : (res.error || "The server refused the save.") };
        }).catch(function (e) {
          return { ok: false, where: "server", message: "Could not reach the server: " + e.message };
        });
      }
      try {
        localStorage.setItem(CONFIG.draftKey, JSON.stringify(data));
        return Promise.resolve({ ok: true, where: "browser", message: "Saved as a draft in this browser. Open index.html?preview=draft to see it." });
      } catch (e) {
        return Promise.resolve({ ok: false, where: "browser", message: "This browser blocked saving: " + e.message });
      }
    },

    // Discard the local draft and go back to the published file
    reset: function () {
      try { localStorage.removeItem(CONFIG.draftKey); } catch (e) {}
      return fetchJSON(CONFIG.dataUrl);
    }
  };

  window.Store = Store;
})();
