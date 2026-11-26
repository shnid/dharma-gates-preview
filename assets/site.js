/* Dharma Gates — prototype
   Injects the shared header/footer, drives the design and navigation switcher, the hero video, the carousels,
   the pillars, the team bios and the live Retreat Guru rows, and applies "my edits" (text, colors, fonts, photos,
   testimonials and site settings) on every page. The editing tools themselves load from assets/editor.js only when
   someone opens them. No build step, no dependencies. assets/boot.js runs first, in each page's head. */
(function () {
  var page = document.body.getAttribute("data-page") || "";
  var root = document.documentElement;
  var isPreview = !!document.querySelector('meta[name="dg-preview"]');
  var params = new URLSearchParams(location.search);
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var boot = window.dgBoot || {};
  function load(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function forget(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  // ?design=, ?nav=, ?clip=, ?impact=, ?mission=, ?measure= and ?edit= pick a starting point once; drop them from the
  // address bar so a reload keeps whatever the viewer switches to afterwards
  var URL_KEYS = ["design", "nav", "clip", "impact", "mission", "topbar", "measure", "edit"];
  if (new RegExp("[?&](" + URL_KEYS.join("|") + ")=").test(location.search) && history.replaceState) {
    var keep = new URLSearchParams(location.search);
    URL_KEYS.forEach(function (k) { keep.delete(k); });
    var rest = keep.toString();
    try { history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) {}
  }
  root.classList.add("js");

  /* ---------- The logo (round 3, ANI-546; DECISIONS 140) ----------
     DG's placeholder logo, the mark and the "dharma gates" wordmark: an SVG trace, with the PNG it was traced from as
     the fallback. The header shows it on every page; its alt text is the link's name. To swap in DG's final logo,
     point these two at the new files. */
  var LOGO = { svg: "assets/img/brand/logo-placeholder.svg", png: "assets/img/brand/logo-placeholder.png", w: 1037, h: 444 };

  /* ---------- Navigation variants (the thing to show Lyndsey + Aaron) ----------
     [href, label, submenu, flag]. A flag of "impact" shows the item only while "Impact page in menu" is on. */
  var NAV_A = [ // Minimalist: four items + Donate
    ["about.html", "About"],
    ["retreats.html", "Retreats & Events"],
    ["monastic-advising.html", "Monastic Advising"],
    ["impact.html", "Impact", null, "impact"],
    ["connect.html", "Connect"]
  ];
  var NAV_B = [ // Maximalist: same spine, three dropdowns
    ["about.html", "About", [
      ["about.html#team", "Our Team"],
      ["impact.html", "Our Impact", null, "impact"],
      ["about.html#dana", "Dana"],
      ["about.html#ethics-inclusion", "Ethics, Safety & Inclusion"],
      ["about.html#supported-by", "Supported By"]
    ]],
    ["retreats.html", "Retreats & Events", [
      ["retreats.html#upcoming", "Upcoming Retreats"],
      ["retreats.html#join-our-retreat-team", "Join Our Retreat Team"]
    ]],
    ["monastic-advising.html", "Monastic Advising"],
    ["more.html", "Resources", [
      ["index.html#faq", "FAQ"],
      ["connect.html#podcast", "Podcast"],
      ["more.html#blog", "Blog"]
    ]],
    ["connect.html", "Connect"]
  ];

  /* ---------- Design versions: each maps a palette onto the ten color slots in site.css ---------- */
  var DESIGNS = [
    ["v1", "1 · Earth", "Lyndsey's starter palette"],
    ["v2", "2 · Blue", "Blue and white with an ink-like navy"],
    ["v3", "3 · Ink", "Wildcard: black ink with one vermilion accent"],
    ["v4", "4 · Textured", "Earth colors with photo textures on some bands"],
    ["v5", "5 · Textured Blue", "Blue colors with photo textures on some bands"]
  ];
  var DEFAULT_DESIGN = "v5"; // Textured Blue for first-time visitors (DG, 2026-10-21)
  var SLOTS = [ // [token, label] — the slots Lyndsey and the team can change live on a call
    ["--paper", "Page background"],
    ["--paper-2", "Alternate blocks"],
    ["--ink", "Main text, dark blocks"],
    ["--accent-ink", "Section labels"],
    ["--muted", "Secondary text"],
    ["--accent", "Buttons"],
    ["--sage", "Links and tags"],
    ["--sage-soft", "Links and tags: light shade"],
    ["--line", "Lines"],
    ["--on-dark-label", "Labels on dark blocks"],
    ["--footer-bg", "Footer"]
  ];
  var CLIPS = [["trail", "Trail"], ["shrine", "Shrine"], ["bowing", "Bowing"], ["still", "Still"]];
  var PAGE_NAMES = {
    "index.html": "Home", "retreats.html": "Retreats & Events", "monastic-advising.html": "Monastic Advising",
    "about.html": "About", "impact.html": "Impact", "donate.html": "Donate", "connect.html": "Connect", "more.html": "Everything Else"
  };
  var SETTINGS = boot.settings || { impactPage: "off", missionVariant: "text", topBar: "white", pillarOrder: "practice-sangha-dana" }; // defaults live in boot.js
  var ROLES = boot.roles || ["heading", "banner", "body", "quote", "number", "label", "button"];
  var SIZE_KEYS = ["site"].concat(ROLES); // text sizes: the whole site, then one per font role (ANI-602)
  var SIZE_DEFAULTS = boot.sizeDefaults || {};
  var ART_SLOTS = ["site.logo", "home.pillars.art"]; // upload slots for the logo and the pillar wheel (applyArt below)

  /* ---------- My edits (BRIEF B1): everything Lyndsey changes lives in one key, dg-edits-v1, and is exported as one
     file. Viewing preferences (design, nav, clip, switcher, DG notes, text width) stay in their own keys and are never
     exported. Every key starts with dg-: shnid.github.io is shared by all of shnid's Pages projects. ---------- */
  var EDITS_KEY = "dg-edits-v1", EXPORTED_KEY = "dg-edits-exported";
  function readEdits() {
    var e;
    try { e = obj(JSON.parse(load(EDITS_KEY, "{}"))); } catch (x) { e = {}; }
    e.schema = "dg-edits/2";
    ["colors", "photos", "text", "testimonials", "settings", "art"].forEach(function (k) { e[k] = obj(e[k]); });
    e.fonts = obj(e.fonts);
    e.fonts.roles = obj(e.fonts.roles);
    e.fonts.oneOffs = obj(e.fonts.oneOffs);
    e.fonts.sizes = obj(e.fonts.sizes);
    return e;
  }
  var editListeners = [];
  function writeEdits(e) {
    e.updated = new Date().toISOString();
    save(EDITS_KEY, JSON.stringify(e));
    if (navigator.storage && navigator.storage.persist && !writeEdits.asked) {
      writeEdits.asked = true;
      try { navigator.storage.persist(); } catch (x) {}
    }
    editListeners.forEach(function (fn) { try { fn(e); } catch (x) {} });
  }
  // What "my edits" holds, one entry per item: each text, color, font role, one-off, photo slot, testimonial change
  // and setting. The unsaved count compares this with the last file saved or copied.
  function flatten(e) {
    var out = {};
    var put = function (k, v) { out[k] = JSON.stringify(v); };
    Object.keys(obj(e.text)).forEach(function (k) { put("text." + k, obj(e.text[k]).value); });
    Object.keys(obj(e.colors)).forEach(function (v) { Object.keys(obj(e.colors[v])).forEach(function (t) { put("colors." + v + t, e.colors[v][t]); }); });
    var f = obj(e.fonts);
    Object.keys(obj(f.roles)).forEach(function (r) { put("fonts.role." + r, [f.roles[r].family, f.roles[r].weight]); });
    Object.keys(obj(f.oneOffs)).forEach(function (k) { put("fonts.one." + k, [f.oneOffs[k].family, f.oneOffs[k].weight]); });
    Object.keys(obj(f.sizes)).forEach(function (k) { put("fonts.size." + k, f.sizes[k]); });
    Object.keys(obj(e.photos)).forEach(function (k) { put("photos." + k, e.photos[k]); });
    Object.keys(obj(e.art)).forEach(function (k) { put("art." + k, e.art[k]); });
    var used = {}; // descriptions of uploaded photos that a spot uses (the file carries them with the picture)
    Object.keys(obj(e.photos)).forEach(function (k) { var u = obj(e.photos[k]).upload; if (u) used[u] = 1; });
    Object.keys(obj(e.alts)).forEach(function (k) { if (used[k]) put("alt." + k, e.alts[k]); });
    var t = obj(e.testimonials);
    Object.keys(obj(t.edit)).forEach(function (k) { put("t.edit." + k, t.edit[k]); });
    arr(t.add).forEach(function (a) { put("t.add." + obj(a).id, a); });
    arr(t.hide).forEach(function (k) { put("t.hide." + k, 1); });
    arr(t.show).forEach(function (k) { put("t.show." + k, 1); });
    arr(t.remove).forEach(function (k) { put("t.remove." + k, 1); });
    Object.keys(obj(t.order)).forEach(function (k) { put("t.order." + k, t.order[k]); });
    if (t.secondsPerQuote !== undefined) put("t.seconds", t.secondsPerQuote);
    Object.keys(obj(e.settings)).forEach(function (k) { put("settings." + k, e.settings[k]); });
    return out;
  }
  function unsavedCount() {
    var now = flatten(readEdits()), then = {};
    try { then = obj(JSON.parse(load(EXPORTED_KEY, "{}"))); } catch (x) {}
    var n = 0;
    Object.keys(now).forEach(function (k) { if (then[k] !== now[k]) n++; });
    Object.keys(then).forEach(function (k) { if (!(k in now)) n++; });
    return n;
  }
  // keep(key, value), if given, picks entries that keep their last saved state (a copy leaves the pictures out)
  function markExported(keep) {
    var now = flatten(readEdits());
    if (keep) {
      var then = {};
      try { then = obj(JSON.parse(load(EXPORTED_KEY, "{}"))); } catch (x) {}
      Object.keys(now).forEach(function (k) { if (keep(k, now[k])) { if (k in then) now[k] = then[k]; else delete now[k]; } });
    }
    save(EXPORTED_KEY, JSON.stringify(now));
    editListeners.forEach(function (fn) { fn(readEdits()); });
  }
  function totalEdits() { return Object.keys(flatten(readEdits())).length; }

  /* ---------- Text (BRIEF B2): a data-edit element's text is what visitors read: DG notes left out, <br> as a line
     break, the page source's line breaks and runs of spaces collapsed. tools/apply_edits.py reads it the same way. */
  function normalize(s) {
    return String(s).replace(/\r\n?/g, "\n").replace(/[ \t\f]+/g, " ").split("\n")
      .map(function (l) { return l.trim(); }).join("\n").trim();
  }
  function textOf(el, typed) {
    var out = "";
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out += typed ? c.nodeValue : c.nodeValue.replace(/[ \t\n\r\f]+/g, " ");
        else if (c.nodeType === 1) {
          if (c.tagName === "BR") out += "\n";
          else if (!c.classList.contains("dg-note")) {
            if (typed && c.tagName === "DIV" && out && out.slice(-1) !== "\n") out += "\n"; // a typed line some browsers wrap in a <div>
            walk(c);
          }
        }
      }
    })(el);
    return normalize(out);
  }
  function setText(el, value) {
    var notes = [].filter.call(el.children, function (c) { return c.classList.contains("dg-note"); });
    var first = [].filter.call(el.childNodes, function (c) { return c.nodeType === 1 || /\S/.test(c.nodeValue || ""); })[0];
    var notesFirst = notes.length && first === notes[0];
    while (el.firstChild) el.removeChild(el.firstChild);
    var frag = document.createDocumentFragment();
    String(value).split("\n").forEach(function (line, i) {
      if (i) frag.appendChild(document.createElement("br"));
      frag.appendChild(document.createTextNode(line));
    });
    if (notesFirst) notes.forEach(function (n) { el.appendChild(n); el.appendChild(document.createTextNode(" ")); });
    el.appendChild(frag);
    if (!notesFirst) notes.forEach(function (n) { el.appendChild(document.createTextNode(" ")); el.appendChild(n); });
  }
  // "was": a short fingerprint of the page's own text, saved with each edit, so apply_edits.py can tell when the
  // default changed after the edit (FNV-1a, 32 bits, over UTF-16 code units)
  function shortHash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  function keyed(k) { return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(k) ? document.querySelector('[data-edit="' + k + '"]') : null; }
  var textDefaults = {};
  document.querySelectorAll("[data-edit]").forEach(function (el) { textDefaults[el.getAttribute("data-edit")] = textOf(el); });
  function applyTextEdits() {
    var t = readEdits().text;
    Object.keys(t).forEach(function (k) {
      var el = keyed(k), v = obj(t[k]);
      if (el && typeof v.value === "string") setText(el, v.value);
    });
  }
  applyTextEdits();

  function flagAttr(item) { return item[3] === "impact" ? " data-impact-only" : ""; }
  function li(item) {
    var cur = item[0].split("#")[0] === page ? ' aria-current="page"' : "";
    var html = "<li" + (item[2] ? ' class="has-menu"' : "") + flagAttr(item) + '><a href="' + item[0] + '"' + cur + ">" + item[1] + "</a>";
    if (item[2]) {
      html += "<ul>" + item[2].map(function (s) { return "<li" + flagAttr(s) + '><a href="' + s[0] + '">' + s[1] + "</a></li>"; }).join("") + "</ul>";
    }
    return html + "</li>";
  }
  function navList(items, cls) {
    return '<ul class="' + cls + '">' + items.map(li).join("") +
      '<li class="nav-donate"><a class="btn small" href="donate.html">Donate</a></li></ul>';
  }
  function buttons(list, attr) {
    return list.map(function (d) { return '<button type="button" ' + attr + '="' + d[0] + '"' + (d[2] ? ' title="' + d[2] + '"' : "") + ">" + d[1] + "</button>"; }).join("");
  }
  function row(label, inner) {
    return '<div class="sw-row" role="group" aria-label="' + label + '"><span class="sw-label">' + label + '</span><div class="sw-opts">' + inner + "</div></div>";
  }
  function group(id, label, inner) {
    return '<div class="sw-group" role="group" aria-labelledby="sw-h-' + id + '"><div class="sw-head" id="sw-h-' + id + '">' + label + "</div>" + inner + "</div>";
  }

  // The preview banner (with its feedback link) is on every page by design; the prototype's own banner stays
  // hidden for the rest of the visit once hidden.
  var bannerHidden = false;
  try { bannerHidden = !isPreview && sessionStorage.getItem("dg-bar") === "hidden"; } catch (e) {}
  var banner = bannerHidden ? "" : isPreview
    ? '<div class="proto-bar preview-bar" id="proto-bar"><span><b>Preview: not the live site.</b><span class="wide-only"> Compare the five designs with the switcher at the bottom right.</span></span>' +
      '<a id="feedback-link" href="mailto:anid.laoui@gmail.com"><span class="fb-long">Send feedback on this page</span><span class="fb-short" aria-hidden="true">Feedback</span></a>' +
      '<button type="button" data-hide-bar>hide</button></div>'
    : '<div class="proto-bar" id="proto-bar"><span><b>Skeleton prototype</b> — structure & real copy from the current site; colors, photos and video are a draft. Use the switcher (bottom-right) to compare design versions and navigation A vs B.</span>' +
      '<button type="button" data-hide-bar>hide</button></div>';

  var header = '<a class="skip-link" href="#main">Skip to Content</a>' + banner +
    '<header class="site"><div class="wrap nav-row">' +
    '<a class="brand" href="index.html"><picture class="logo">' + (LOGO.svg ? '<source srcset="' + LOGO.svg + '" type="image/svg+xml">' : "") +
    '<img src="' + LOGO.png + '" width="' + LOGO.w + '" height="' + LOGO.h + '" alt="Dharma Gates"></picture></a>' +
    '<div class="header-tools"><a class="btn small header-donate" href="donate.html">Donate</a>' +
    '<button type="button" class="menu-toggle" aria-label="Menu" aria-expanded="false" aria-controls="primary-nav">☰</button></div>' +
    '<nav class="primary" id="primary-nav" aria-label="Main">' + navList(NAV_A, "nav-a") + navList(NAV_B, "nav-b") + "</nav>" +
    "</div></header>";

  // The switcher (BRIEF §4): View is viewing preferences, never exported; Site settings and Edit are "my edits"
  var hasHeroVideo = !!document.querySelector(".hero-video");
  var hasMission = !!document.getElementById("mission");
  // The pillar wheel's order (ANI-546): which pillar sits at 12, 4 and 8 o'clock, clockwise from the top
  var PILLAR_IDS = ["practice", "sangha", "dana"];
  var PILLAR_ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(function (o) {
    return o.map(function (k) { return PILLAR_IDS[k]; }).join("-");
  });
  var hasPillars = !!document.querySelector("[data-pillars] .pillar-wheel");
  var pillarName = function (id) { var t = document.getElementById("pillar-tab-" + id); return t ? t.textContent.trim() : id; };
  var switcher =
    '<div class="switcher" id="switcher"><button type="button" class="sw-toggle" aria-expanded="false" aria-controls="sw-panel">Compare designs ▴</button>' +
    '<div class="sw-panel" id="sw-panel">' +
    group("view", "View",
      row("Design", buttons(DESIGNS, "data-design")) +
      row("Nav", '<button type="button" data-v="a">A · Minimal</button><button type="button" data-v="b">B · Fuller</button>') +
      (hasHeroVideo ? row("Video", buttons(CLIPS, "data-clip")) : "") +
      row("Show DG notes", buttons([["on", "On"], ["off", "Off"]], "data-notes")) +
      row("Text width", buttons([["wide", "Wide", "68ch, about 87 characters a line"], ["comfortable", "Comfortable", "58ch, about 74 characters a line"]], "data-measure"))) +
    group("site", "Site settings",
      row("Top bar", buttons([["white", "White"], ["clear", "See-through", "The pre-round-3 look: over the photo on Home, tinted elsewhere"]], "data-topbar")) +
      (hasMission ? row("Mission", buttons([["text", "Text"], ["photo", "Photo"]], "data-mission")) : "") +
      (hasPillars ? row("Pillar wheel", '<select data-pillar-order aria-label="Pillar wheel, clockwise from the top">' + PILLAR_ORDERS.map(function (v) {
        return '<option value="' + v + '">' + v.split("-").map(pillarName).join(", ") + "</option>";
      }).join("") + "</select>") : "") +
      row("Impact page in menu", buttons([["off", "Off"], ["on", "On"]], "data-impact"))) +
    group("edit", "Edit",
      row("Edit this page", buttons([["off", "Off"], ["on", "On"]], "data-editing")) +
      '<details class="sw-colors-panel"><summary>Edit colors live</summary><div class="sw-colors">' +
      SLOTS.map(function (s) { return '<label for="c' + s[0] + '">' + s[1] + '</label><input type="color" id="c' + s[0] + '" data-token="' + s[0] + '">'; }).join("") +
      '</div><div class="sw-actions"><button type="button" data-colors="copy">Copy hex codes</button><button type="button" data-colors="reset">Reset</button></div></details>' +
      '<details class="sw-fonts-panel"><summary>Edit fonts live</summary><div class="sw-fonts"><p class="sw-hint">Loading the font list…</p></div></details>' +
      row("Site art", '<button type="button" data-art="site.logo" aria-haspopup="dialog">Logo</button>' + (hasPillars ? '<button type="button" data-art="home.pillars.art" aria-haspopup="dialog">Pillars art</button>' : '') + '') +
      row("My edits", '<div class="sw-edits"><button type="button" data-my="save">Save my edits</button><button type="button" data-my="copy">Copy my edits</button>' +
        '<button type="button" data-my="load">Load edits</button><button type="button" data-my="reset" aria-haspopup="true">Reset…</button></div>') +
      '<p class="sw-hint" data-unsaved></p>') +
    '<div class="sw-msg" aria-live="polite"></div>' +
    "</div></div>";

  var footer =
    '<footer class="site"><div class="wrap">' +
    '<div class="footer-top">' +
    '<div id="footer-signup"><h2>Stay in Touch</h2><p>Dharma Gates · Opening pathways into deep meditation practice for young adults (18–35).</p>' +
    "<p>The newsletter goes out monthly.</p>" +
    '<form class="signup" data-stub="newsletter"><label for="footer-email">Email</label><div class="row"><input id="footer-email" name="email" type="email" autocomplete="email" required>' +
    '<button class="btn" type="submit">Subscribe</button></div><div class="form-status" role="status"></div></form>' +
    '<p class="dg-note">This is the site\'s only signup form. In WordPress it posts to Mailchimp. DG to add one line on how it uses subscriber emails, and a privacy-policy link if it has one.</p></div>' +
    '<div><h2>Support Young People in Practice</h2><p>Every retreat has already been paid for by past participants and donors. Your gift pays for the next person\'s seat.</p>' +
    '<a class="btn" href="donate.html">Donate</a></div>' +
    "</div>" +
    '<div class="footer-cols">' +
    '<div><h2>Explore</h2><ul><li><a href="about.html">About</a></li><li><a href="retreats.html">Retreats &amp; Events</a></li><li><a href="monastic-advising.html">Monastic Advising</a></li>' +
    '<li data-impact-only><a href="impact.html">Impact</a></li><li><a href="index.html#faq">FAQ</a></li><li><a href="more.html">Everything Else</a></li></ul></div>' +
    '<div><h2>Connect</h2><ul><li><a href="https://substack.com/@dharmagates" rel="noopener">Substack</a></li><li><a href="connect.html#podcast">Podcast</a></li>' +
    '<li><a href="https://www.instagram.com/dharma.gates/" rel="noopener">Instagram</a></li><li><a href="https://www.facebook.com/Dharma-Gates-113102010040319/" rel="noopener">Facebook</a></li>' +
    '<li><a href="https://www.youtube.com/channel/UC3pp_BDfrUPFB3jfsSUmE_A" rel="noopener">YouTube</a></li></ul></div>' +
    '<div><h2>Contact</h2><ul><li>Programs: <a href="mailto:offerings@dharma-gates.org">offerings@dharma-gates.org</a></li><li>Everything else: <a href="mailto:team@dharma-gates.org">team@dharma-gates.org</a></li><li>242 Main Street #363<br>Beacon, NY 12508</li></ul></div>' +
    "</div>" +
    '<div class="fine"><p>Dharma Gates, Inc. · EIN 84-4831330 · A registered 501(c)(3) nonprofit. Donations are tax-deductible to the extent allowed by law. · <a href="about.html#ethics-inclusion">Ethics &amp; Safety</a> · <a href="about.html#ethics-inclusion">Inclusion</a></p></div>' +
    "</div></footer>" +
    switcher;

  document.body.insertAdjacentHTML("afterbegin", header);
  document.body.insertAdjacentHTML("beforeend", footer);

  /* ---------- Sizes other rules depend on: the preview bar (the home hero fills the screen below it) and the
     switcher (the footer keeps its last lines clear of it, in the footer's own color) ---------- */
  var bar = document.getElementById("proto-bar");
  var sw = document.getElementById("switcher");
  var msg = sw.querySelector(".sw-msg");
  function say(text, warn) { msg.textContent = text; msg.classList.toggle("warn", !!warn); }
  function setBarH() { root.style.setProperty("--bar-h", (bar && bar.isConnected ? bar.offsetHeight : 0) + "px"); }
  function setSwClear() {
    var bottom = parseFloat(getComputedStyle(sw).bottom) || 0;
    root.style.setProperty("--sw-clear", Math.ceil(sw.offsetHeight + bottom + 8) + "px");
  }
  setBarH(); setSwClear();
  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(function () { setBarH(); setSwClear(); });
    if (bar) ro.observe(bar);
    ro.observe(sw);
  } else {
    window.addEventListener("resize", function () { setBarH(); setSwClear(); });
  }
  document.querySelectorAll("[data-hide-bar]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!isPreview) { try { sessionStorage.setItem("dg-bar", "hidden"); } catch (e) {} }
      bar.remove();
      setBarH();
    });
  });

  /* ---------- Header: phone menu, Nav B menus, and the home header's transparent start ---------- */
  var siteHeader = document.querySelector("header.site");
  var nav = document.getElementById("primary-nav");
  var menuBtn = siteHeader.querySelector(".menu-toggle");
  var isHome = page === "index.html";
  function setSolid() {
    if (isHome) siteHeader.classList.toggle("is-solid", window.scrollY > 40 || nav.classList.contains("open"));
  }
  function setMenu(open) {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    setSolid();
  }
  menuBtn.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    // the phone menu closes from anywhere, including its own button; a Nav B dropdown closes from inside it
    if (nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); return; }
    var menu = e.target.closest && e.target.closest("#primary-nav li.has-menu");
    if (menu) { menu.classList.add("is-closed"); menu.querySelector("a").focus(); }
  });
  nav.querySelectorAll("li.has-menu").forEach(function (m) {
    var reopen = function () { m.classList.remove("is-closed"); };
    m.addEventListener("mouseleave", reopen);
    m.addEventListener("focusout", function (e) { if (!m.contains(e.relatedTarget)) reopen(); });
    m.addEventListener("mouseenter", reopen);
  });
  if (isHome) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; setSolid(); });
    }, { passive: true });
    setSolid();
  }

  var swToggle = sw.querySelector(".sw-toggle");
  function setOpen(open) {
    sw.classList.toggle("open", open);
    document.body.classList.toggle("sw-open", open);
    swToggle.setAttribute("aria-expanded", open);
    swToggle.textContent = swToggle.textContent.replace(/[▴▾]$/, open ? "▾" : "▴");
    setSwClear();
  }
  swToggle.addEventListener("click", function () {
    setOpen(!sw.classList.contains("open"));
    save("dg-switcher", sw.classList.contains("open") ? "open" : "folded");
  });

  /* ---------- Design versions (remembered per browser; ?design=v2 in a link picks one) ----------
     Only a version the viewer picks (or a link names) is remembered, so the default can change later. Picks live
     under "dg-design-pick": the 10/19 preview saved "dg-design" on every visit, chosen or not, so that key can't
     tell a choice from the old default and is dropped. */
  function isDesign(d) { return DESIGNS.some(function (x) { return x[0] === d; }); }
  forget("dg-design");
  var design = params.get("design");
  var designFromLink = isDesign(design);
  if (!isDesign(design)) design = load("dg-design-pick", DEFAULT_DESIGN);
  if (!isDesign(design)) design = DEFAULT_DESIGN;
  var inputs = sw.querySelectorAll("input[data-token]");
  function setDesign(d, remember) {
    design = d;
    root.setAttribute("data-design", d);
    sw.querySelectorAll("[data-design]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-design") === d); });
    var name = DESIGNS.filter(function (x) { return x[0] === d; })[0][1];
    // the folded button stays short ("Design 5") so it covers as little as possible; its tooltip has the full name
    swToggle.textContent = "Design " + d.slice(1) + (sw.classList.contains("open") ? " ▾" : " ▴");
    swToggle.title = "Design: " + name.replace(/^\d · /, "");
    if (remember) save("dg-design-pick", d);
    say("");
    applyColorEdits();
    updateFeedbackLink();
  }
  sw.querySelectorAll("[data-design]").forEach(function (b) {
    b.addEventListener("click", function () { setDesign(b.getAttribute("data-design"), true); });
  });

  /* ---------- A/B navigation (remembered per browser; ?nav=b in a link picks one) ---------- */
  var variant = params.get("nav");
  if (variant !== "a" && variant !== "b") variant = load("dg-nav", "a");
  if (variant !== "a" && variant !== "b") variant = "a";
  function setVariant(v) {
    variant = v;
    document.body.setAttribute("data-nav", v);
    sw.querySelectorAll("[data-v]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); });
    save("dg-nav", v);
  }
  sw.querySelectorAll("[data-v]").forEach(function (b) {
    b.addEventListener("click", function () { setVariant(b.getAttribute("data-v")); });
  });

  /* ---------- Two-way switches, kept on <html> so CSS shows or hides things. boot.js sets them before the first
     paint (no flash); these keep them in sync and remember the choice: viewing preferences in their own keys, site
     settings in "my edits" (only when they differ from the default, so an untouched setting isn't an edit). ------ */
  function getSetting(name, values) {
    var v = readEdits().settings[name];
    return values.indexOf(v) > -1 ? v : SETTINGS[name];
  }
  function setSetting(name, v) {
    var e = readEdits();
    if (e.settings[name] === v || (v === SETTINGS[name] && !(name in e.settings))) return;
    if (v === SETTINGS[name]) delete e.settings[name]; else e.settings[name] = v;
    writeEdits(e);
  }
  var switches = {};
  function toggle(attr, values, fallback, fromUrl, store, after) {
    var v = fromUrl && values.indexOf(params.get(fromUrl)) > -1 ? params.get(fromUrl) : store.get();
    if (values.indexOf(v) < 0) v = fallback;
    var set = function (val, quiet) {
      root.setAttribute("data-" + attr, val);
      sw.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-" + attr) === val); });
      if (!quiet) store.set(val);
      if (after) after(val);
    };
    sw.querySelectorAll("[data-" + attr + "]").forEach(function (b) {
      b.addEventListener("click", function () { set(b.getAttribute("data-" + attr)); });
    });
    set(v, v === store.get());
    switches[attr] = function () { set(store.get(), true); };
  }
  function pref(key, fallback) { return { get: function () { return load(key, fallback); }, set: function (v) { save(key, v); } }; }
  function siteSetting(name, values) { return { get: function () { return getSetting(name, values); }, set: function (v) { setSetting(name, v); } }; }
  // Impact page in menu (A6): off by default. Who We Serve's Impact link follows it.
  toggle("impact", ["off", "on"], SETTINGS.impactPage, "impact", siteSetting("impactPage", ["off", "on"]), function (v) {
    document.querySelectorAll("[data-impact-link]").forEach(function (a) { a.setAttribute("href", v === "on" ? "impact.html" : "index.html#impact"); });
  });
  // Top bar (ANI-546): solid white by default; the pre-round-3 see-through look one switch away
  toggle("topbar", ["white", "clear"], SETTINGS.topBar, "topbar", siteSetting("topBar", ["white", "clear"]));
  // Show DG notes (R6): a viewing preference, on by default
  toggle("notes", ["on", "off"], "on", null, pref("dg-show-notes", "on"));
  // Text width (R1): Wide is 68ch, Comfortable 58ch. A viewing preference, so it's never exported.
  toggle("measure", ["wide", "comfortable"], "wide", "measure", pref("dg-measure", "wide"));
  // Mission (R11): the text-only statement by default, the photo version one switch away
  if (hasMission) toggle("mission", ["text", "photo"], SETTINGS.missionVariant, "mission", siteSetting("missionVariant", ["text", "photo"]), function (v) {
    document.getElementById("mission").setAttribute("data-variant", v);
  });

  /* ---------- Live color editing: change any slot on a call, then copy the codes. Per design, in "my edits";
     a color set back to the version's own value is dropped. ---------- */
  var colorDefaults = {};
  function applyColorEdits() {
    SLOTS.forEach(function (s) { root.style.removeProperty(s[0]); });
    var cs = getComputedStyle(root), defs = colorDefaults[design] = {};
    SLOTS.forEach(function (s) { defs[s[0]] = cs.getPropertyValue(s[0]).trim().toLowerCase(); });
    var mine = obj(readEdits().colors[design]);
    Object.keys(mine).forEach(function (t) { if (/^#[0-9a-f]{6}$/i.test(mine[t]) && t in defs) root.style.setProperty(t, mine[t]); });
    cs = getComputedStyle(root);
    inputs.forEach(function (inp) {
      var v = cs.getPropertyValue(inp.getAttribute("data-token")).trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) inp.value = v;
    });
  }
  inputs.forEach(function (inp) {
    inp.addEventListener("input", function () {
      var t = inp.getAttribute("data-token"), v = inp.value.toLowerCase();
      var e = readEdits(), mine = e.colors[design] = obj(e.colors[design]);
      if (v === colorDefaults[design][t]) delete mine[t]; else mine[t] = v;
      if (!Object.keys(mine).length) delete e.colors[design];
      root.style.setProperty(t, v);
      writeEdits(e);
    });
  });
  sw.querySelector('[data-colors="reset"]').addEventListener("click", function () {
    var e = readEdits();
    delete e.colors[design];
    writeEdits(e);
    applyColorEdits();
    say("Back to this version's colors.");
  });
  sw.querySelector('[data-colors="copy"]').addEventListener("click", function () {
    var cs = getComputedStyle(root);
    var name = DESIGNS.filter(function (x) { return x[0] === design; })[0][1];
    var text = "Design " + name + "\n" + SLOTS.map(function (s) { return s[1] + ": " + cs.getPropertyValue(s[0]).trim(); }).join("\n");
    copyText(text, "Copied.", "Copy these codes:");
  });
  function copyText(text, done, ask) {
    var ok = function () { say(done); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { window.prompt(ask, text); });
    else window.prompt(ask, text);
  }

  /* ---------- Fonts from "Edit fonts live": boot.js sets the role variables before the first paint; one-offs are
     set here, on the element itself ---------- */
  function fontStack(family, role) {
    return '"' + family + '", ' + (role === "body" || role === "label" || role === "button" ? "var(--font-body)" : "var(--font-display)");
  }
  function applyFonts() {
    var f = readEdits().fonts;
    ROLES.forEach(function (r) {
      var p = obj(f.roles[r]);
      if (p.family) {
        root.style.setProperty("--role-" + r, fontStack(p.family, r));
        root.style.setProperty("--weight-" + r, String(p.weight));
        if (boot.addFontLink) boot.addFontLink(p);
      } else {
        root.style.removeProperty("--role-" + r);
        root.style.removeProperty("--weight-" + r);
      }
    });
    document.querySelectorAll("[data-font-one-off]").forEach(function (el) {
      if (!f.oneOffs[el.getAttribute("data-edit")]) {
        el.style.removeProperty("font-family"); el.style.removeProperty("font-weight"); el.removeAttribute("data-font-one-off");
      }
    });
    Object.keys(f.oneOffs).forEach(function (k) {
      var el = keyed(k), p = obj(f.oneOffs[k]);
      if (!el || !p.family) return;
      el.style.fontFamily = fontStack(p.family, "body");
      el.style.fontWeight = String(p.weight);
      el.setAttribute("data-font-one-off", "");
      if (boot.addFontLink) boot.addFontLink(p);
    });
  }
  applyFonts();

  /* ---------- Text sizes from "Edit fonts live" (ANI-602): one multiplier for the whole site and one per role, 80–140%,
     as --size-* variables on <html>. site.css multiplies every type step by them and keeps the result in bounds, with
     half the change on phones, so text stays readable at 390px. boot.js sets them before the first paint. ---------- */
  function validSize(v) { return typeof v === "number" && v === Math.round(v) && v >= 80 && v <= 140; }
  function applySizes() {
    var sz = readEdits().fonts.sizes;
    SIZE_KEYS.forEach(function (k) {
      if (validSize(sz[k])) root.style.setProperty("--size-" + k, String(sz[k] / 100));
      else root.style.removeProperty("--size-" + k);
    });
  }
  applySizes();

  /* ---------- Preview feedback link: the subject names the page and the design on screen ---------- */
  function updateFeedbackLink() {
    var a = document.getElementById("feedback-link");
    if (!a) return;
    var name = DESIGNS.filter(function (x) { return x[0] === design; })[0][1];
    var subject = "Website preview feedback: " + (PAGE_NAMES[page] || document.title) + " (design " + name + ")";
    a.href = "mailto:anid.laoui@gmail.com?subject=" + encodeURIComponent(subject);
  }

  setVariant(variant);
  setDesign(design, designFromLink);
  // folded into one small button until the viewer opens it, so it never sits on the page itself; after that, as the
  // viewer last left it
  setOpen(load("dg-switcher", "") === "open");

  /* ---------- Forms are stubs until WordPress: nothing is sent ---------- */
  document.querySelectorAll("form[data-stub]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = f.querySelector(".form-status");
      if (!status) return;
      var ok = f.getAttribute("data-success");
      status.innerHTML = "";
      if (ok) {
        var p = document.createElement("p");
        p.className = "ok";
        p.textContent = ok;
        status.appendChild(p);
      }
      var n = document.createElement("p");
      n.className = "dg-note";
      n.textContent = "Prototype: nothing is sent.";
      status.appendChild(n);
    });
  });

  /* ---------- Hero video: a muted ~5s loop over a still photo ----------
     Loads only after the page has finished loading, never under reduced motion or Save-Data,
     uses a small portrait cut on phones, and pauses when scrolled away. */
  var hero = document.querySelector(".hero.bleed");
  var hv = document.querySelector(".hero-video");
  if (hero && hv) {
    var saveData = navigator.connection && navigator.connection.saveData;
    var vToggle = hero.querySelector(".video-toggle");
    var isClip = function (c) { return CLIPS.some(function (x) { return x[0] === c; }); };
    var clip = params.get("clip");
    if (!isClip(clip)) clip = load("dg-clip", "trail");
    if (!isClip(clip)) clip = "trail";
    var userPaused = false, inView = true, started = false;
    hv.addEventListener("playing", function () { hv.classList.add("playing"); });
    var playIfWanted = function () {
      if (!hv.getAttribute("src") || userPaused || !inView) return;
      var p = hv.play();
      if (p && p.catch) p.catch(function (e) {
        // autoplay refused (e.g. Low Power Mode): the still photo stays and the button offers to play
        if (e && e.name === "NotAllowedError") { userPaused = true; if (vToggle) vToggle.textContent = "Play Video"; }
      });
    };
    if (reduceMotion || saveData) {
      var vrow = sw.querySelector('[aria-label="Video"] .sw-opts');
      if (vrow) vrow.insertAdjacentHTML("afterend", '<small class="sw-note">Off: this device asks for ' + (reduceMotion ? "reduced motion" : "less data") + ".</small>");
    }
    var setClip = function (c) {
      clip = c;
      save("dg-clip", c);
      sw.querySelectorAll("[data-clip]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-clip") === c); });
      if (!started) return;
      hv.pause();
      hv.classList.remove("playing");
      if (c === "still" || reduceMotion || saveData) {
        hv.removeAttribute("src"); hv.load();
        hero.classList.remove("has-video");
        return;
      }
      var small = window.matchMedia("(max-width: 700px)").matches;
      var webm = hv.canPlayType('video/webm; codecs="vp9"') ? ".webm" : ".mp4"; // VP9 is smaller; H.264 MP4 for the rest
      hv.src = "assets/video/" + c + (small ? "-mobile" : "-720p") + webm;
      hero.classList.add("has-video");
      playIfWanted();
    };
    sw.querySelectorAll("[data-clip]").forEach(function (b) {
      b.addEventListener("click", function () { userPaused = false; if (vToggle) vToggle.textContent = "Pause Video"; setClip(b.getAttribute("data-clip")); });
    });
    if (vToggle) vToggle.addEventListener("click", function () {
      userPaused = !userPaused;
      vToggle.textContent = userPaused ? "Play Video" : "Pause Video";
      if (userPaused) hv.pause(); else playIfWanted();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) playIfWanted(); else hv.pause();
      }).observe(hero);
    }
    var start = function () { started = true; setClip(clip); };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start);
    setClip(clip);
  }

  /* ---------- YouTube slot for the full video ----------
     data-youtube-id on .video-slot names the video. Nothing loads from YouTube until the viewer presses play;
     then the youtube-nocookie.com player replaces the poster. */
  document.querySelectorAll(".video-slot").forEach(function (slot) {
    var id = slot.getAttribute("data-youtube-id");
    var play = slot.querySelector("button.play");
    if (!play) return;
    if (!id) { play.disabled = true; return; }
    slot.classList.add("ready");
    play.addEventListener("click", function () {
      if (root.classList.contains("dg-editing")) return; // in edit mode the poster is a photo slot, not a player
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&playsinline=1";
      f.setAttribute("title", slot.getAttribute("data-title") || "Video");
      f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
      f.setAttribute("allowfullscreen", "");
      slot.innerHTML = "";
      slot.appendChild(f);
      f.focus(); // keyboard focus moves to the player instead of falling back to the top of the page
    });
  });

  /* ---------- Data files (photo library, testimonial bank), each fetched at most once. Opened from disk (file://)
     they can't load, and the page keeps what's in the HTML. ---------- */
  var jsonCache = {};
  function loadJSON(path) {
    if (!jsonCache[path]) jsonCache[path] = fetch(path).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    return jsonCache[path];
  }
  var PHOTOS_JSON = "assets/data/photos.json", BANK_JSON = "assets/data/testimonials.json";

  /* ---------- Uploaded photos and art (ANI-602). The pictures themselves live in this browser's IndexedDB
     ("dg-uploads": localStorage is far too small for them); "my edits" only names them ({ upload: "up-…" }). The store
     is opened only when an edit names an upload, so visitors never touch it. Each picture shows through an object URL
     made from its stored copy, never from anything typed or loaded as text. ---------- */
  var UP_DB = "dg-uploads", UP_STORE = "uploads", UP_ID = /^up-[a-z0-9]{6,40}$/;
  var upDB = null, upURLs = {};
  function upOpen() {
    if (!upDB) {
      upDB = new Promise(function (resolve, reject) {
        if (!window.indexedDB) { reject(new Error("unavailable")); return; }
        var req;
        try { req = indexedDB.open(UP_DB, 1); } catch (x) { reject(x); return; }
        req.onupgradeneeded = function () { req.result.createObjectStore(UP_STORE, { keyPath: "id" }); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error("blocked")); };
        req.onblocked = function () { reject(new Error("blocked")); };
      });
      upDB.catch(function () { upDB = null; }); // a later try may work (another tab closed, storage freed)
    }
    return upDB;
  }
  function upTx(mode, fn) {
    return upOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx, req;
        try { tx = db.transaction(UP_STORE, mode); req = fn(tx.objectStore(UP_STORE)); } catch (x) { reject(x); return; }
        tx.oncomplete = function () { resolve(req ? req.result : undefined); };
        tx.onerror = function () { reject(tx.error || new Error("failed")); };
        tx.onabort = function () { reject(tx.error || new Error("aborted")); };
      });
    });
  }
  var uploads = {
    get: function (id) { return UP_ID.test(id || "") ? upTx("readonly", function (st) { return st.get(id); }) : Promise.resolve(undefined); },
    all: function () { return upTx("readonly", function (st) { return st.getAll(); }); },
    put: function (rec) {
      if (upURLs[rec.id]) { URL.revokeObjectURL(upURLs[rec.id]); delete upURLs[rec.id]; }
      return upTx("readwrite", function (st) { return st.put(rec); });
    },
    remove: function (id) {
      if (upURLs[id]) { URL.revokeObjectURL(upURLs[id]); delete upURLs[id]; }
      return upTx("readwrite", function (st) { return st.delete(id); });
    },
    clear: function () { return upTx("readwrite", function (st) { return st.clear(); }); },
    url: function (rec) { // one object URL per stored picture, made from the stored Blob
      if (!rec || !(rec.blob instanceof Blob)) return null;
      if (!upURLs[rec.id]) upURLs[rec.id] = URL.createObjectURL(rec.blob);
      return upURLs[rec.id];
    },
    // what to tell her when the store won't take a picture
    problem: function (err) {
      var n = err && err.name;
      if (n === "QuotaExceededError") return "This browser's storage for photos is full. Delete an upload you no longer use (Change photo, Your uploads), or save your edits to a file and send the rest by email.";
      return "This browser won't store uploaded photos (a private window, or site storage is blocked). Open the preview in a normal window, or email the photos to Anid.";
    }
  };
  // An uploaded picture in the shape of a library photo, so a slot shows it the way it shows any photo
  function uploadPhoto(id) {
    return uploads.get(id).then(function (rec) {
      var url = uploads.url(rec);
      if (!url) return null;
      return { id: id, upload: true, alt: typeof rec.alt === "string" ? rec.alt : "", w: rec.w, h: rec.h,
        orientation: rec.w / rec.h >= 2 ? "panorama" : rec.w / rec.h >= 0.95 ? "landscape" : "portrait",
        focal: { x: 0.5, y: 0.5 }, src: { full: { src: url, w: rec.w } } };
    }, function () { return null; });
  }

  /* ---------- Photos from "Change photo" (BRIEF B4). Each slot keeps its page default; a pick swaps src, srcset
     and alt from the library and sets the focal point (object-position / background-position = focal × 100%). ---------- */
  var slotDefaults = {};
  document.querySelectorAll("[data-photo-slot]").forEach(function (slot) {
    var img = slot.querySelector("img");
    slotDefaults[slot.getAttribute("data-photo-slot")] = img ? {
      img: img, src: img.getAttribute("src"), srcset: img.getAttribute("srcset"), alt: img.getAttribute("alt"),
      width: img.getAttribute("width"), height: img.getAttribute("height"), style: img.getAttribute("style"),
      sources: [].slice.call(slot.querySelectorAll("source"))
    } : { style: slot.getAttribute("style") };
  });
  var PORTRAIT_SIZES = "(min-width: 1024px) 370px, 45vw"; // team cards: 266–369px wide on desktop, 160px on phones
  function abs(src) { return new URL(src, document.baseURI).href; }
  function sizesOf(photo) {
    return Object.keys(obj(photo.src)).map(function (k) { return photo.src[k]; })
      .filter(function (v) { return v && typeof v.src === "string" && v.w > 0; })
      .sort(function (a, b) { return a.w - b.w; });
  }
  function pctPos(focal) {
    var f = obj(focal), x = Math.min(1, Math.max(0, +f.x || 0)), y = Math.min(1, Math.max(0, +f.y || 0));
    return Math.round(x * 1000) / 10 + "% " + Math.round(y * 1000) / 10 + "%";
  }
  function resetSlot(slot) {
    var id = slot.getAttribute("data-photo-slot"), d = slotDefaults[id];
    slot.removeAttribute("data-photo-missing");
    if (!d) return;
    if (d.img) {
      var img = d.img;
      ["src", "srcset", "alt", "width", "height", "style"].forEach(function (a) { if (d[a] == null) img.removeAttribute(a); else img.setAttribute(a, d[a]); });
      var pic = img.parentNode;
      if (pic && pic.tagName === "PICTURE") d.sources.forEach(function (s) { if (!s.isConnected) pic.insertBefore(s, img); });
    } else {
      if (d.style == null) slot.removeAttribute("style"); else slot.setAttribute("style", d.style);
      var picked = slot.querySelector("img[data-picked]");
      if (picked) picked.remove();
      slot.classList.remove("has-photo");
    }
  }
  function applySlot(slot, pick, photo) {
    resetSlot(slot);
    if (!pick || !photo) return;
    var kind = slot.getAttribute("data-photo-kind") || "inline", sizes = sizesOf(photo);
    if (!sizes.length) return;
    var pos = pctPos(pick.focal || photo.focal), contain = pick.fit === "contain";
    var pickW = function (w) { return sizes.filter(function (s) { return s.w <= w; }).pop() || sizes[0]; };
    if (kind === "background") {
      slot.style.setProperty("--slot-bg", 'url("' + abs(pickW(1280).src) + '")');
      slot.style.setProperty("--slot-bg-sm", 'url("' + abs(pickW(640).src) + '")');
      slot.style.setProperty("--slot-bg-lg", 'url("' + abs(sizes[sizes.length - 1].src) + '")');
      slot.style.setProperty("--slot-pos", pos);
      if (contain) slot.style.setProperty("--slot-fit", "contain");
      return;
    }
    var img = slot.querySelector("img");
    if (!img && kind === "portrait") {
      img = document.createElement("img");
      img.setAttribute("data-picked", "");
      img.alt = ""; // the card's button already says the name
      img.setAttribute("sizes", PORTRAIT_SIZES);
      slot.insertBefore(img, slot.firstChild);
      slot.classList.add("has-photo");
    }
    if (!img) return;
    slot.querySelectorAll("source").forEach(function (s) { s.remove(); }); // the hero's phone crop belongs to the old photo
    var best = pickW(1600);
    img.setAttribute("src", best.src);
    img.setAttribute("srcset", sizes.map(function (s) { return s.src + " " + s.w + "w"; }).join(", "));
    if (kind !== "portrait") img.setAttribute("alt", photo.alt || "");
    img.setAttribute("width", best.w);
    img.setAttribute("height", Math.round(best.w * photo.h / photo.w));
    img.style.setProperty("--focus", pos);
    img.style.objectFit = contain ? "contain" : "";
  }
  var missingPhotos = [];
  // A pick names a library photo ({ photo: id }) or one of her uploads ({ upload: id }). Without the library file
  // (a page opened from disk) library picks keep the page's own photo; uploads still show.
  function applyPhotoEdits() {
    var picks = readEdits().photos;
    var slots = [].slice.call(document.querySelectorAll("[data-photo-slot]"));
    if (!Object.keys(picks).length) { slots.forEach(resetSlot); return Promise.resolve(); }
    var ids = [];
    Object.keys(picks).forEach(function (k) { var u = obj(picks[k]).upload; if (u && ids.indexOf(u) < 0) ids.push(u); });
    var library = Object.keys(picks).some(function (k) { return obj(picks[k]).photo; }) ? loadJSON(PHOTOS_JSON).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([library, Promise.all(ids.map(uploadPhoto))]).then(function (r) {
      var m = r[0], ups = {};
      ids.forEach(function (id, k) { ups[id] = r[1][k]; });
      missingPhotos = [];
      slots.forEach(function (slot) {
        var pick = obj(picks[slot.getAttribute("data-photo-slot")]);
        if (!pick.photo && !pick.upload) { resetSlot(slot); return; }
        if (pick.photo && !m) { resetSlot(slot); return; }
        var photo = pick.upload ? ups[pick.upload] : arr(m.photos).filter(function (p) { return p.id === pick.photo; })[0];
        if (!photo) { resetSlot(slot); slot.setAttribute("data-photo-missing", ""); missingPhotos.push(pick.upload || pick.photo); return; }
        applySlot(slot, pick, photo);
      });
    });
  }
  applyPhotoEdits();

  /* ---------- Site art (ANI-602): the header logo and the pillar wheel are upload slots. Their defaults are DG's
     placeholder files (LOGO above, and the wheel's <image> in index.html; DECISIONS 140). An upload shows here at once;
     tools/apply_edits.py writes it over the default file. ---------- */
  var wheelImage = document.querySelector(".pillar-wheel mask image");
  var artDefaults = { "site.logo": LOGO.svg || LOGO.png, "home.pillars.art": wheelImage ? wheelImage.getAttribute("href") : "" };
  function showArt(slot, rec) {
    var url = rec && rec.kind === "art" ? uploads.url(rec) : null;
    if (slot === "site.logo") {
      document.querySelectorAll("header.site .brand picture").forEach(function (pic) {
        var img = pic.querySelector("img"), src = pic.querySelector("source");
        if (src && url && src.hasAttribute("srcset")) { src.setAttribute("data-srcset", src.getAttribute("srcset")); src.removeAttribute("srcset"); } // the SVG gives way
        if (src && !url && src.hasAttribute("data-srcset")) src.setAttribute("srcset", src.getAttribute("data-srcset"));
        img.setAttribute("src", url || LOGO.png);
        img.setAttribute("width", url ? rec.w : LOGO.w);
        img.setAttribute("height", url ? rec.h : LOGO.h);
      });
    } else if (slot === "home.pillars.art" && wheelImage) {
      wheelImage.setAttribute("href", url || artDefaults[slot]);
    }
  }
  function applyArt() {
    var art = readEdits().art;
    return Promise.all(ART_SLOTS.map(function (slot) {
      var id = obj(art[slot]).upload;
      if (!id) { showArt(slot, null); return null; }
      return uploads.get(id).then(function (rec) { showArt(slot, rec); }, function () { showArt(slot, null); });
    }));
  }
  if (Object.keys(readEdits().art).length) applyArt();

  /* ---------- Impact counters: the real numbers are in the HTML ("2,000+"); with scripts and motion allowed they
     count up from 0 once, when scrolled into view. An edited number counts up the same way. Not in edit mode. ---------- */
  var counters = document.querySelectorAll("[data-count]");
  var editingAtLoad = params.get("edit") === "1" || (function () { try { return sessionStorage.getItem("dg-edit-mode") === "on"; } catch (e) { return false; } })();
  if (counters.length && !reduceMotion && !editingAtLoad && "IntersectionObserver" in window && "requestAnimationFrame" in window) {
    var parse = function (el) {
      var m = /^(\D*)([\d,]+)(.*)$/.exec(el.textContent.trim());
      return m ? { pre: m[1], end: parseInt(m[2].replace(/,/g, ""), 10), post: m[3], text: el.textContent } : null;
    };
    var runCount = function (el, n) {
      var t0 = null, dur = 1400;
      var step = function (t) {
        if (!t0) t0 = t;
        if (root.classList.contains("dg-editing")) { el.textContent = n.text; return; }
        var p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = p === 1 ? n.text : n.pre + Math.round(n.end * eased).toLocaleString("en-US") + n.post;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        if (root.classList.contains("dg-editing")) return;
        var n = parse(en.target);
        if (n) runCount(en.target, n);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { io.observe(c); });
  }

  /* ---------- Carousels: one at a time, "1 of N", crossfading and turning by itself (R5) ----------
     Each slide stays dwell(words) seconds: 2 s plus SECONDS_PER_WORD a word, at least 5 s and at most 15 s ("Auto"),
     or the fixed "Seconds per quote" picked in the testimonial bank. It waits while the pointer is over it, while
     keyboard focus is inside it, while it's off screen or the tab is hidden; its Pause button stops it for good;
     under reduced motion it never turns by itself and doesn't fade. Screen readers hear each quote only when the
     viewer moves it, not on every automatic turn. render() redraws it when the bank changes. */
  var SECONDS_PER_WORD = 0.3;
  var secondsPerQuote = "auto";
  function dwell(words) {
    if (secondsPerQuote !== "auto" && +secondsPerQuote > 0) return +secondsPerQuote;
    return Math.min(15, Math.max(5, 2 + SECONDS_PER_WORD * words));
  }
  function wordCount(s) { return (s.trim().match(/\S+/g) || []).length; }
  var carousels = [];
  document.querySelectorAll("[data-carousel]").forEach(function (car) {
    var slides = [], words = [], i = 0, counter = car.querySelector("[data-counter]");
    var track = car.querySelector(".track"), ctrls = car.querySelector(".ctrls");
    var bar = car.querySelector(".progress span");
    var auto = false, timer = null, running = false, remaining = 0, startedAt = 0;
    var stopped = false, hovering = false, focused = false, onScreen = true, pause = null;
    var restartBar = function () {
      if (!bar) return;
      bar.classList.remove("run");
      car.style.setProperty("--dwell", dwell(words[i]) + "s");
      void bar.offsetWidth; // restart the animation
      if (auto && !stopped) bar.classList.add("run");
    };
    var schedule = function (ms) {
      clearTimeout(timer);
      startedAt = Date.now();
      remaining = ms;
      timer = setTimeout(function () { show(i + 1); }, ms);
    };
    var show = function (n) {
      if (!slides.length) return;
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) {
        var on = k === i;
        s.classList.toggle("on", on);
        if (on) { s.removeAttribute("aria-hidden"); s.inert = false; s.removeAttribute("inert"); }
        else { s.setAttribute("aria-hidden", "true"); s.inert = true; s.setAttribute("inert", ""); }
      });
      if (counter) counter.textContent = (i + 1) + " of " + slides.length;
      remaining = dwell(words[i]) * 1000;
      restartBar();
      if (running) schedule(remaining);
    };
    var sync = function () {
      var run = auto && !stopped && !hovering && !focused && onScreen && !document.hidden;
      if (run && !running) { running = true; schedule(remaining > 0 ? remaining : dwell(words[i]) * 1000); }
      if (!run && running) { running = false; clearTimeout(timer); remaining = Math.max(0, remaining - (Date.now() - startedAt)); }
      car.classList.toggle("is-paused", !run);
      if (track) track.setAttribute("aria-live", run ? "off" : "polite");
    };
    // (re)reads the slides in the track: on load, and after the testimonial bank redraws them
    var refresh = function () {
      clearTimeout(timer);
      running = false;
      slides = [].slice.call(car.querySelectorAll(".slide"));
      words = slides.map(function (s) {
        var q = s.querySelector("blockquote") || s;
        var n = wordCount(q.textContent);
        s.classList.toggle("long", n > 25);
        return n;
      });
      slides.forEach(function (s, k) {
        s.setAttribute("role", "group");
        s.setAttribute("aria-roledescription", "slide");
        s.setAttribute("aria-label", (k + 1) + " of " + slides.length);
      });
      car.classList.toggle("single", slides.length < 2);
      auto = !reduceMotion && slides.length > 1;
      if (auto && ctrls && !pause) {
        ctrls.insertAdjacentHTML("beforeend", '<button type="button" data-pause>Pause</button>');
        pause = ctrls.querySelector("[data-pause]");
        pause.addEventListener("click", function () {
          stopped = !stopped;
          if (!stopped) { hovering = false; focused = false; restartBar(); remaining = dwell(words[i]) * 1000; } // Play means play, even with the pointer or focus here
          else if (bar) bar.classList.remove("run");
          pause.textContent = stopped ? "Play" : "Pause";
          sync();
        });
      }
      if (pause) pause.hidden = !auto;
      remaining = 0;
      show(0);
      sync();
    };
    var prev = car.querySelector("[data-prev]"), next = car.querySelector("[data-next]");
    if (prev) prev.addEventListener("click", function () { show(i - 1); });
    if (next) next.addEventListener("click", function () { show(i + 1); });
    car.addEventListener("keydown", function (e) {
      if (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") show(i - 1);
      if (e.key === "ArrowRight") show(i + 1);
    });
    car.addEventListener("mouseenter", function () { hovering = true; sync(); });
    car.addEventListener("mouseleave", function () { hovering = false; sync(); });
    // keyboard focus waits; a mouse click on an arrow doesn't (the pointer leaving is enough)
    car.addEventListener("focusin", function (e) {
      var keyboard = true;
      try { keyboard = e.target.matches(":focus-visible"); } catch (x) {}
      if (keyboard) { focused = true; sync(); }
    });
    car.addEventListener("focusout", function (e) { if (!car.contains(e.relatedTarget)) { focused = false; sync(); } });
    document.addEventListener("visibilitychange", sync);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; sync(); }).observe(car);
    }
    refresh();
    carousels.push({ el: car, refresh: refresh });
  });

  /* ---------- Testimonial bank (BRIEF B5): the carousels draw from assets/data/testimonials.json plus Lyndsey's
     overlay in "my edits" (edit, add, hide, show, remove and order, keyed by quote id, so new seed quotes merge in
     without losing her changes). Everything is drawn with textContent. Without the file, the slides in the HTML
     stay. A band with no quotes shown hides itself; the Advising band shows DG-note placeholders until it has
     advising quotes. ---------- */
  var PLACEMENTS = ["home", "advising"];
  var bankSeed = null;
  function cleanItem(t) {
    t = obj(t);
    if (typeof t.id !== "string" || typeof t.quote !== "string") return null;
    return {
      id: t.id, quote: t.quote, name: typeof t.name === "string" ? t.name : "", role: typeof t.role === "string" ? t.role : "",
      program: typeof t.program === "string" ? t.program : "", year: t.year == null ? null : t.year,
      placements: arr(t.placements).filter(function (p) { return PLACEMENTS.indexOf(p) > -1; }),
      status: t.status === "show" ? "show" : "hide", consent: typeof t.consent === "string" ? t.consent : "",
      source: typeof t.source === "string" ? t.source : ""
    };
  }
  function mergeBank(seed, o) {
    o = obj(o);
    var edit = obj(o.edit), hide = arr(o.hide), show = arr(o.show), remove = arr(o.remove);
    var items = arr(obj(seed).items).map(cleanItem).filter(Boolean).filter(function (t) { return remove.indexOf(t.id) < 0; });
    items.forEach(function (t) {
      t.seed = true;
      var e = obj(edit[t.id]);
      ["quote", "name", "role"].forEach(function (f) { if (typeof e[f] === "string") t[f] = e[f]; });
      if (Array.isArray(e.placements)) t.placements = e.placements.filter(function (p) { return PLACEMENTS.indexOf(p) > -1; });
      if (hide.indexOf(t.id) > -1) t.status = "hide";
      else if (show.indexOf(t.id) > -1) t.status = "show";
    });
    var ids = items.map(function (t) { return t.id; });
    arr(o.add).forEach(function (a) {
      var t = cleanItem(a);
      if (!t || ids.indexOf(t.id) > -1) return; // already merged into the seed by apply_edits.py
      t.status = obj(a).status === "hide" ? "hide" : "show";
      t.added = true;
      items.push(t);
      ids.push(t.id);
    });
    return items;
  }
  // the order of quotes per page: the bank's own (set by tools/apply_edits.py), then this browser's changes on top
  function bankOrder(o) { return Object.assign({}, obj(obj(bankSeed).order), obj(obj(o).order)); }
  function bankFor(items, placement, order) {
    var ord = arr(obj(order)[placement]);
    var list = items.filter(function (t) { return t.placements.indexOf(placement) > -1; });
    var pos = function (t) { var k = ord.indexOf(t.id); return k < 0 ? ord.length + list.indexOf(t) : k; };
    return list.slice().sort(function (a, b) { return pos(a) - pos(b); });
  }
  function renderBank() {
    if (!bankSeed) return;
    var o = obj(readEdits().testimonials);
    var items = mergeBank(bankSeed, o);
    var s = o.secondsPerQuote !== undefined ? o.secondsPerQuote : bankSeed.secondsPerQuote;
    secondsPerQuote = s === "auto" || [2, 4, 6, 8].indexOf(+s) > -1 ? (s === "auto" ? "auto" : +s) : "auto";
    carousels.forEach(function (c) {
      var car = c.el, placement = car.getAttribute("data-placement");
      if (PLACEMENTS.indexOf(placement) < 0) return;
      var band = car.closest("section"), track = car.querySelector(".track");
      if (!c.fallback) c.fallback = [].slice.call(track.children);
      if (band && !c.bandNotesOnly) c.bandNotesOnly = band.hasAttribute("data-notes-only") ? "yes" : "no";
      var shown = bankFor(items, placement, bankOrder(o)).filter(function (t) { return t.status === "show"; });
      track.textContent = "";
      if (!shown.length && placement === "advising") {
        c.fallback.forEach(function (n) { track.appendChild(n); }); // DG-note placeholders until there are advising stories
        if (band && c.bandNotesOnly === "yes") band.setAttribute("data-notes-only", "");
        if (band) band.removeAttribute("data-bank-empty");
      } else {
        shown.forEach(function (t, k) {
          var fig = document.createElement("figure"), bq = document.createElement("blockquote"), p = document.createElement("p");
          fig.className = "slide" + (k ? "" : " on");
          p.textContent = t.quote;
          bq.appendChild(p);
          fig.appendChild(bq);
          var who = [t.name, t.role].filter(Boolean).join(", ");
          if (who) {
            var cap = document.createElement("figcaption");
            cap.textContent = "— " + who;
            fig.appendChild(cap);
          }
          track.appendChild(fig);
        });
        if (band) {
          band.removeAttribute("data-notes-only");
          band.toggleAttribute("data-bank-empty", !shown.length);
        }
      }
      c.refresh();
    });
  }
  if (document.querySelector("[data-carousel][data-placement]")) {
    loadJSON(BANK_JSON).then(function (seed) { bankSeed = obj(seed); renderBank(); }, function () {});
  }

  /* ---------- Pillars (R13; round 3, ANI-546): accessible tabs around DG's brushstroke wheel. The names are the tab
     buttons; each stroke (the wheel's sector at 12, 4 or 8 o'clock) acts as its name's button. Which pillar sits where
     is the "Pillar wheel" setting, clockwise from the top, and the arrow keys follow the same order. On desktop,
     resting the pointer on a stroke or name for 150ms previews that pillar; the preview holds while the pointer is
     anywhere over the wheel, names or panel, and the selected pillar returns when it leaves, or on Escape. ---------- */
  var SECTORS = ["top", "right", "left"]; // clockwise from 12 o'clock
  var pillarWheels = [];
  document.querySelectorAll("[data-pillars]").forEach(function (box) {
    var tablist = box.querySelector('[role="tablist"]');
    var tabs = [].slice.call(box.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    var sectors = [].slice.call(box.querySelectorAll(".pw-sector"));
    var groupOf = function (k) { return box.querySelector('.pw-sector[data-for="' + tabs[k].id + '"]'); };
    var tabOf = function (g) { return tabs.indexOf(document.getElementById(g.getAttribute("data-for"))); };
    var canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    var selected = Math.max(0, tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; }));
    var shown = selected, hoverTimer = null;
    var paint = function () {
      box.classList.toggle("is-previewing", shown !== selected);
      tabs.forEach(function (t, k) {
        t.setAttribute("aria-selected", k === selected ? "true" : "false");
        t.tabIndex = k === selected ? 0 : -1;
        t.classList.toggle("is-shown", k === shown);
        var g = groupOf(k);
        if (g) {
          g.classList.toggle("is-selected", k === selected);
          g.classList.toggle("is-shown", k === shown);
        }
      });
      panels.forEach(function (p, k) { if (p) p.classList.toggle("is-shown", k === shown); });
    };
    var select = function (k, focus) {
      clearTimeout(hoverTimer);
      selected = shown = k;
      paint();
      if (focus) tabs[k].focus();
    };
    var restore = function () { clearTimeout(hoverTimer); if (shown !== selected) { shown = selected; paint(); } };
    var setHover = function (k, on) {
      var g = groupOf(k);
      if (g) g.classList.toggle("is-hover", on);
      tabs[k].classList.toggle("is-hover", on);
    };
    var enter = function (k, e) {
      setHover(k, true);
      if (!canHover || e.pointerType === "touch" || root.classList.contains("dg-editing")) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { shown = k; paint(); }, 150);
    };
    var leave = function (k) { setHover(k, false); clearTimeout(hoverTimer); };
    tabs.forEach(function (t, k) {
      t.addEventListener("click", function () { select(k, false); });
      t.addEventListener("focus", function () { var g = groupOf(k); if (g) g.classList.add("is-focus"); });
      t.addEventListener("blur", function () { sectors.forEach(function (g) { g.classList.remove("is-focus"); }); });
      t.addEventListener("pointerenter", function (e) { enter(k, e); });
      t.addEventListener("pointerleave", function () { leave(k); });
    });
    sectors.forEach(function (g) {
      var hit = g.querySelector(".hit");
      if (!hit) return;
      hit.addEventListener("click", function () { var k = tabOf(g); if (k > -1) select(k, false); });
      hit.addEventListener("pointerenter", function (e) { var k = tabOf(g); if (k > -1) enter(k, e); });
      hit.addEventListener("pointerleave", function () { var k = tabOf(g); if (k > -1) leave(k); });
    });
    tablist.addEventListener("keydown", function (e) {
      var list = [].slice.call(tablist.querySelectorAll('[role="tab"]')); // clockwise, the wheel's order
      var i = list.indexOf(document.activeElement), n = list.length;
      if (i < 0) return;
      var to = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (i + 1) % n;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (i - 1 + n) % n;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = n - 1;
      if (to === null) return;
      e.preventDefault();
      select(tabs.indexOf(list[to]), true);
    });
    box.addEventListener("pointerleave", restore);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") restore(); });
    // the "Pillar wheel" setting: the pillar for each sector, clockwise from the top; the tabs follow in that order
    pillarWheels.push(function (order) {
      sectors.forEach(function (g) { g.classList.remove("is-hover", "is-focus"); });
      tabs.forEach(function (t) { t.classList.remove("is-hover"); });
      order.split("-").forEach(function (id, i) {
        var g = box.querySelector('.pw-sector[data-sector="' + SECTORS[i] + '"]');
        var t = document.getElementById("pillar-tab-" + id);
        if (!g || !t || tabs.indexOf(t) < 0) return;
        g.setAttribute("data-for", t.id);
        t.setAttribute("data-pos", SECTORS[i]);
        tablist.appendChild(t);
      });
      paint();
    });
    paint();
  });
  var orderSel = sw.querySelector("[data-pillar-order]");
  if (orderSel) {
    var setOrder = function (v, quiet) {
      orderSel.value = v;
      pillarWheels.forEach(function (f) { f(v); });
      if (!quiet) setSetting("pillarOrder", v);
    };
    orderSel.addEventListener("change", function () { setOrder(orderSel.value); });
    setOrder(getSetting("pillarOrder", PILLAR_ORDERS), true);
    switches.pillarOrder = function () { setOrder(getSetting("pillarOrder", PILLAR_ORDERS), true); };
  }

  /* ---------- Retreat Guru rows (R10, A3) ----------
     Undocumented public endpoint, no token. In WordPress, fetch it server-side and cache it (a transient), never
     from the browser. Here: one plain GET with no custom headers (any header triggers a preflight, and the server
     answers OPTIONS with 400), an 8 s timeout, and everything drawn with textContent, never innerHTML. */
  var RG_API = "https://dharma-gates.secure.retreat.guru/wp-json/events/?fields=ID,slug,title,text,date,start,end,location,teacher_list,source_url&ver=react";
  var RG_PROGRAMS = "https://dharma-gates.secure.retreat.guru/programs/";
  var RG_SITE = "https://dharma-gates.secure.retreat.guru";
  var RG_LOCATION_OVERRIDES = { // the two November programs have no location in Retreat Guru (DG note on retreats.html)
    "online-1-2-day-retreat-trauma-informed-meditation-2": "Online (Zoom)",
    "dancing-in-fire-wisdom-and-compassion-practices-to-help-heal-a-burning-world": "New York, NY"
  };
  var RG_DONATION_LINE = "Offered by donation"; // DG's dana wording, not a price (R10)
  var rgLists = document.querySelectorAll("[data-rg-rows]");
  if (rgLists.length) {
    var decode = function (s) {
      if (s == null) return "";
      return (new DOMParser().parseFromString(String(s), "text/html").documentElement.textContent || "").replace(/\s+/g, " ").trim();
    };
    var excerpt = function (s) {
      var t = decode(s).replace(/\s*\[(…|\.\.\.)\]\s*$/, "").trim();
      if (t.length <= 160) return t;
      t = t.slice(0, 160);
      var cut = t.lastIndexOf(" ");
      if (cut > 80) t = t.slice(0, cut);
      return t.replace(/[\s,;:.–—-]+$/, "") + "…";
    };
    var utcDate = function (secs) { return new Date(Number(secs) * 1000); };
    var fmt = function (d, opts) { opts.timeZone = "UTC"; return d.toLocaleDateString("en-US", opts); };
    var shape = function (data) {
      var now = Date.now();
      return data.filter(function (p) {
        if (!p || p.start == null || isNaN(Number(p.start))) return false;
        var end = Number(p.end != null && p.end !== "" ? p.end : p.start);
        return (end + 86400) * 1000 > now;
      }).sort(function (a, b) { return Number(a.start) - Number(b.start); });
    };
    var el = function (tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    var metaItem = function (dl, label, value) {
      if (!value) return;
      var g = el("div"), dt = el("dt", "visually-hidden", label), dd = el("dd");
      if (value.nodeType) dd.appendChild(value); else dd.textContent = value;
      g.appendChild(dt); g.appendChild(dd); dl.appendChild(g);
    };
    var rowFor = function (p) {
      var title = decode(p.title);
      var start = utcDate(p.start);
      var li = el("li", "rg-row");
      var when = el("div", "rg-when");
      when.setAttribute("aria-hidden", "true");
      when.appendChild(el("span", "rg-month", fmt(start, { month: "short" })));
      when.appendChild(el("span", "rg-day", fmt(start, { day: "numeric" })));
      var body = el("div", "rg-body");
      body.appendChild(el("h3", "rg-title", title));
      var dl = el("dl", "rg-meta");
      metaItem(dl, "Teacher", decode(p.teacher_list).replace(/^with\s+/i, ""));
      var time = el("time", null, decode(p.date) || fmt(start, { month: "long", day: "numeric", year: "numeric" }));
      time.setAttribute("datetime", start.toISOString().slice(0, 10));
      metaItem(dl, "Dates", time);
      metaItem(dl, "Location", decode(p.location) || RG_LOCATION_OVERRIDES[p.slug] || "");
      metaItem(dl, "Cost", RG_DONATION_LINE);
      body.appendChild(dl);
      var desc = excerpt(p.text);
      if (desc) body.appendChild(el("p", "rg-desc", desc));
      var href = /^https:\/\//.test(p.source_url || "") ? p.source_url : RG_SITE + "/program/" + encodeURIComponent(p.slug || "") + "/";
      var a = el("a", "btn", "Register");
      a.href = href;
      a.rel = "noopener";
      a.appendChild(el("span", "visually-hidden", " for " + title));
      li.appendChild(when); li.appendChild(body); li.appendChild(a);
      return li;
    };
    var replaceWith = function (list, cls, text, linkText, href) {
      var p = el("p", cls, text + " ");
      var a = el("a", null, linkText);
      a.href = href;
      if (/^https:/.test(href)) a.rel = "noopener";
      p.appendChild(a);
      list.replaceWith(p);
    };
    var failed = function () {
      rgLists.forEach(function (list) {
        replaceWith(list, "rg-fallback", "Upcoming retreats are listed on Retreat Guru.", "See All Retreats on Retreat Guru →", RG_PROGRAMS);
      });
    };
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var watchdog = setTimeout(function () { if (ctrl) ctrl.abort(); else failed(); }, 8000);
    fetch(RG_API, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (text) {
        clearTimeout(watchdog);
        var data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error("not a list");
        var programs = shape(data);
        rgLists.forEach(function (list) {
          var limit = parseInt(list.getAttribute("data-rg-limit"), 10);
          var shown = limit > 0 ? programs.slice(0, limit) : programs;
          if (!shown.length) {
            replaceWith(list, "rg-empty", "No retreats are scheduled right now. New dates go out in the monthly newsletter.", "Join the Newsletter →", "#footer-signup");
            return;
          }
          list.textContent = "";
          shown.forEach(function (p) { list.appendChild(rowFor(p)); });
          list.setAttribute("aria-busy", "false");
        });
      })
      .catch(function () { clearTimeout(watchdog); failed(); });
  }

  /* ---------- Team bios (R16): one native <dialog>; each card opens its bio, #team-<slug> links open it on load.
     Each bio lives in the page as <div id="bio-<slug>" hidden>; the dialog borrows it while open and puts it back on
     close, so its keyed paragraphs stay editable (the editor edits the name and role here too). ---------- */
  var dialog = document.getElementById("bio-dialog");
  if (dialog && typeof dialog.showModal === "function") {
    var bioText = dialog.querySelector(".bio-text"), bioName = dialog.querySelector("#bio-name");
    var bioRole = dialog.querySelector(".bio-role"), bioPhoto = dialog.querySelector(".bio-photo");
    var opener = null, borrowed = null, home = null;
    var openBio = function (card) {
      var slug = card.id.replace(/^team-/, "");
      var bio = document.getElementById("bio-" + slug);
      if (!bio) return;
      opener = card;
      bioName.textContent = card.querySelector(".name").textContent;
      bioRole.textContent = card.querySelector(".role").textContent;
      bioPhoto.innerHTML = "";
      var ph = card.querySelector(".ph");
      if (ph) [].forEach.call(ph.childNodes, function (n) { bioPhoto.appendChild(n.cloneNode(true)); });
      home = document.createComment("bio-" + slug);
      bio.parentNode.insertBefore(home, bio);
      bioText.appendChild(bio);
      bio.hidden = false;
      borrowed = bio;
      dialog.showModal();
      try { history.replaceState(null, "", location.pathname + location.search + "#" + card.id); } catch (e) {}
      document.dispatchEvent(new CustomEvent("dg:bio-open", { detail: { card: card, slug: slug } }));
    };
    dialog.addEventListener("close", function () {
      if (borrowed && home) { borrowed.hidden = true; home.parentNode.replaceChild(borrowed, home); }
      borrowed = home = null;
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      if (opener) opener.focus();
      document.dispatchEvent(new CustomEvent("dg:bio-close"));
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); }); // backdrop
    dialog.querySelector(".bio-close").addEventListener("click", function () { dialog.close(); });
    document.querySelectorAll("button.person").forEach(function (card) {
      card.addEventListener("click", function () { openBio(card); });
    });
    var hashCard = /^#team-[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    if (hashCard && hashCard.matches("button.person")) openBio(hashCard);
  }

  /* ---------- The editing tools (BRIEF B1–B6) load from assets/editor.js the first time they're needed: "Edit this
     page" (or ?edit=1, which lasts for the visit), "Edit fonts live", or a My edits button. ---------- */
  var EDITOR_JS = "assets/editor.js";
  var editorReady = null;
  function withEditor(fn) {
    if (!editorReady) editorReady = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = EDITOR_JS;
      s.onload = function () { if (window.dgEditor) resolve(window.dgEditor); else reject(new Error("no editor")); };
      s.onerror = reject;
      document.body.appendChild(s);
    });
    editorReady.then(fn, function () { editorReady = null; say("The editing tools couldn't load. Check the connection and try again.", true); });
  }
  var unsavedLine = sw.querySelector("[data-unsaved]");
  function showUnsaved() {
    var n = unsavedCount(), total = totalEdits();
    unsavedLine.textContent = "";
    if (total || n) {
      var b = document.createElement("span");
      b.className = n ? "sw-unsaved" : "";
      b.textContent = n ? n + (n === 1 ? " change" : " changes") + " not saved to a file. " : "All your changes are saved to a file. ";
      unsavedLine.appendChild(b);
    }
    unsavedLine.appendChild(document.createTextNode("Edits stay in this browser only; Safari clears them after 7 days without a visit, so save a file and send it to Anid."));
  }
  editListeners.push(showUnsaved);
  showUnsaved();
  function setEditingButtons(on) {
    sw.querySelectorAll("[data-editing]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-editing") === (on ? "on" : "off")); });
  }
  setEditingButtons(false);
  sw.querySelectorAll("[data-editing]").forEach(function (b) {
    b.addEventListener("click", function () {
      var on = b.getAttribute("data-editing") === "on";
      if (!on && !editorReady) { setEditingButtons(false); return; }
      withEditor(function (E) { E.setEditing(on); });
    });
  });
  sw.querySelectorAll("[data-my]").forEach(function (b) {
    b.addEventListener("click", function () {
      var what = b.getAttribute("data-my");
      withEditor(function (E) { E.myEdits(what, b); });
    });
  });
  sw.querySelectorAll("[data-art]").forEach(function (b) {
    b.addEventListener("click", function () { withEditor(function (E) { E.openArt(b.getAttribute("data-art"), b); }); });
  });
  sw.querySelector(".sw-fonts-panel").addEventListener("toggle", function (e) {
    if (e.target.open) withEditor(function (E) { E.openFonts(sw.querySelector(".sw-fonts")); });
  });
  if (editingAtLoad) {
    try { sessionStorage.setItem("dg-edit-mode", "on"); } catch (e) {}
    withEditor(function (E) { E.setEditing(true); });
  }
  // right after "Load edits" the page reloads; the editor shows what loaded and what was skipped
  else if ((function () { try { return !!sessionStorage.getItem("dg-load-report"); } catch (e) { return false; } })()) withEditor(function () {});

  // What the editor uses from the page
  window.dgSite = {
    page: page, sw: sw, say: say, copyText: copyText, readEdits: readEdits, writeEdits: writeEdits,
    onEdits: function (fn) { editListeners.push(fn); }, unsavedCount: unsavedCount, markExported: markExported, flatten: flatten,
    normalize: normalize, textOf: textOf, setText: setText, shortHash: shortHash, textDefaults: textDefaults, keyed: keyed,
    applyTextEdits: applyTextEdits, design: function () { return design; }, designs: DESIGNS, slots: SLOTS,
    applyColorEdits: applyColorEdits, applyFonts: applyFonts, fontStack: fontStack, roles: ROLES, boot: boot,
    settings: SETTINGS, pillarOrders: PILLAR_ORDERS, refreshSwitches: function () { Object.keys(switches).forEach(function (k) { switches[k](); }); },
    loadJSON: loadJSON, PHOTOS_JSON: PHOTOS_JSON, BANK_JSON: BANK_JSON, slotDefaults: slotDefaults, applySlot: applySlot,
    resetSlot: resetSlot, applyPhotoEdits: applyPhotoEdits, missingPhotos: function () { return missingPhotos; },
    pctPos: pctPos, sizesOf: sizesOf, bankSeed: function () { return bankSeed; }, mergeBank: mergeBank, bankFor: bankFor, bankOrder: bankOrder,
    renderBank: renderBank, carousels: carousels, setEditingButtons: setEditingButtons, showUnsaved: showUnsaved,
    placements: PLACEMENTS, uploads: uploads, uploadPhoto: uploadPhoto, applySizes: applySizes, sizeKeys: SIZE_KEYS,
    sizeDefaults: SIZE_DEFAULTS, artSlots: ART_SLOTS, applyArt: applyArt, artDefault: function (slot) { return artDefaults[slot]; }
  };
})();
