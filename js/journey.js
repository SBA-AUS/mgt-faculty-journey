(function () {
  var h = Core.h;
  var data, cats, now, current, activeTerm;
  var selected = {};  // categories the visitor chose to show; none chosen means show all
  var TERM_ORDER = ["fall", "spring", "summer"];

  var mode = /[?&]preview=draft/.test(location.search) ? "preview" : "public";

  Store.load(mode).then(init).catch(function (e) {
    var main = document.getElementById("main");
    main.innerHTML = "";
    main.appendChild(h("div", { class: "error", role: "alert" },
      h("strong", { text: "The timeline could not be loaded." }),
      h("p", { text: e.message + ". If you opened this file directly from a folder, view it through GitHub Pages or a local web server instead." })));
  });

  function init(d) {
    data = d;
    cats = d.categories;
    now = Core.today();
    activeTerm = Core.pickTerm(d.terms, now);

    if (mode === "preview") {
      var b = document.getElementById("preview-banner");
      b.hidden = false;
      b.textContent = "Previewing the draft saved in this browser. It is not published.";
    }
    document.getElementById("ay").textContent = d.meta.academicYear;
    document.getElementById("ay-util").textContent = d.meta.academicYear;
    var u = d.meta.updated ? Core.parse(d.meta.updated) : null;
    document.getElementById("updated").textContent = u ? ("0" + u.getDate()).slice(-2) + "-" + Core.MONTHS[u.getMonth()] + "-" + u.getFullYear() : "";

    renderTabs();
    renderLegend();
    renderStats();
    renderTerm();
    renderAllYear();
    openFromHash();
  }

  /* ---------- helpers ---------- */
  function termEvents(termKey) {
    return data.events.filter(function (e) { return e.term === termKey; });
  }
  function rowsFor(termKey) { return Core.rows(data.terms[termKey]); }
  function currentRow(termKey) {
    var rs = rowsFor(termKey), hit = null;
    rs.forEach(function (r) { if (r.start && r.end && now >= r.start && now <= r.end) hit = r; });
    return hit;
  }
  function eventsInRow(termKey, row) {
    return termEvents(termKey).filter(function (e) {
      if (e.week === undefined) return false;
      if (typeof e.week === "string") return e.week === row.key;
      var end = typeof e.weekEnd === "number" ? e.weekEnd : e.week;
      return typeof row.key === "number" && row.key >= e.week && row.key <= end && row.key === e.week;
    });
  }
  function findEvent(id) {
    for (var i = 0; i < data.events.length; i++) if (data.events[i].id === id) return data.events[i];
    return null;
  }
  function catOf(e) { return cats[e.category] || { label: e.category, color: "#999" }; }

  /* ---------- header bits ---------- */
  function renderTabs() {
    var box = document.getElementById("tabs");
    box.innerHTML = "";
    TERM_ORDER.forEach(function (k) {
      var t = data.terms[k];
      if (!t) return;
      var isNow = !!currentRow(k);
      var b = h("button", {
        class: "tab", role: "tab", id: "tab-" + k, "aria-selected": k === activeTerm ? "true" : "false",
        "aria-controls": "panel", onclick: function () { activeTerm = k; renderTabs(); renderTerm(); }
      }, t.label, isNow ? h("span", { class: "dot", title: "Current term", "aria-label": "current term" }) : null);
      box.appendChild(b);
    });
  }

  function anySelected() { return Object.keys(selected).some(function (k) { return selected[k]; }); }

  function renderLegend() {
    var box = document.getElementById("legend");
    box.innerHTML = "";
    Object.keys(cats).forEach(function (k) {
      var b = h("button", {
        class: "filter", "aria-pressed": selected[k] ? "true" : "false", type: "button",
        onclick: function () { selected[k] = !selected[k]; refresh(); }
      }, h("span", { class: "sw", style: "background:" + cats[k].color }), cats[k].label);
      box.appendChild(b);
    });
    if (anySelected()) {
      box.appendChild(h("button", { class: "filter clear", type: "button", onclick: function () { selected = {}; refresh(); } }, "Show all"));
    }
  }

  function refresh() { renderLegend(); renderTerm(); renderAllYear(); }

  /* ---------- stats band ---------- */
  function renderStats() {
    var box = document.getElementById("band-inner");
    box.innerHTML = "";

    // Find the term we are in (or the next one)
    var where = null;
    TERM_ORDER.forEach(function (k) {
      if (!where && data.terms[k] && currentRow(k)) where = { term: k, row: currentRow(k) };
    });

    var s1 = h("div", { class: "stat" }, h("h2", { text: "Where we are" }));
    if (where) {
      var t = data.terms[where.term];
      s1.appendChild(h("p", { class: "big", text: t.label + ", " + where.row.title }));
      s1.appendChild(h("p", { class: "small", text: where.row.sub }));
    } else {
      var up = null;
      TERM_ORDER.forEach(function (k) {
        var t2 = data.terms[k];
        if (t2 && !up && Core.parse(t2.start) > now) up = t2;
      });
      s1.appendChild(h("p", { class: "big", text: up ? "Between terms" : "Term ended" }));
      s1.appendChild(h("p", { class: "small", text: up ? up.label + " classes start " + Core.short(Core.parse(up.start)) : "See the next academic year's dates when published." }));
    }
    box.appendChild(s1);

    // This week and coming up
    var thisWeek = [], coming = [];
    if (where) {
      thisWeek = eventsInRow(where.term, where.row);
      var rs = rowsFor(where.term);
      var idx = rs.findIndex(function (x) { return x.key === where.row.key; });
      for (var i = idx + 1; i < rs.length && coming.length < 4; i++) {
        coming = coming.concat(eventsInRow(where.term, rs[i]).map(function (e) { return { e: e, row: rs[i] }; }));
      }
      coming = coming.slice(0, 4);
    }

    var s2 = h("div", { class: "stat" }, h("h2", { text: "This week" }));
    if (thisWeek.length) {
      var ul = h("ul");
      thisWeek.forEach(function (e) { ul.appendChild(h("li", null, evButton(e))); });
      s2.appendChild(ul);
    } else {
      s2.appendChild(h("p", { class: "small", text: "Nothing is scheduled this week." }));
    }
    box.appendChild(s2);

    var s3 = h("div", { class: "stat" }, h("h2", { text: "Coming up" }));
    if (coming.length) {
      var ul2 = h("ul");
      coming.forEach(function (c) {
        ul2.appendChild(h("li", null, evButton(c.e), " ", h("span", { class: "small", text: "(" + c.row.title + ")" })));
      });
      s3.appendChild(ul2);
    } else {
      s3.appendChild(h("p", { class: "small", text: "Nothing more in this term." }));
    }
    box.appendChild(s3);
  }

  function evButton(e) {
    return h("button", { type: "button", onclick: function () { openEvent(e.id); } }, e.title);
  }

  /* ---------- timeline ---------- */
  function visible(e) { return !anySelected() || !!selected[e.category]; }

  function chip(e) {
    var c = catOf(e);
    var meta = e.dateText || "";
    return h("button", {
      class: "chip", type: "button", style: "--cc:" + c.color, "data-id": e.id,
      onclick: function () { openEvent(e.id); }
    }, h("span", { class: "t", text: e.title }), meta ? h("span", { class: "m", text: meta }) : null);
  }

  function renderTerm() {
    var t = data.terms[activeTerm];
    var panel = document.getElementById("panel");
    panel.setAttribute("aria-labelledby", "tab-" + activeTerm);
    var info = document.getElementById("term-info");
    info.textContent = "Classes start " + Core.short(Core.parse(t.start)) + ", " + Core.parse(t.start).getFullYear() +
      ". " + t.weeks + " weeks. Finals " + Core.range(Core.parse(t.finalsStart), Core.parse(t.finalsEnd)) + ".";

    var body = document.getElementById("rows");
    body.innerHTML = "";
    var rs = rowsFor(activeTerm);
    var cur = currentRow(activeTerm);
    var pending = [];

    function flush() {
      if (!pending.length) return;
      var a = pending[0], b = pending[pending.length - 1];
      var label = pending.length === 1 ? a.title : "Weeks " + a.key + " - " + b.key;
      if (typeof a.key !== "number") label = a.title;
      body.appendChild(h("div", { class: "wk empty" },
        h("div", { class: "wk-h" }, h("span", { class: "n", text: label })),
        h("div", { class: "wk-b", text: "Nothing scheduled" })));
      pending = [];
    }

    rs.forEach(function (r) {
      var evs = eventsInRow(activeTerm, r).filter(visible);
      var isCur = !!cur && cur.key === r.key;
      var isBreak = !!r.isBreak;
      var skipIfEmpty = (r.key === "finals" || r.key === "after");
      if (!evs.length && !isCur && !isBreak) {
        if (skipIfEmpty) { flush(); return; }
        pending.push(r);
        return;
      }
      flush();
      var cls = "wk" + (isCur ? " current" : "") + (isBreak ? " break" : "") + (r.end && r.end < now ? " past" : "");
      var head = h("div", { class: "wk-h" },
        h("span", { class: "n", text: r.title }),
        h("span", { class: "d", text: r.sub }),
        isCur ? h("span", { class: "now", text: "This week" }) : null);
      var cell = h("div", { class: "wk-b" });
      if (isBreak) cell.appendChild(h("div", { text: "No classes." }));
      evs.forEach(function (e) { cell.appendChild(chip(e)); });
      if (!evs.length && !isBreak) cell.appendChild(h("div", { class: "sm-note", text: "Nothing scheduled this week" }));
      body.appendChild(h("div", { class: cls }, head, cell));
    });
    flush();
  }

  function renderAllYear() {
    var box = document.getElementById("links");
    box.innerHTML = "";
    Object.keys(cats).forEach(function (k) {
      if (!visible({ category: k })) return;
      var items = data.events.filter(function (e) { return e.term === "year" && e.category === k; });
      var links = data.links.filter(function (l) { return l.group === k; });
      if (!items.length && !links.length) return;
      var ul = h("ul", { class: "help-list" });
      items.forEach(function (e) {
        ul.appendChild(h("li", null,
          h("button", { class: "help-link", type: "button", onclick: function () { openEvent(e.id); } }, e.title),
          e.dateText ? h("span", { class: "help-desc", text: e.dateText }) : null));
      });
      links.forEach(function (l) {
        ul.appendChild(h("li", null,
          h("a", { href: Core.safeUrl(l.url), target: "_blank", rel: "noopener" }, l.label),
          l.desc ? h("span", { class: "help-desc", text: l.desc }) : null));
      });
      box.appendChild(h("div", { class: "help-group", style: "--cc:" + cats[k].color },
        h("h3", null, h("span", { class: "sw", style: "background:" + cats[k].color }), cats[k].label), ul));
    });
  }

  /* ---------- dialogs ---------- */
  var dlg = document.getElementById("ev-dialog");
  var cdlg = document.getElementById("coord-dialog");

  function openEvent(id) {
    var e = findEvent(id);
    if (!e) return;
    var c = catOf(e);
    var box = document.getElementById("ev-body");
    box.innerHTML = "";
    var pc = h("div", { class: "pc", style: "--cc:" + c.color });
    pc.appendChild(h("button", { class: "x", type: "button", "aria-label": "Close", onclick: function () { dlg.close(); } }, "×"));
    pc.appendChild(h("p", { class: "cat", text: c.label }));
    pc.appendChild(h("h3", { id: "ev-title", text: e.title }));
    if (e.dateText) pc.appendChild(h("p", { class: "when", text: e.dateText }));
    if (e.description) pc.appendChild(h("p", { text: e.description }));
    if (e.tip) pc.appendChild(h("p", { class: "tip" }, h("strong", { text: "Tip: " }), e.tip));
    var acts = h("div", { class: "acts" });
    if (e.action === "coordinators") {
      acts.appendChild(h("button", { class: "btn", type: "button", onclick: function () { dlg.close(); openCoordinators(); } }, "Submit to your course coordinator"));
    }
    if (e.action === "examguide") {
      acts.appendChild(h("button", { class: "btn", type: "button", onclick: function () { dlg.close(); openGuide("exam"); } }, "How to read the schedule"));
    }
    (e.links || []).forEach(function (l) {
      acts.appendChild(h("a", { class: "btn ghost", href: Core.safeUrl(l.url), target: "_blank", rel: "noopener" }, l.label));
    });
    if (acts.childNodes.length) pc.appendChild(acts);
    box.appendChild(pc);
    dlg.setAttribute("aria-labelledby", "ev-title");
    if (!dlg.open) dlg.showModal();
    try { history.replaceState(null, "", "#e-" + id); } catch (err) {}
  }

  function openCoordinators() {
    var box = document.getElementById("coord-body");
    box.innerHTML = "";
    var pc = h("div", { class: "pc", style: "--cc:" + (cats.teaching ? cats.teaching.color : "#1f5f99") });
    pc.appendChild(h("button", { class: "x", type: "button", "aria-label": "Close", onclick: function () { cdlg.close(); } }, "×"));
    pc.appendChild(h("p", { class: "cat", text: cats.teaching ? cats.teaching.label : "Teaching" }));
    pc.appendChild(h("h3", { id: "coord-title", text: "Course coordinators" }));
    pc.appendChild(h("p", { text: "Send your syllabus to the coordinator of your course for approval, then to the Head of Department." }));
    var list = data.coordinators || [];
    if (!list.length) {
      pc.appendChild(h("div", { class: "empty-note", text: "The list of coordinators is coming soon." }));
    } else {
      var ul = h("ul", { class: "coord-list" });
      list.forEach(function (c) {
        var li = h("li", null, h("div", { class: "c", text: c.course + (c.name ? " - " + c.name : "") }));
        var who = [c.coordinator, c.email].filter(Boolean);
        if (who.length) {
          var line = h("div", { class: "e" }, c.coordinator || "");
          if (c.email) {
            if (c.coordinator) line.appendChild(document.createTextNode(", "));
            line.appendChild(h("a", { href: "mailto:" + c.email, text: c.email }));
          }
          li.appendChild(line);
        }
        ul.appendChild(li);
      });
      pc.appendChild(ul);
    }
    box.appendChild(pc);
    cdlg.setAttribute("aria-labelledby", "coord-title");
    if (!cdlg.open) cdlg.showModal();
  }

  var gdlg = document.getElementById("guide-dialog");
  function openGuide(key) {
    var g = (data.guides || {})[key];
    if (!g) return;
    var box = document.getElementById("guide-body");
    box.innerHTML = "";
    var pc = h("div", { class: "pc", style: "--cc:" + (cats.teaching ? cats.teaching.color : "#1f5f99") });
    pc.appendChild(h("button", { class: "x", type: "button", "aria-label": "Close", onclick: function () { gdlg.close(); } }, "\u00d7"));
    pc.appendChild(h("p", { class: "cat", text: "Final exams" }));
    pc.appendChild(h("h3", { id: "guide-title", text: g.title }));
    g.sections.forEach(function (s) {
      pc.appendChild(h("h4", { class: "guide-h", text: s.heading }));
      pc.appendChild(h("p", { text: s.text }));
    });
    box.appendChild(pc);
    gdlg.setAttribute("aria-labelledby", "guide-title");
    if (!gdlg.open) gdlg.showModal();
  }

  [dlg, cdlg, gdlg].forEach(function (d) {
    d.addEventListener("click", function (ev) { if (ev.target === d) d.close(); });
  });
  dlg.addEventListener("close", function () {
    try { history.replaceState(null, "", location.pathname + location.search); } catch (err) {}
  });

  function openFromHash() {
    var m = /^#e-(.+)$/.exec(location.hash);
    if (!m) return;
    var e = findEvent(decodeURIComponent(m[1]));
    if (e) {
      if (e.term !== "year" && data.terms[e.term]) { activeTerm = e.term; renderTabs(); renderTerm(); }
      openEvent(e.id);
    }
  }
})();
