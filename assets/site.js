/* Dharma Gates — prototype
   Injects the shared header/footer, drives the design and navigation switcher, the hero video,
   and keeps the Retreat Guru embed honest about whether it loaded. No build step, no dependencies. */
(function () {
  var page = document.body.getAttribute("data-page") || "";
  var root = document.documentElement;
  var isPreview = !!document.querySelector('meta[name="dg-preview"]');
  var params = new URLSearchParams(location.search);
  function load(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  // ?design=, ?nav= and ?clip= pick a starting point once; drop them from the address bar so a reload
  // keeps whatever the viewer switches to afterwards
  if (/[?&](design|nav|clip)=/.test(location.search) && history.replaceState) {
    var keep = new URLSearchParams(location.search);
    ["design", "nav", "clip"].forEach(function (k) { keep.delete(k); });
    var rest = keep.toString();
    try { history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) {}
  }

  /* ---------- The logo's one swappable spot ----------
     Placeholder until DG's logo is final. To swap it, set LOGO to an <img> (or inline SVG), e.g.
     '<img src="assets/img/logo.svg" alt="">', and the header picks it up on every page. */
  var LOGO = "";

  /* ---------- Navigation variants (the thing to show Lyndsey + Aaron) ---------- */
  var NAV_A = [ // Minimalist: five items + Donate
    ["retreats.html", "Retreats & Events"],
    ["monastic-advising.html", "Monastic Advising"],
    ["about.html", "About"],
    ["connect.html", "Connect"]
  ];
  var NAV_B = [ // Maximalist: same spine, two dropdowns
    ["retreats.html", "Retreats & Events"],
    ["monastic-advising.html", "Monastic Advising"],
    ["about.html", "About", [
      ["about.html#team", "Our Team"],
      ["about.html#impact", "Our Impact"],
      ["about.html#stories", "Participant Stories"],
      ["about.html#values", "Dana, Ethics & Inclusion"],
      ["about.html#work", "Work With Us"]
    ]],
    ["more.html", "Resources", [
      ["index.html#faq", "FAQ"],
      ["more.html#places", "Places to Meditate"],
      ["connect.html#podcast", "Podcast"],
      ["more.html#press", "Press & Grants"],
      ["more.html#blog", "Blog"]
    ]],
    ["connect.html", "Connect"]
  ];

  /* ---------- Design versions: each maps a palette onto the nine color slots in site.css ---------- */
  var DESIGNS = [
    ["v1", "1 · Earth", "Lyndsey's starter palette"],
    ["v2", "2 · Blue", "Blue and white with an ink-like navy"],
    ["v3", "3 · Ink", "Wildcard: black ink with one vermilion accent"],
    ["v4", "4 · Textured", "Earth colors with photo backgrounds on alternating blocks"]
  ];
  var SLOTS = [ // [token, label] — the nine slots Lyndsey and the team can change live on a call
    ["--paper", "Page background"],
    ["--paper-2", "Alternate blocks"],
    ["--ink", "Main text, dark blocks"],
    ["--accent-ink", "Section labels"],
    ["--muted", "Secondary text"],
    ["--accent", "Buttons"],
    ["--sage", "Links and tags"],
    ["--sage-soft", "Links and tags: light shade"],
    ["--line", "Lines"],
    ["--on-dark-label", "Labels on dark blocks"]
  ];
  var CLIPS = [["trail", "Trail"], ["shrine", "Shrine"], ["bowing", "Bowing"], ["still", "Still"]];
  var PAGE_NAMES = {
    "index.html": "Home", "retreats.html": "Retreats & Events", "monastic-advising.html": "Monastic Advising",
    "about.html": "About", "donate.html": "Donate", "connect.html": "Connect", "more.html": "Everything else"
  };

  function li(item) {
    var cur = item[0].split("#")[0] === page ? ' aria-current="page"' : "";
    var html = '<li' + (item[2] ? ' class="has-menu"' : "") + '><a href="' + item[0] + '"' + cur + ">" + item[1] + "</a>";
    if (item[2]) {
      html += "<ul>" + item[2].map(function (s) { return '<li><a href="' + s[0] + '">' + s[1] + "</a></li>"; }).join("") + "</ul>";
    }
    return html + "</li>";
  }
  function navList(items, cls) {
    return '<ul class="' + cls + '">' + items.map(li).join("") +
      '<li><a class="btn" href="donate.html">Donate</a></li></ul>';
  }
  function buttons(list, attr) {
    return list.map(function (d) { return '<button type="button" ' + attr + '="' + d[0] + '"' + (d[2] ? ' title="' + d[2] + '"' : "") + ">" + d[1] + "</button>"; }).join("");
  }

  // The preview banner (with its feedback link) is on every page by design; the prototype's own banner stays
  // hidden for the rest of the visit once hidden.
  var bannerHidden = false;
  try { bannerHidden = !isPreview && sessionStorage.getItem("dg-bar") === "hidden"; } catch (e) {}
  var banner = bannerHidden ? "" : isPreview
    ? '<div class="proto-bar preview-bar" id="proto-bar"><span><b>Preview: not the live site.</b><span class="wide-only"> Compare the four designs with the switcher at the bottom right.</span></span>' +
      '<a id="feedback-link" href="mailto:anid.laoui@gmail.com">Send feedback on this page</a>' +
      '<button type="button" onclick="document.getElementById(\'proto-bar\').remove()">hide</button></div>'
    : '<div class="proto-bar" id="proto-bar"><span><b>Skeleton prototype</b> — structure & real copy from the current site; colors, photos and video are a draft. Use the switcher (bottom-right) to compare design versions and navigation A vs B.</span>' +
      '<button type="button" onclick="document.getElementById(\'proto-bar\').remove();try{sessionStorage.setItem(\'dg-bar\',\'hidden\')}catch(e){}">hide</button></div>';

  var header = banner +
    '<header class="site"><div class="wrap nav-row">' +
    '<a class="brand" href="index.html"><span class="logo-slot" aria-hidden="true" title="Logo placeholder">' + LOGO + "</span>Dharma Gates</a>" +
    '<button class="menu-toggle" aria-label="Menu" aria-expanded="false" onclick="var n=document.getElementById(\'primary-nav\');n.classList.toggle(\'open\');this.setAttribute(\'aria-expanded\',n.classList.contains(\'open\'))">☰</button>' +
    '<nav class="primary" id="primary-nav" aria-label="Main">' + navList(NAV_A, "nav-a") + navList(NAV_B, "nav-b") + "</nav>" +
    "</div></header>";

  var hasHeroVideo = !!document.querySelector(".hero-video");
  var switcher =
    '<div class="switcher" id="switcher"><button type="button" class="sw-toggle" aria-expanded="false" aria-controls="sw-panel">Compare designs ▴</button>' +
    '<div class="sw-panel" id="sw-panel">' +
    '<div class="sw-row" role="group" aria-label="Design version"><span>Design</span>' + buttons(DESIGNS, "data-design") + "</div>" +
    '<div class="sw-row" role="group" aria-label="Navigation variant"><span>Nav</span><button type="button" data-v="a">A · Minimal</button><button type="button" data-v="b">B · Fuller</button></div>' +
    (hasHeroVideo ? '<div class="sw-row" role="group" aria-label="Hero video clip"><span>Video</span>' + buttons(CLIPS, "data-clip") + "</div>" : "") +
    '<details><summary>Edit colors live</summary><div class="sw-colors">' +
    SLOTS.map(function (s) { return '<label for="c' + s[0] + '">' + s[1] + '</label><input type="color" id="c' + s[0] + '" data-token="' + s[0] + '">'; }).join("") +
    '</div><div class="sw-actions"><button type="button" data-colors="copy">Copy hex codes</button><button type="button" data-colors="reset">Reset</button></div><div class="sw-msg" aria-live="polite"></div></details>' +
    "</div></div>";

  var footer =
    '<footer class="site"><div class="wrap"><div class="grid">' +
    '<div><h4>Dharma Gates</h4><p>Opening pathways into deep meditation practice for young adults (18–35).</p>' +
    '<p>Stay in touch — the newsletter goes out twice a month <span class="todo">confirm frequency</span></p>' +
    '<form onsubmit="event.preventDefault();alert(\'Prototype: this will post to Mailchimp.\')"><input type="email" placeholder="you@example.com" aria-label="Email"><button class="btn" type="submit">Subscribe</button></form></div>' +
    '<div><h4>Explore</h4><ul><li><a href="retreats.html">Retreats & Events</a></li><li><a href="monastic-advising.html">Monastic Advising</a></li><li><a href="about.html">About</a></li><li><a href="index.html#faq">FAQ</a></li><li><a href="more.html">Everything else</a></li></ul></div>' +
    '<div><h4>Connect</h4><ul><li><a href="https://substack.com/@dharmagates" rel="noopener">Substack</a></li><li><a href="connect.html#podcast">Podcast</a></li><li><a href="#" title="URL needed">Instagram</a></li><li><a href="#" title="URL needed">Facebook</a></li><li><a href="https://www.youtube.com" rel="noopener" title="playlist URL needed">YouTube</a></li></ul></div>' +
    '<div><h4>Contact</h4><ul><li>Programs: <a href="mailto:offerings@dharma-gates.org">offerings@dharma-gates.org</a></li><li>Everything else: <a href="mailto:team@dharma-gates.org">team@dharma-gates.org</a></li><li>242 Main Street #363<br>Beacon, NY 12508</li></ul></div>' +
    '</div><div class="fine">Dharma Gates, Inc. · EIN 84-4831330 · A registered 501(c)(3) nonprofit. Donations are tax-deductible to the extent allowed by law. · <a href="about.html#values">Ethics & Safety</a> · <a href="about.html#values">Inclusion</a></div></div></footer>' +
    switcher;

  document.body.insertAdjacentHTML("afterbegin", header);
  document.body.insertAdjacentHTML("beforeend", footer);

  var sw = document.getElementById("switcher");
  var swToggle = sw.querySelector(".sw-toggle");
  function setOpen(open) {
    sw.classList.toggle("open", open);
    document.body.classList.toggle("sw-open", open);
    swToggle.setAttribute("aria-expanded", open);
    swToggle.textContent = swToggle.textContent.replace(/[▴▾]$/, open ? "▾" : "▴");
  }
  swToggle.addEventListener("click", function () {
    setOpen(!sw.classList.contains("open"));
    save("dg-switcher", sw.classList.contains("open") ? "open" : "folded");
  });

  /* ---------- Design versions (remembered per browser; ?design=v2 in a link picks one) ---------- */
  function isDesign(d) { return DESIGNS.some(function (x) { return x[0] === d; }); }
  var design = params.get("design");
  if (!isDesign(design)) design = load("dg-design", "v1");
  if (!isDesign(design)) design = "v1";
  function setDesign(d) {
    design = d;
    root.setAttribute("data-design", d);
    sw.querySelectorAll("[data-design]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-design") === d); });
    var name = DESIGNS.filter(function (x) { return x[0] === d; })[0][1];
    swToggle.textContent = "Design: " + name.replace(/^\d · /, "") + (sw.classList.contains("open") ? " ▾" : " ▴");
    save("dg-design", d);
    msg.textContent = "";
    applyColorEdits();
    updateFeedbackLink();
  }
  sw.querySelectorAll("[data-design]").forEach(function (b) {
    b.addEventListener("click", function () { setDesign(b.getAttribute("data-design")); });
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

  /* ---------- Live color editing: change any of the nine slots on a call, then copy the codes ---------- */
  var inputs = sw.querySelectorAll("input[data-token]");
  var msg = sw.querySelector(".sw-msg");
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
  setDesign(design);
  // open on wide screens, folded into one small button on phones and tablets; after that, as the viewer last left it
  var swState = load("dg-switcher", "");
  setOpen(swState ? swState === "open" : window.matchMedia("(min-width: 1200px)").matches);

  /* ---------- Hero video: a muted ~5s loop over a still photo ----------
     Loads only after the page has finished loading, never under reduced motion or Save-Data,
     uses a small portrait cut on phones, and pauses when scrolled away. */
  var hero = document.querySelector(".hero.bleed");
  var hv = document.querySelector(".hero-video");
  if (hero && hv) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    var toggle = hero.querySelector(".video-toggle");
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
        if (e && e.name === "NotAllowedError") { userPaused = true; if (toggle) toggle.textContent = "Play video"; }
      });
    };
    if (reduce || saveData) {
      var row = sw.querySelector('[aria-label="Hero video clip"]');
      if (row) row.insertAdjacentHTML("beforeend", '<small class="sw-note">Off: this device asks for ' + (reduce ? "reduced motion" : "less data") + ".</small>");
    }
    var setClip = function (c) {
      clip = c;
      save("dg-clip", c);
      sw.querySelectorAll("[data-clip]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-clip") === c); });
      if (!started) return;
      hv.pause();
      hv.classList.remove("playing");
      if (c === "still" || reduce || saveData) {
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
      b.addEventListener("click", function () { userPaused = false; if (toggle) toggle.textContent = "Pause video"; setClip(b.getAttribute("data-clip")); });
    });
    if (toggle) toggle.addEventListener("click", function () {
      userPaused = !userPaused;
      toggle.textContent = userPaused ? "Play video" : "Pause video";
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

  /* ---------- YouTube slot for the full fundraiser video ----------
     Set data-youtube-id on .video-slot once Lyndsey uploads it; the player loads only when clicked. */
  document.querySelectorAll(".video-slot").forEach(function (slot) {
    var id = slot.getAttribute("data-youtube-id");
    var play = slot.querySelector("button.play");
    if (!play) return;
    if (!id) { play.disabled = true; return; }
    play.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0";
      f.setAttribute("title", slot.getAttribute("data-title") || "Video");
      f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
      f.setAttribute("allowfullscreen", "");
      slot.innerHTML = "";
      slot.appendChild(f);
      f.focus(); // keyboard focus moves to the player instead of falling back to the top of the page
    });
  });

  /* ---------- Impact counters: count up when scrolled into view ---------- */
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var run = function (el) {
      var end = parseInt(el.getAttribute("data-count"), 10), suffix = el.getAttribute("data-suffix") || "";
      if (reduceMotion || !("requestAnimationFrame" in window)) { el.textContent = end.toLocaleString() + suffix; return; }
      var t0 = null, dur = 1400;
      var step = function (t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased).toLocaleString() + (p === 1 ? suffix : "");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.4 });
      counters.forEach(function (c) { io.observe(c); });
    } else { counters.forEach(run); }
  }

  /* ---------- Testimonial carousel: one at a time, "1 of N" ---------- */
  document.querySelectorAll("[data-carousel]").forEach(function (car) {
    var slides = car.querySelectorAll(".slide"), i = 0, counter = car.querySelector("[data-counter]");
    var show = function (n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle("on", k === i); });
      if (counter) counter.textContent = (i + 1) + " of " + slides.length;
    };
    var prev = car.querySelector("[data-prev]"), next = car.querySelector("[data-next]");
    if (prev) prev.addEventListener("click", function () { show(i - 1); });
    if (next) next.addEventListener("click", function () { show(i + 1); });
    car.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
    show(0);
  });

  /* ---------- Retreat Guru embed: load on approach, then a watchdog ---------- */
  // rbg-connect.min.js (~330 KB, plus eight Google fonts it requests) loads only when its section comes within
  // ~800px of the screen, after the page's inline rbgOptions exist. It renders into .rbg-list (the Retreats page,
  // classSelector mode) or .rbg-table (the homepage). If no programs show 8s after loading starts (offline, opened
  // as file://, blocked, the Retreat Guru API failing or empty, or the subdomain wrong), show the direct link too.
  var rg = document.querySelector(".rbg-list") || document.querySelector(".rbg-table");
  var rgFrame = document.querySelector(".rg-frame[data-rbg-src]");
  var PROGRAM = "tbody tr, .rs-event-wrapper"; // one per program, in table and list views
  var RG_SITE = "https://dharma-gates.secure.retreat.guru";
  if (rg && rgFrame) {
    rg.classList.add("pending");
    // Without the embed's hash router (it breaks the page's own #anchors), its "#/event/<id>/<slug>" links would
    // lead nowhere, so point each program at its page on Retreat Guru instead.
    if ("MutationObserver" in window) {
      new MutationObserver(function () {
        rg.querySelectorAll('a[href^="#/event/"]').forEach(function (a) {
          var slug = a.getAttribute("href").split("/")[3];
          if (slug) a.setAttribute("href", RG_SITE + "/program/" + encodeURIComponent(slug) + "/");
        });
      }).observe(rg, { childList: true, subtree: true });
    }
    var startEmbed = function () {
      var s = document.createElement("script");
      s.src = rgFrame.getAttribute("data-rbg-src");
      s.async = true;
      document.body.appendChild(s);
      watch();
    };
    var whenNear = function () {
      if (!("IntersectionObserver" in window)) { startEmbed(); return; }
      var near = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { near.disconnect(); startEmbed(); }
      }, { rootMargin: "800px 0px" });
      near.observe(rgFrame);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", whenNear); else whenNear();
  }
  function watch() {
    setTimeout(function () {
      rg.classList.remove("pending");
      if (rg.querySelector(PROGRAM)) return;
      // the embed may already have drawn an empty frame (table header, heading), so add the note below it
      rgFrame.insertAdjacentHTML("beforeend", isPreview
        ? '<p class="note rg-fallback"><b>Upcoming retreats load here from Retreat Guru.</b> If they don\'t appear, see them all at <a href="https://dharma-gates.secure.retreat.guru/" rel="noopener">dharma-gates.secure.retreat.guru</a>.</p>'
        : '<p class="note rg-fallback"><b>Retreat Guru list didn\'t load.</b> This happens when the page is opened as a local file, offline, when the Retreat Guru API fails or has no programs, or before the embed is configured. ' +
          'Serve the folder over http (see prototype/README.md) or use the direct link: <a href="https://dharma-gates.secure.retreat.guru/" rel="noopener">dharma-gates.secure.retreat.guru</a>.</p>');
    }, 8000);
  }
})();
