/* Shared helpers: dates, week rows, tiny DOM builder. */
(function () {
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAY = 86400000;

  function parse(s) {
    if (!s) return null;
    var p = String(s).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function iso(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function short(d) { return MONTHS[d.getMonth()] + " " + d.getDate(); }
  function range(a, b) {
    if (a.getMonth() === b.getMonth()) return MONTHS[a.getMonth()] + " " + a.getDate() + " - " + b.getDate();
    return short(a) + " - " + short(b);
  }
  function today() {
    var m = /[?&]today=(\d{4}-\d{2}-\d{2})/.exec(location.search);
    if (m) return parse(m[1]);
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  // Build the list of rows for a term: week 0, numbered teaching weeks (breaks are unnumbered
  // rows inserted after a given week), finals, after the term.
  function rows(term) {
    var start = parse(term.start);
    var fs = parse(term.finalsStart), fe = parse(term.finalsEnd);
    var out = [];
    out.push({ key: 0, title: "Week 0", sub: range(addDays(start, -7), addDays(start, -1)), start: addDays(start, -7), end: addDays(start, -1) });
    var cal = start;
    for (var w = 1; w <= term.weeks; w++) {
      var s = cal, e = addDays(s, 6);
      if (fs && e >= fs) e = addDays(fs, -1);
      out.push({ key: w, title: "Week " + w, sub: range(s, e), start: s, end: e });
      cal = addDays(cal, 7);
      (term.breaks || []).forEach(function (b, i) {
        if (b.after === w) {
          var bs = cal, be = addDays(bs, 6);
          out.push({ key: "break" + i, title: b.label, sub: range(bs, be), start: bs, end: be, isBreak: true });
          cal = addDays(cal, 7);
        }
      });
    }
    out.push({ key: "finals", title: "Finals", sub: fs && fe ? range(fs, fe) : "", start: fs, end: fe });
    out.push({ key: "after", title: "After the semester", sub: "Wrap-up", start: addDays(fe, 1), end: addDays(fe, 28) });
    return out;
  }

  // Which term should open first? The one we are in, else the next one, else the last.
  function pickTerm(terms, now) {
    var order = ["fall", "spring", "summer"];
    var best = null;
    order.forEach(function (k) {
      var t = terms[k];
      if (!t) return;
      var a = addDays(parse(t.start), -7), b = addDays(parse(t.finalsEnd), 28);
      if (now >= a && now <= b && !best) best = k;
    });
    if (best) return best;
    var next = null;
    order.forEach(function (k) {
      var t = terms[k];
      if (t && parse(t.start) > now && !next) next = k;
    });
    return next || "fall";
  }

  // Tiny DOM builder: h("div", {class:"x"}, child, "text")
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) { c.forEach(function (x) { if (x) el.appendChild(x); }); continue; }
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function safeUrl(u) {
    return /^(https?:|mailto:|tel:)/i.test(u || "") ? u : "#";
  }

  window.Core = {
    DAY: DAY, parse: parse, iso: iso, addDays: addDays, short: short, range: range,
    today: today, rows: rows, pickTerm: pickTerm, h: h, safeUrl: safeUrl, MONTHS: MONTHS
  };
})();
