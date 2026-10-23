/* Dharma Gates — prototype: the part of the page's script that runs in <head>, before the first paint.
   Sets the design version and the switcher states on <html> (so CSS shows the right things with no flash), moves
   pre-round-2 browser storage into the one edits store, and applies the colors and fonts from "my edits".
   Everything else is in site.js, at the end of each page. */
(function () {
  var h = document.documentElement;
  // Site settings: the defaults for anyone who hasn't changed them. Changes are stored in "my edits" and exported;
  // tools/apply_edits.py rewrites this line when Anid applies them.
  var SETTINGS = { impactPage: "off", missionVariant: "text" };
  // Each font role's default family and weight (site.css sets the same in its role tokens), and the families every page
  // already loads with their weights (the Google Fonts <link>s in each page's head). tools/apply_edits.py rewrites
  // these two lines when Anid applies font edits, so the editor's "default" always matches the page.
  var ROLE_DEFAULTS = { heading: ["Fraunces", 500], body: ["Inter", 400], quote: ["Fraunces", 400], number: ["Fraunces", 500], label: ["Inter", 500], button: ["Inter", 600] };
  var BASE_FONTS = { "Fraunces": [400, 500], "Inter": [400, 500, 600] };
  var ROLES = ["heading", "body", "quote", "number", "label", "button"];
  var EDITS_KEY = "dg-edits-v1";

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function readEdits() {
    var e;
    try { e = JSON.parse(get(EDITS_KEY) || "{}"); } catch (x) { e = {}; }
    e = obj(e);
    e.schema = "dg-edits/1";
    ["colors", "photos", "text", "testimonials", "settings"].forEach(function (k) { e[k] = obj(e[k]); });
    e.fonts = obj(e.fonts);
    e.fonts.roles = obj(e.fonts.roles);
    e.fonts.oneOffs = obj(e.fonts.oneOffs);
    return e;
  }
  var edits = readEdits();

  // Move the 10/19–10/23 keys into the edits store once (BRIEF B1): colors per version, Impact page, Mission
  var moved = false;
  ["v1", "v2", "v3", "v4", "v5"].forEach(function (v) {
    var raw = get("dg-colors-" + v);
    if (raw === null) return;
    var old = {};
    try { old = obj(JSON.parse(raw)); } catch (x) {}
    var mine = edits.colors[v] = obj(edits.colors[v]);
    Object.keys(old).forEach(function (t) {
      if (/^--[a-z0-9-]+$/.test(t) && /^#[0-9a-f]{6}$/i.test(old[t]) && !(t in mine)) mine[t] = old[t].toLowerCase();
    });
    if (!Object.keys(mine).length) delete edits.colors[v];
    del("dg-colors-" + v);
    moved = true;
  });
  [["dg-impact-page", "impactPage", ["off", "on"]], ["dg-mission", "missionVariant", ["text", "photo"]]].forEach(function (m) {
    var raw = get(m[0]);
    if (raw === null) return;
    if (m[2].indexOf(raw) > -1 && raw !== SETTINGS[m[1]] && !(m[1] in edits.settings)) edits.settings[m[1]] = raw;
    del(m[0]);
    moved = true;
  });
  if (moved) {
    edits.updated = new Date().toISOString();
    try { localStorage.setItem(EDITS_KEY, JSON.stringify(edits)); } catch (x) {}
  }

  function setting(name, values) {
    var v = edits.settings[name];
    return values.indexOf(v) > -1 ? v : SETTINGS[name];
  }

  // ?design=, ?impact=, ?mission= and ?measure= pick a starting point; site.js remembers them and tidies the address bar
  var q;
  try { q = new URLSearchParams(location.search); } catch (x) { q = { get: function () { return null; } }; }
  var d = q.get("design") || get("dg-design-pick");
  if (!/^v[1-5]$/.test(d || "")) d = "v5";
  h.setAttribute("data-design", d);
  var i = q.get("impact");
  h.setAttribute("data-impact", i === "on" || i === "off" ? i : setting("impactPage", ["off", "on"]));
  var m = q.get("mission");
  h.setAttribute("data-mission", m === "text" || m === "photo" ? m : setting("missionVariant", ["text", "photo"]));
  h.setAttribute("data-notes", get("dg-show-notes") === "off" ? "off" : "on");
  var w = q.get("measure") || get("dg-measure");
  h.setAttribute("data-measure", w === "comfortable" ? "comfortable" : "wide");
  h.classList.add("js");

  // Colors from "Edit colors live", for the version on screen
  var colors = obj(edits.colors[d]);
  Object.keys(colors).forEach(function (t) {
    if (/^--[a-z0-9-]+$/.test(t) && /^#[0-9a-f]{6}$/i.test(colors[t])) h.style.setProperty(t, colors[t]);
  });

  // Fonts from "Edit fonts live": each role is a CSS variable (site.css); a family the pages don't already load gets
  // its own Google Fonts stylesheet, with the weights the catalog lists for it
  function isFamily(f) { return typeof f === "string" && /^[A-Za-z0-9 ]{1,60}$/.test(f); }
  function weightList(x) {
    return (Array.isArray(x) ? x : []).filter(function (n) { return n === (n | 0) && n >= 100 && n <= 900 && n % 50 === 0; })
      .sort(function (a, b) { return a - b; });
  }
  function fontHref(family, weights) {
    return "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(family) + ":wght@" + weights.join(";") + "&display=swap";
  }
  function needsLink(pick) {
    var base = BASE_FONTS[pick.family];
    return !base || base.indexOf(pick.weight) < 0;
  }
  function addFontLink(pick) {
    if (!needsLink(pick)) return null;
    var weights = weightList(pick.weights);
    if (weights.indexOf(pick.weight) < 0) weights = weightList(weights.concat([pick.weight]));
    var id = "gf-" + pick.family.toLowerCase().replace(/ /g, "-");
    var link = document.getElementById(id);
    var href = fontHref(pick.family, weights);
    if (link && link.getAttribute("href") === href) return link;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
    return link;
  }
  function validPick(p) {
    p = obj(p);
    return isFamily(p.family) && weightList([p.weight]).length ? p : null;
  }
  ROLES.forEach(function (r) {
    var p = validPick(edits.fonts.roles[r]);
    if (!p) return;
    var base = r === "body" || r === "label" || r === "button" ? "var(--font-body)" : "var(--font-display)";
    h.style.setProperty("--role-" + r, '"' + p.family + '", ' + base);
    h.style.setProperty("--weight-" + r, String(p.weight));
    addFontLink(p);
  });
  Object.keys(edits.fonts.oneOffs).forEach(function (k) {
    var p = validPick(edits.fonts.oneOffs[k]);
    if (p) addFontLink(p);
  });

  window.dgBoot = { settings: SETTINGS, roles: ROLES, roleDefaults: ROLE_DEFAULTS, edits: edits, fontHref: fontHref, addFontLink: addFontLink, needsLink: needsLink };
})();
