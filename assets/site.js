/* Dharma Gates — prototype
   Injects the shared header/footer, drives the design and navigation switcher, the hero video, the carousels,
   the pillars, the team bios and the live Retreat Guru rows. No build step, no dependencies. */
(function () {
  var page = document.body.getAttribute("data-page") || "";
  var root = document.documentElement;
  var isPreview = !!document.querySelector('meta[name="dg-preview"]');
  var params = new URLSearchParams(location.search);
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function load(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  // ?design=, ?nav=, ?clip=, ?impact=, ?mission= and ?measure= pick a starting point once; drop them from the address
  // bar so a reload keeps whatever the viewer switches to afterwards
  var URL_KEYS = ["design", "nav", "clip", "impact", "mission", "measure"];
  if (new RegExp("[?&](" + URL_KEYS.join("|") + ")=").test(location.search) && history.replaceState) {
    var keep = new URLSearchParams(location.search);
    URL_KEYS.forEach(function (k) { keep.delete(k); });
    var rest = keep.toString();
    try { history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) {}
  }
  root.classList.add("js");

  /* ---------- The logo's one swappable spot ----------
     Placeholder until DG's logo is final. To swap it, set LOGO to an <img> (or inline SVG), e.g.
     '<img src="assets/img/logo.svg" alt="">', and the header picks it up on every page. */
  var LOGO = "";

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
    '<a class="brand" href="index.html"><span class="logo-slot" aria-hidden="true" title="Logo placeholder">' + LOGO + "</span>Dharma Gates</a>" +
    '<div class="header-tools"><a class="btn small header-donate" href="donate.html">Donate</a>' +
    '<button type="button" class="menu-toggle" aria-label="Menu" aria-expanded="false" aria-controls="primary-nav">☰</button></div>' +
    '<nav class="primary" id="primary-nav" aria-label="Main">' + navList(NAV_A, "nav-a") + navList(NAV_B, "nav-b") + "</nav>" +
    "</div></header>";

  var hasHeroVideo = !!document.querySelector(".hero-video");
  var hasMission = !!document.getElementById("mission");
  var switcher =
    '<div class="switcher" id="switcher"><button type="button" class="sw-toggle" aria-expanded="false" aria-controls="sw-panel">Compare designs ▴</button>' +
    '<div class="sw-panel" id="sw-panel">' +
    row("Design", buttons(DESIGNS, "data-design")) +
    row("Nav", '<button type="button" data-v="a">A · Minimal</button><button type="button" data-v="b">B · Fuller</button>') +
    (hasHeroVideo ? row("Video", buttons(CLIPS, "data-clip")) : "") +
    (hasMission ? row("Mission", buttons([["text", "Text"], ["photo", "Photo"]], "data-mission")) : "") +
    row("Impact page in menu", buttons([["off", "Off"], ["on", "On"]], "data-impact")) +
    row("Show DG notes", buttons([["on", "On"], ["off", "Off"]], "data-notes")) +
    row("Text width", buttons([["wide", "Wide", "68ch, about 87 characters a line"], ["comfortable", "Comfortable", "58ch, about 74 characters a line"]], "data-measure")) +
    '<details><summary>Edit colors live</summary><div class="sw-colors">' +
    SLOTS.map(function (s) { return '<label for="c' + s[0] + '">' + s[1] + '</label><input type="color" id="c' + s[0] + '" data-token="' + s[0] + '">'; }).join("") +
    '</div><div class="sw-actions"><button type="button" data-colors="copy">Copy hex codes</button><button type="button" data-colors="reset">Reset</button></div><div class="sw-msg" aria-live="polite"></div></details>' +
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
  try { localStorage.removeItem("dg-design"); } catch (e) {}
  var design = params.get("design");
  var designFromLink = isDesign(design);
  if (!isDesign(design)) design = load("dg-design-pick", DEFAULT_DESIGN);
  if (!isDesign(design)) design = DEFAULT_DESIGN;
  var inputs = sw.querySelectorAll("input[data-token]");
  var msg = sw.querySelector(".sw-msg");
  function setDesign(d, remember) {
    design = d;
    root.setAttribute("data-design", d);
    sw.querySelectorAll("[data-design]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-design") === d); });
    var name = DESIGNS.filter(function (x) { return x[0] === d; })[0][1];
    // the folded button stays short ("Design 5") so it covers as little as possible; its tooltip has the full name
    swToggle.textContent = "Design " + d.slice(1) + (sw.classList.contains("open") ? " ▾" : " ▴");
    swToggle.title = "Design: " + name.replace(/^\d · /, "");
    if (remember) save("dg-design-pick", d);
    msg.textContent = "";
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

  /* ---------- Two-way switches, kept on <html> so CSS shows or hides things. Each page's head script sets them
     before the first paint (no flash); these keep them in sync and remember the choice. ---------- */
  function toggle(attr, key, values, fallback, fromUrl, after) {
    var v = fromUrl && values.indexOf(params.get(fromUrl)) > -1 ? params.get(fromUrl) : load(key, fallback);
    if (values.indexOf(v) < 0) v = fallback;
    var set = function (val) {
      root.setAttribute("data-" + attr, val);
      sw.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-" + attr) === val); });
      save(key, val);
      if (after) after(val);
    };
    sw.querySelectorAll("[data-" + attr + "]").forEach(function (b) {
      b.addEventListener("click", function () { set(b.getAttribute("data-" + attr)); });
    });
    set(v);
  }
  // Impact page in menu (A6): off by default. Who We Serve's Impact link follows it.
  toggle("impact", "dg-impact-page", ["off", "on"], "off", "impact", function (v) {
    document.querySelectorAll("[data-impact-link]").forEach(function (a) { a.setAttribute("href", v === "on" ? "impact.html" : "index.html#impact"); });
  });
  // Show DG notes (R6): a viewing preference, on by default
  toggle("notes", "dg-show-notes", ["on", "off"], "on", null);
  // Text width (R1): Wide is 68ch, Comfortable 58ch
  toggle("measure", "dg-measure", ["wide", "comfortable"], "wide", "measure");
  // Mission (R11): the text-only statement by default, the photo version one switch away
  if (hasMission) toggle("mission", "dg-mission", ["text", "photo"], "text", "mission", function (v) {
    document.getElementById("mission").setAttribute("data-variant", v);
  });

  /* ---------- Live color editing: change any slot on a call, then copy the codes ---------- */
  function editsKey() { return "dg-colors-" + design; }
  function readEdits() { try { return JSON.parse(load(editsKey(), "{}")) || {}; } catch (e) { return {}; } }
  function applyColorEdits() {
    SLOTS.forEach(function (s) { root.style.removeProperty(s[0]); });
    var edits = readEdits();
    Object.keys(edits).forEach(function (t) { root.style.setProperty(t, edits[t]); });
    var cs = getComputedStyle(root);
    inputs.forEach(function (inp) {
      var v = cs.getPropertyValue(inp.getAttribute("data-token")).trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) inp.value = v;
    });
  }
  inputs.forEach(function (inp) {
    inp.addEventListener("input", function () {
      var edits = readEdits();
      edits[inp.getAttribute("data-token")] = inp.value;
      root.style.setProperty(inp.getAttribute("data-token"), inp.value);
      save(editsKey(), JSON.stringify(edits));
    });
  });
  sw.querySelector('[data-colors="reset"]').addEventListener("click", function () {
    try { localStorage.removeItem(editsKey()); } catch (e) {}
    applyColorEdits();
    msg.textContent = "Back to this version's colors.";
  });
  sw.querySelector('[data-colors="copy"]').addEventListener("click", function () {
    var cs = getComputedStyle(root);
    var name = DESIGNS.filter(function (x) { return x[0] === design; })[0][1];
    var text = "Design " + name + "\n" + SLOTS.map(function (s) { return s[1] + ": " + cs.getPropertyValue(s[0]).trim(); }).join("\n");
    var done = function () { msg.textContent = "Copied."; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy these codes:", text); });
    else window.prompt("Copy these codes:", text);
  });

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

  /* ---------- Impact counters: the real numbers are in the HTML ("2,000+"); with scripts and motion allowed they
     count up from 0 once, when scrolled into view ---------- */
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && !reduceMotion && "IntersectionObserver" in window && "requestAnimationFrame" in window) {
    var parse = function (el) {
      var m = /^(\D*)([\d,]+)(.*)$/.exec(el.textContent.trim());
      return m ? { pre: m[1], end: parseInt(m[2].replace(/,/g, ""), 10), post: m[3], text: el.textContent } : null;
    };
    var runCount = function (el, n) {
      var t0 = null, dur = 1400;
      var step = function (t) {
        if (!t0) t0 = t;
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
        var n = parse(en.target);
        if (n) runCount(en.target, n);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { io.observe(c); });
  }

  /* ---------- Carousels: one at a time, "1 of N", crossfading and turning by itself (R5) ----------
     Each slide stays dwell(words) seconds: 2 s plus SECONDS_PER_WORD a word, at least 5 s and at most 15 s. It waits
     while the pointer is over it, while keyboard focus is inside it, while it's off screen or the tab is hidden; its
     Pause button stops it for good; under reduced motion it never turns by itself and doesn't fade. Screen readers
     hear each quote only when the viewer moves it, not on every automatic turn. */
  var SECONDS_PER_WORD = 0.3;
  function dwell(words) { return Math.min(15, Math.max(5, 2 + SECONDS_PER_WORD * words)); }
  function wordCount(s) { return (s.trim().match(/\S+/g) || []).length; }
  document.querySelectorAll("[data-carousel]").forEach(function (car) {
    var slides = car.querySelectorAll(".slide"), i = 0, counter = car.querySelector("[data-counter]");
    var track = car.querySelector(".track"), ctrls = car.querySelector(".ctrls");
    var bar = car.querySelector(".progress span");
    var words = [].map.call(slides, function (s) {
      var q = s.querySelector("blockquote") || s;
      var n = wordCount(q.textContent);
      if (n > 25) s.classList.add("long");
      return n;
    });
    slides.forEach(function (s, k) {
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "slide");
      s.setAttribute("aria-label", (k + 1) + " of " + slides.length);
    });
    if (slides.length < 2) { car.classList.add("single"); }
    var auto = !reduceMotion && slides.length > 1;
    var timer = null, running = false, remaining = 0, startedAt = 0;
    var stopped = false, hovering = false, focused = false, onScreen = true;
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
    var prev = car.querySelector("[data-prev]"), next = car.querySelector("[data-next]");
    if (prev) prev.addEventListener("click", function () { show(i - 1); });
    if (next) next.addEventListener("click", function () { show(i + 1); });
    car.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
    show(0);
    if (!auto) { if (track) track.setAttribute("aria-live", "polite"); return; }

    var pause = null;
    var sync = function () {
      var run = !stopped && !hovering && !focused && onScreen && !document.hidden;
      if (run && !running) { running = true; schedule(remaining > 0 ? remaining : dwell(words[i]) * 1000); }
      if (!run && running) { running = false; clearTimeout(timer); remaining = Math.max(0, remaining - (Date.now() - startedAt)); }
      car.classList.toggle("is-paused", !run);
      if (track) track.setAttribute("aria-live", run ? "off" : "polite");
    };
    if (ctrls) {
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
    sync();
  });

  /* ---------- Pillars (R13): accessible tabs. The names are the tab buttons; each arc acts as its name's button.
     On desktop, resting the pointer on an arc or name for 150ms previews that pillar; the preview holds while the
     pointer is anywhere over the circle, names or panel, and the selected pillar returns when it leaves, or on Escape. */
  document.querySelectorAll("[data-pillars]").forEach(function (box) {
    var tabs = [].slice.call(box.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    var groups = tabs.map(function (t) { return box.querySelector('g[data-for="' + t.id + '"]'); });
    var canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    var selected = Math.max(0, tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; }));
    var shown = selected, hoverTimer = null;
    var paint = function () {
      tabs.forEach(function (t, k) {
        t.setAttribute("aria-selected", k === selected ? "true" : "false");
        t.tabIndex = k === selected ? 0 : -1;
        if (groups[k]) {
          groups[k].classList.toggle("is-selected", k === selected);
          groups[k].classList.toggle("is-preview", k === shown && k !== selected);
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
      if (groups[k]) groups[k].classList.toggle("is-hover", on);
      tabs[k].classList.toggle("is-hover", on);
    };
    tabs.forEach(function (t, k) {
      t.addEventListener("click", function () { select(k, false); });
      t.addEventListener("focus", function () { if (groups[k]) groups[k].classList.add("is-focus"); });
      t.addEventListener("blur", function () { if (groups[k]) groups[k].classList.remove("is-focus"); });
      var targets = [t];
      var hit = groups[k] && groups[k].querySelector(".hit");
      if (hit) {
        targets.push(hit);
        hit.addEventListener("click", function () { t.click(); });
      }
      targets.forEach(function (el) {
        el.addEventListener("pointerenter", function (e) {
          setHover(k, true);
          if (!canHover || e.pointerType === "touch") return;
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(function () { shown = k; paint(); }, 150);
        });
        el.addEventListener("pointerleave", function () { setHover(k, false); clearTimeout(hoverTimer); });
      });
    });
    box.querySelector('[role="tablist"]').addEventListener("keydown", function (e) {
      var k = tabs.indexOf(document.activeElement), n = tabs.length;
      if (k < 0) return;
      var to = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (k + 1) % n;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (k - 1 + n) % n;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = n - 1;
      if (to === null) return;
      e.preventDefault();
      select(to, true);
    });
    box.addEventListener("pointerleave", restore);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") restore(); });
    paint();
  });

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
     close, so PR B's text editing can key it. ---------- */
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
    };
    dialog.addEventListener("close", function () {
      if (borrowed && home) { borrowed.hidden = true; home.parentNode.replaceChild(borrowed, home); }
      borrowed = home = null;
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      if (opener) opener.focus();
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); }); // backdrop
    dialog.querySelector(".bio-close").addEventListener("click", function () { dialog.close(); });
    document.querySelectorAll("button.person").forEach(function (card) {
      card.addEventListener("click", function () { openBio(card); });
    });
    var hashCard = /^#team-[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    if (hashCard && hashCard.matches("button.person")) openBio(hashCard);
  }
})();
