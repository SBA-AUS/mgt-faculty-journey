(function () {
  var h = Core.h;
  var model, baseline, dirty = false;
  var TERMS = ["fall", "spring", "summer"];
  var filter = { term: "", cat: "", q: "" };

  function $(id) { return document.getElementById(id); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  Store.load("admin").then(function (d) {
    model = d; baseline = clone(d);
    if (!model.coordinators) model.coordinators = [];
    $("app").hidden = false;
    if (Store.usesRemote()) $("key-wrap").hidden = false;
    $("btn-reset").hidden = Store.usesRemote();
    setState(Store.hasDraft() ? "Showing the draft saved in this browser." : "Showing the published data.", false);
    init();
  }).catch(function (e) {
    $("state").textContent = "Could not load the data: " + e.message;
  });

  function setState(msg, isDirty) {
    dirty = isDirty;
    var s = $("state");
    s.textContent = isDirty ? "Unsaved changes" : msg;
    s.className = "state" + (isDirty ? " dirty" : "");
  }
  function touch() { setState("", true); }
  function toast(msg, bad) {
    var t = $("toast");
    t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 4500);
  }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  function field(label, input, id) {
    return h("div", null, h("label", { for: id, text: label }), input);
  }
  function text(id, val, on, type) {
    return h("input", { type: type || "text", id: id, value: val || "", oninput: function (e) { on(e.target.value); touch(); } });
  }

  function init() {
    $("m-ay").value = model.meta.academicYear || "";
    $("m-ay").addEventListener("input", function (e) { model.meta.academicYear = e.target.value; touch(); });

    var ft = $("f-term");
    [["", "All"], ["fall", "Fall"], ["spring", "Spring"], ["summer", "Summer"], ["year", "All year"]].forEach(function (o) { ft.appendChild(h("option", { value: o[0], text: o[1] })); });
    var fc = $("f-cat");
    fc.appendChild(h("option", { value: "", text: "All" }));
    Object.keys(model.categories).forEach(function (k) { fc.appendChild(h("option", { value: k, text: model.categories[k].label })); });
    ft.onchange = function () { filter.term = ft.value; renderEvents(); };
    fc.onchange = function () { filter.cat = fc.value; renderEvents(); };
    $("f-q").oninput = function (e) { filter.q = e.target.value.toLowerCase(); renderEvents(); };
    $("btn-add").onclick = function () { editEvent(null); };
    $("btn-add-link").onclick = function () { model.links.push({ id: "l" + Date.now(), label: "", url: "", desc: "", group: Object.keys(model.categories)[0] }); renderLinks(); touch(); };
    $("btn-add-coord").onclick = function () { model.coordinators.push({ course: "", name: "", coordinator: "", email: "" }); renderCoords(); touch(); };
    $("btn-save").onclick = save;
    $("btn-discard").onclick = function () {
      if (dirty && !confirm("Discard your unsaved changes?")) return;
      model = clone(baseline); rerender(); setState("Changes discarded.", false);
    };
    $("btn-reset").onclick = function () {
      if (!confirm("Delete the draft saved in this browser and go back to the published file?")) return;
      Store.reset().then(function (d) { model = d; baseline = clone(d); if (!model.coordinators) model.coordinators = []; rerender(); setState("Reset to the published data.", false); });
    };
    rerender();
  }

  function rerender() {
    $("m-ay").value = model.meta.academicYear || "";
    renderTerms(); renderEvents(); renderLinks(); renderCoords();
  }

  function save() {
    model.meta.updated = Core.iso(new Date());
    $("btn-save").disabled = true;
    Store.save(model, $("admin-key").value).then(function (res) {
      $("btn-save").disabled = false;
      if (res.ok) { baseline = clone(model); setState(res.message, false); toast(res.message); }
      else toast(res.message, true);
    });
  }

  /* ---------- terms ---------- */
  function renderTerms() {
    var box = $("terms"); box.innerHTML = "";
    TERMS.forEach(function (k) {
      var t = model.terms[k];
      var g = h("div", { class: "grid" },
        field("Label", text("t-" + k + "-l", t.label, function (v) { t.label = v; }), "t-" + k + "-l"),
        field("Classes start (Monday)", text("t-" + k + "-s", t.start, function (v) { t.start = v; }, "date"), "t-" + k + "-s"),
        field("Numbered teaching weeks", text("t-" + k + "-w", t.weeks, function (v) { t.weeks = parseInt(v, 10) || 1; }, "number"), "t-" + k + "-w"),
        field("Finals start", text("t-" + k + "-fs", t.finalsStart, function (v) { t.finalsStart = v; }, "date"), "t-" + k + "-fs"),
        field("Finals end", text("t-" + k + "-fe", t.finalsEnd, function (v) { t.finalsEnd = v; }, "date"), "t-" + k + "-fe"));
      var br = h("div", { class: "breaks" }, h("label", { text: "Breaks (a week with no classes, not numbered)" }));
      (t.breaks || []).forEach(function (b, i) {
        br.appendChild(h("div", { class: "break-row" },
          h("input", { type: "number", "aria-label": "Insert after teaching week", title: "Insert after teaching week", value: b.after, oninput: function (e) { b.after = parseInt(e.target.value, 10) || 1; touch(); } }),
          h("input", { type: "text", "aria-label": "Break label", value: b.label, oninput: function (e) { b.label = e.target.value; touch(); } }),
          h("button", { class: "btn danger small", type: "button", onclick: function () { t.breaks.splice(i, 1); renderTerms(); touch(); } }, "Remove")));
      });
      br.appendChild(h("button", { class: "btn ghost small", type: "button", onclick: function () { t.breaks = t.breaks || []; t.breaks.push({ after: 1, label: "Break" }); renderTerms(); touch(); } }, "Add break"));
      box.appendChild(h("div", { class: "term-block" }, h("h3", { text: k.charAt(0).toUpperCase() + k.slice(1) }), g, br));
    });
  }

  /* ---------- events ---------- */
  function weekText(e) {
    if (e.term === "year") return "All year";
    if (e.week === "finals") return "Finals";
    if (e.week === "after") return "After semester";
    return "Week " + e.week + (e.weekEnd ? " to " + e.weekEnd : "");
  }
  function sortKey(e) {
    var w = e.week === "finals" ? 900 : e.week === "after" ? 901 : (e.week === undefined ? 999 : e.week);
    return (e.term === "year" ? 9 : TERMS.indexOf(e.term)) * 1000 + w;
  }

  function renderEvents() {
    var tb = $("ev-table").querySelector("tbody"); tb.innerHTML = "";
    var list = model.events.filter(function (e) {
      if (filter.term && e.term !== filter.term) return false;
      if (filter.cat && e.category !== filter.cat) return false;
      if (filter.q && (e.title + " " + (e.dateText || "")).toLowerCase().indexOf(filter.q) < 0) return false;
      return true;
    }).sort(function (a, b) { return sortKey(a) - sortKey(b); });
    list.forEach(function (e) {
      var c = model.categories[e.category] || { label: e.category, color: "#999" };
      var tr = h("tr", null,
        h("td", { "data-label": "Semester", text: e.term }),
        h("td", { "data-label": "Week", text: weekText(e) }),
        h("td", { "data-label": "Event" }, h("span", { class: "tag", style: "background:" + c.color, text: c.label }), " ", e.title),
        h("td", { "data-label": "Note", text: e.dateText || "" }),
        h("td", { "data-label": "Actions" },
          h("div", { class: "row" },
            h("button", { class: "btn ghost small", type: "button", onclick: function () { editEvent(e); } }, "Edit"),
            h("button", { class: "btn ghost small", type: "button", onclick: function () { duplicate(e); } }, "Duplicate"),
            h("button", { class: "btn danger small", type: "button", onclick: function () { remove(e); } }, "Delete"))));
      tb.appendChild(tr);
    });
    $("ev-count").textContent = list.length + " of " + model.events.length + " events shown.";
  }

  function duplicate(e) {
    var c = clone(e); c.id = "ev" + Date.now(); c.title = e.title + " (copy)";
    model.events.push(c); renderEvents(); touch(); toast("Duplicated. Edit the copy to change its semester or week.");
  }
  function remove(e) {
    if (!confirm('Delete "' + e.title + '"?')) return;
    model.events.splice(model.events.indexOf(e), 1); renderEvents(); touch();
  }

  function editEvent(e) {
    var isNew = !e;
    var d = isNew ? { id: "ev" + Date.now(), term: "fall", week: 1, category: "teaching", audience: "all", title: "", dateText: "", description: "", tip: "", links: [] } : clone(e);
    var form = $("ed-form"); form.innerHTML = "";

    var term = h("select", { id: "e-term" }, ["fall", "spring", "summer", "year"].map(function (k) { return h("option", { value: k, text: k === "year" ? "All year" : k.charAt(0).toUpperCase() + k.slice(1), selected: d.term === k }); }));
    var week = h("select", { id: "e-week" });
    var weekEnd = h("input", { type: "number", id: "e-wend", min: "1", value: d.weekEnd || "" });
    function fillWeeks() {
      week.innerHTML = "";
      var t = model.terms[term.value];
      week.disabled = weekEnd.disabled = term.value === "year";
      if (!t) return;
      var rows = Core.rows(t);
      rows.forEach(function (r) {
        if (r.isBreak) return;
        var label = r.title + " (" + r.sub + ")";
        week.appendChild(h("option", { value: String(r.key), text: label, selected: String(d.week) === String(r.key) }));
      });
    }
    term.onchange = function () { d.week = 1; fillWeeks(); };
    fillWeeks();

    var cat = h("select", { id: "e-cat" }, Object.keys(model.categories).map(function (k) { return h("option", { value: k, text: model.categories[k].label, selected: d.category === k }); }));
    var aud = h("select", { id: "e-aud" },
      h("option", { value: "all", text: "All faculty", selected: d.audience === "all" }),
      h("option", { value: "new", text: "Mainly new faculty", selected: d.audience === "new" }));
    var title = h("input", { type: "text", id: "e-title", value: d.title, required: true });
    var dateText = h("input", { type: "text", id: "e-date", value: d.dateText || "", placeholder: "For example: Thu Oct 1, 2026, 4 pm" });
    var desc = h("textarea", { id: "e-desc" }, d.description || "");
    var tip = h("input", { type: "text", id: "e-tip", value: d.tip || "" });
    var action = h("select", { id: "e-action" },
      h("option", { value: "", text: "None", selected: !d.action }),
      h("option", { value: "coordinators", text: "Submit to your course coordinator (opens the coordinator list)", selected: d.action === "coordinators" }),
      h("option", { value: "examguide", text: "How to read the schedule (opens the exam guide)", selected: d.action === "examguide" }));

    var linkBox = h("div");
    function renderLinkRows() {
      linkBox.innerHTML = "";
      d.links.forEach(function (l, i) {
        linkBox.appendChild(h("div", { class: "link-row" },
          h("input", { type: "text", "aria-label": "Link label", placeholder: "Label", value: l.label, oninput: function (ev) { l.label = ev.target.value; } }),
          h("input", { type: "text", "aria-label": "Link address", placeholder: "https://", value: l.url, oninput: function (ev) { l.url = ev.target.value; } }),
          h("button", { class: "btn danger small", type: "button", onclick: function () { d.links.splice(i, 1); renderLinkRows(); } }, "Remove")));
      });
    }
    renderLinkRows();

    form.appendChild(h("h3", { text: isNew ? "Add event" : "Edit event" }));
    form.appendChild(h("div", { class: "grid" },
      h("div", { class: "full" }, h("label", { for: "e-title", text: "Title" }), title),
      field("Semester", term, "e-term"), field("Week", week, "e-week"), field("Spans until week (optional)", weekEnd, "e-wend"),
      field("Category", cat, "e-cat"), field("Audience", aud, "e-aud"),
      h("div", { class: "full" }, h("label", { for: "e-date", text: "Short note under the title (optional, for example Weekly or Due June 1)" }), dateText),
      h("div", { class: "full" }, h("label", { for: "e-desc", text: "Description" }), desc),
      h("div", { class: "full" }, h("label", { for: "e-tip", text: "Tip" }), tip),
      h("div", { class: "full" }, h("label", { text: "Links" }), linkBox,
        h("button", { class: "btn ghost small", type: "button", onclick: function () { d.links.push({ label: "", url: "" }); renderLinkRows(); } }, "Add link")),
      h("div", { class: "full" }, h("label", { for: "e-action", text: "Extra button" }), action)));
    form.appendChild(h("div", { class: "row" },
      h("button", { class: "btn", type: "submit", value: "ok" }, "Apply"),
      h("button", { class: "btn ghost", type: "button", onclick: function () { $("ed").close(); } }, "Cancel"),
      h("span", { class: "sm-note", text: "Applying updates the list. Use Save at the top to keep it." })));

    form.onsubmit = function (ev) {
      ev.preventDefault();
      if (!title.value.trim()) { title.focus(); return; }
      d.title = title.value.trim(); d.term = term.value; d.category = cat.value; d.audience = aud.value;
      d.dateText = dateText.value.trim(); d.description = desc.value.trim(); d.tip = tip.value.trim();
      delete d.history; delete d.status;
      d.links = d.links.filter(function (l) { return l.url.trim(); }).map(function (l) { return { label: l.label.trim() || l.url.trim(), url: l.url.trim() }; });
      if (action.value) d.action = action.value; else delete d.action;
      if (d.term === "year") { delete d.week; delete d.weekEnd; }
      else {
        d.week = (week.value === "finals" || week.value === "after") ? week.value : parseInt(week.value, 10);
        var we = parseInt(weekEnd.value, 10);
        if (we && typeof d.week === "number" && we > d.week) d.weekEnd = we; else delete d.weekEnd;
      }
      if (isNew) model.events.push(d); else model.events[model.events.indexOf(e)] = d;
      $("ed").close(); renderEvents(); touch();
    };
    var dlg = $("ed");
    dlg.style.maxWidth = "720px";
    dlg.showModal();
  }

  /* ---------- links ---------- */
  function renderLinks() {
    var box = $("links"); box.innerHTML = "";
    var groups = Object.keys(model.categories).map(function (k) { return { id: k, label: model.categories[k].label }; });
    groups.push({ id: "campus", label: "Campus Life (bottom line)" });
    model.links.forEach(function (l, i) {
      var sel = h("select", { "aria-label": "Group", onchange: function (e) { l.group = e.target.value; touch(); } },
        groups.map(function (g) { return h("option", { value: g.id, text: g.label, selected: l.group === g.id }); }));
      box.appendChild(h("div", { class: "key-row" },
        h("input", { type: "text", "aria-label": "Link label", value: l.label, oninput: function (e) { l.label = e.target.value; touch(); } }),
        h("input", { type: "text", "aria-label": "Link address", value: l.url, oninput: function (e) { l.url = e.target.value; touch(); } }),
        sel,
        h("button", { class: "btn danger small", type: "button", onclick: function () { model.links.splice(i, 1); renderLinks(); touch(); } }, "Remove")));
    });
  }

  /* ---------- coordinators ---------- */
  function renderCoords() {
    var box = $("coords"); box.innerHTML = "";
    if (!model.coordinators.length) box.appendChild(h("p", { class: "sm-note", text: "No coordinators yet." }));
    model.coordinators.forEach(function (c, i) {
      function f(key, label) {
        return h("input", { type: "text", "aria-label": label, placeholder: label, value: c[key] || "", oninput: function (e) { c[key] = e.target.value; touch(); } });
      }
      box.appendChild(h("div", { class: "grid", style: "margin-bottom:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr)) auto" },
        f("course", "Course code"), f("name", "Course name"), f("coordinator", "Coordinator"), f("email", "Email"),
        h("button", { class: "btn danger small", type: "button", onclick: function () { model.coordinators.splice(i, 1); renderCoords(); touch(); } }, "Remove")));
    });
  }
})();
