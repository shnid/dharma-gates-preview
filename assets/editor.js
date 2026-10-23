/* Dharma Gates — prototype: the editing tools for Lyndsey (round 2 PR B, docs/round2/BRIEF.md §4).
   site.js loads this file only when someone turns on "Edit this page", opens "Edit fonts live" or uses a My edits
   button, so visitors never download it. Everything is saved in this browser, in "my edits" (dg-edits-v1), and goes
   to Anid as one file ("Save my edits"); tools/apply_edits.py turns that file into a reviewable change.
   Rules kept throughout: nothing from an edit or a loaded file is ever rendered as markup (textContent only); DG
   notes are never editable and never saved; the tools use the system font and a fixed neutral look. */
(function () {
  var S = window.dgSite;
  if (!S || window.dgEditor) return;
  var root = document.documentElement, sw = S.sw;
  var CATALOG_JSON = "assets/data/google-fonts.json";
  var EDITOR_CSS = "assets/editor.css";
  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = EDITOR_CSS;
  document.head.appendChild(css);

  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (attrs[k] === true) n.setAttribute(k, "");
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function button(label, attrs, onClick) {
    var b = el("button", Object.assign({ type: "button" }, attrs || {}), label);
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function nowISO() { return new Date().toISOString(); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  var MARKUP = /<\/?[a-z!][^>]*>/i;            // a value that looks like HTML is refused, never rendered
  var NOTE_WORDS = /\bDG note\b|Note for DG/i;  // DG notes never become page text (B6)
  var MAX_TEXT = 5000;
  function textProblem(v) {
    if (typeof v !== "string") return "not text";
    if (v.length > MAX_TEXT) return "longer than " + MAX_TEXT + " characters";
    if (MARKUP.test(v)) return "looks like markup (a tag such as <script>)";
    if (NOTE_WORDS.test(v)) return "contains DG-note text";
    return "";
  }

  /* ================= Edit mode (BRIEF B2) ================= */
  var editing = false;
  var FIELD_HOSTS = "button, summary, [role=tab]";  // the browser won't reliably place a caret here: edit in a field
  var MULTILINE = { P: 1, LI: 1, DD: 1, BLOCKQUOTE: 1 };
  var bar = null, pillLayer = null, openedDetails = [];

  function inCard(n) { return n.closest("button.person"); }  // a team card opens its bio; name and role edit there
  function fieldHost(n) { var h = n.closest(FIELD_HOSTS); return h && !inCard(n) ? h : null; }
  function editables() {
    return [].slice.call(document.querySelectorAll("[data-edit]")).filter(function (n) { return !inCard(n); });
  }
  function keyOf(n) { return n.getAttribute("data-edit") || n.getAttribute("data-edit-proxy"); }

  function setEditing(on) {
    if (on === editing) { S.setEditingButtons(on); return; }
    editing = on;
    try { sessionStorage.setItem("dg-edit-mode", on ? "on" : "off"); } catch (e) {}
    root.classList.toggle("dg-editing", on);
    S.setEditingButtons(on);
    if (on) {
      buildBar();
      editables().forEach(prepare);
      // every FAQ answer open, so each can be edited; the ones that were closed close again on Done
      openedDetails = [].filter.call(document.querySelectorAll("main details"), function (d) { return !d.open; });
      openedDetails.forEach(function (d) { d.open = true; });
      buildPills();
      showBankNotes();
    } else {
      flushAll();
      editables().forEach(unprepare);
      document.querySelectorAll("[data-edit-proxy]").forEach(unprepare);
      openedDetails.forEach(function (d) { d.open = false; });
      openedDetails = [];
      if (bar) { bar.remove(); bar = null; }
      if (pillLayer) { pillLayer.remove(); pillLayer = null; }
      closeDrawer();
      closeField(true);
      document.querySelectorAll(".dg-bank-note").forEach(function (n) { n.remove(); });
      root.style.removeProperty("--edit-bar-h");
    }
  }

  function prepare(n) {
    n.querySelectorAll(".dg-note").forEach(function (note) { note.setAttribute("contenteditable", "false"); });
    if (fieldHost(n)) { n.setAttribute("data-dg-field", ""); return; }
    try { n.contentEditable = "plaintext-only"; } catch (e) { n.contentEditable = "true"; }
    if (n.contentEditable !== "plaintext-only") n.contentEditable = "true";
    n.spellcheck = true;
  }
  function unprepare(n) {
    n.removeAttribute("contenteditable");
    n.removeAttribute("data-dg-field");
    n.removeAttribute("spellcheck");
    n.querySelectorAll(".dg-note").forEach(function (note) { note.removeAttribute("contenteditable"); });
    if (n.hasAttribute("data-edit-proxy")) n.removeAttribute("data-edit-proxy");
  }

  // Saving: debounced 400 ms. The value is the element's text with DG notes left out (B2, B6).
  var timers = {};
  function valueOf(n) {
    var v = S.textOf(n, true);
    return MULTILINE[n.tagName] ? v : v.replace(/\n+/g, " ");
  }
  function saveText(key, value) {
    var def = S.textDefaults[key];
    if (def === undefined) return;
    var problem = textProblem(value);
    if (problem) { S.say("Not saved: the text " + problem + ".", true); return; }
    var e = S.readEdits();
    var had = e.text[key];
    if (value === def) {
      if (!had) return;
      delete e.text[key];
    } else {
      if (had && had.value === value) return;
      e.text[key] = { value: value, was: S.shortHash(def), at: nowISO() };
    }
    S.writeEdits(e);
  }
  function queueSave(n) {
    var key = keyOf(n);
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () { delete timers[key]; commit(n); }, 400);
  }
  function commit(n) {
    var key = keyOf(n), value = valueOf(n);
    saveText(key, value);
    var proxyFor = n.getAttribute("data-edit-proxy");
    if (proxyFor) { var real = S.keyed(proxyFor); if (real) S.setText(real, value); }
  }
  function flushAll() {
    Object.keys(timers).forEach(function (k) {
      clearTimeout(timers[k]);
      delete timers[k];
      var n = document.querySelector('[data-edit="' + k + '"]:not([data-dg-field])') || document.querySelector('[data-edit-proxy="' + k + '"]');
      if (n) commit(n);
    });
  }
  window.addEventListener("pagehide", flushAll);

  function editableTarget(t) {
    var n = t && t.closest && t.closest("[data-edit], [data-edit-proxy]");
    return n && n.isContentEditable ? n : null;
  }
  document.addEventListener("focusin", function (e) {
    var n = editing && editableTarget(e.target);
    if (!n || n.dgClean) return;
    // the page source's line breaks aren't text: render the element from its value before typing starts
    var value = S.textOf(n);
    var sel = window.getSelection(), caretAtEnd = sel && sel.rangeCount && n.contains(sel.anchorNode);
    S.setText(n, value);
    n.querySelectorAll(".dg-note").forEach(function (note) { note.setAttribute("contenteditable", "false"); });
    n.dgClean = true;
    n.dgNotes = n.querySelectorAll(".dg-note").length;
    if (caretAtEnd) { var r = document.createRange(); r.selectNodeContents(n); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
  });
  document.addEventListener("focusout", function (e) {
    var n = editing && editableTarget(e.target);
    if (!n) return;
    clearTimeout(timers[keyOf(n)]);
    delete timers[keyOf(n)];
    commit(n);
    S.setText(n, valueOf(n)); // typed line breaks become <br>, the way the page shows them
    n.querySelectorAll(".dg-note").forEach(function (note) { note.setAttribute("contenteditable", "false"); });
    n.dgClean = false;
  });
  document.addEventListener("input", function (e) {
    var n = editing && editableTarget(e.target);
    if (!n) return;
    if (n.querySelectorAll(".dg-note").length < (n.dgNotes || 0)) { document.execCommand("undo"); S.say("DG notes can't be deleted here.", true); return; }
    queueSave(n);
  });
  document.addEventListener("beforeinput", function (e) {
    var n = editing && editableTarget(e.target);
    if (!n) return;
    var t = e.inputType || "";
    if (/^format/.test(t)) { e.preventDefault(); return; }  // no bold or italics: text only
    if ((t === "insertParagraph" || t === "insertLineBreak") && !MULTILINE[n.tagName]) e.preventDefault();
  });
  document.addEventListener("paste", function (e) {
    var n = editing && editableTarget(e.target);
    if (!n) return;
    e.preventDefault(); // plain text only, whatever was copied
    var text = (e.clipboardData || window.clipboardData).getData("text/plain") || "";
    text = text.replace(/\r\n?/g, "\n");
    if (!MULTILINE[n.tagName]) text = text.replace(/\s*\n\s*/g, " ");
    text.split("\n").forEach(function (line, i) { // line breaks, not the <div>s "insertText" makes of them
      if (i) document.execCommand("insertLineBreak");
      if (line) document.execCommand("insertText", false, line);
    });
  });
  document.addEventListener("drop", function (e) { if (editing && editableTarget(e.target)) e.preventDefault(); });
  document.addEventListener("keydown", function (e) {
    var n = editing && editableTarget(e.target);
    if (!n || e.key !== "Enter") return;
    e.preventDefault();
    // a line break, not the new <div> Chromium and Safari make for "\n" (B2: Enter stores \n in paragraphs)
    if (MULTILINE[n.tagName] && !e.isComposing) document.execCommand("insertLineBreak");
  });

  // Clicks in edit mode: links don't navigate, labels don't jump to their field, and a keyed label inside a button,
  // FAQ question or pillar tab opens a small field instead of toggling, switching or submitting (B2). Header and
  // footer links still move between pages; edits are saved first.
  document.addEventListener("click", function (e) {
    if (!editing || inTools(e.target)) return;
    var t = e.target;
    var keyedEl = t.closest && t.closest("[data-edit]");
    var host = keyedEl && fieldHost(keyedEl);
    if (host) {
      e.preventDefault();
      e.stopPropagation();
      openField(keyedEl);
      return;
    }
    var a = t.closest && t.closest("a[href]");
    if (a && a.closest("main, dialog")) { e.preventDefault(); return; }
    if (t.closest && t.closest("main label") && keyedEl) e.preventDefault();
    if (a) flushAll();
  }, true);
  document.addEventListener("keydown", function (e) {
    if (!editing || inTools(e.target) || (e.key !== "Enter" && e.key !== " ")) return;
    var host = e.target.closest && e.target.closest(FIELD_HOSTS);
    if (!host || inCard(host)) return;
    var keyedEl = host.matches("[data-edit]") ? host : host.querySelector("[data-edit]");
    if (!keyedEl) return;
    e.preventDefault();
    e.stopPropagation();
    openField(keyedEl);
  }, true);
  document.addEventListener("submit", function (e) { if (editing) e.preventDefault(); }, true);
  function inTools(t) { return !!(t && t.closest && t.closest(".switcher, .dg-tool")); }

  // The small field for labels the browser won't let you type into directly
  var field = null;
  function openField(n) {
    closeField(false);
    var r = n.getBoundingClientRect();
    var wrap = el("div", { class: "dg-tool dg-field", role: "group", "aria-label": "Edit this label" });
    var input = el("input", { type: "text", "aria-label": "Text", maxlength: String(MAX_TEXT) });
    input.value = S.textOf(n);
    var ok = button("Done", { class: "dg-btn dg-primary" });
    var cancel = button("Cancel", { class: "dg-btn" });
    wrap.appendChild(input); wrap.appendChild(ok); wrap.appendChild(cancel);
    wrap.style.left = Math.max(8, r.left + window.scrollX) + "px";
    wrap.style.top = (r.bottom + window.scrollY + 6) + "px";
    wrap.style.minWidth = Math.min(520, Math.max(260, r.width)) + "px";
    (n.closest("dialog[open]") || document.body).appendChild(wrap);
    field = { wrap: wrap, el: n };
    var done = function () {
      var v = S.normalize(input.value).replace(/\n+/g, " ");
      var problem = textProblem(v);
      if (problem) { S.say("Not saved: the text " + problem + ".", true); return; }
      if (v) { S.setText(n, v); saveText(n.getAttribute("data-edit"), v); }
      closeField(true);
    };
    ok.addEventListener("click", done);
    cancel.addEventListener("click", function () { closeField(true); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); done(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeField(true); }
    });
    input.focus();
    input.select();
  }
  function closeField(refocus) {
    if (!field) return;
    var n = field.el;
    field.wrap.remove();
    field = null;
    var host = fieldHost(n) || n;
    if (refocus && host && host.focus) host.focus();
  }

  // Team bios: the dialog's name and role stand in for the card's (B2: "a team card still opens its bio")
  document.addEventListener("dg:bio-open", function (e) {
    if (!editing) return;
    var d = document.getElementById("bio-dialog"), slug = e.detail.slug;
    var pairs = [[d.querySelector("#bio-name"), "about.team." + slug + ".name"], [d.querySelector(".bio-role"), "about.team." + slug + ".role"]];
    pairs.forEach(function (p) {
      if (!p[0] || S.textDefaults[p[1]] === undefined) return;
      p[0].setAttribute("data-edit-proxy", p[1]);
      prepare(p[0]);
    });
    d.querySelectorAll(".bio-text [data-edit]").forEach(prepare);
  });

  /* ---------- The edit bar ---------- */
  function buildBar() {
    bar = el("div", { class: "dg-tool dg-bar", role: "region", "aria-label": "Editing" });
    var line = el("p", { class: "dg-bar-line" });
    line.appendChild(el("b", null, "Editing: "));
    line.appendChild(document.createTextNode("your changes save in this browser · "));
    var count = el("span", { class: "dg-bar-count" });
    line.appendChild(count);
    bar.appendChild(line);
    var acts = el("div", { class: "dg-bar-acts" });
    acts.appendChild(button("Save my edits", { class: "dg-btn dg-primary" }, function () { myEdits("save"); }));
    acts.appendChild(button("Done", { class: "dg-btn" }, function () { setEditing(false); }));
    bar.appendChild(acts);
    bar.appendChild(el("p", { class: "dg-bar-safari" }, "Safari deletes these edits after 7 days without a visit; the saved file is your backup."));
    document.body.insertBefore(bar, document.body.firstChild);
    var upd = function () {
      var n = S.unsavedCount();
      count.textContent = n + (n === 1 ? " change" : " changes") + " not saved to a file";
      count.classList.toggle("dg-warn", n > 0);
    };
    upd();
    S.onEdits(function () { if (bar) upd(); });
    var setH = function () { if (bar) root.style.setProperty("--edit-bar-h", bar.offsetHeight + "px"); };
    setH();
    if ("ResizeObserver" in window) new ResizeObserver(setH).observe(bar);
  }

  /* ================= Photos (BRIEF B4) ================= */
  var manifest = null;
  function getManifest() {
    return S.loadJSON(S.PHOTOS_JSON).then(function (m) { manifest = obj(m); manifest.photos = arr(manifest.photos); return manifest; });
  }
  function photoById(id) { return manifest && manifest.photos.filter(function (p) { return p.id === id; })[0]; }
  var BAND_TEXTURE = { "bg-forest": "texture-forest", "bg-garden": "texture-temple", "bg-hall": "texture-hall" };
  function slotLabel(slot) {
    var id = slot.getAttribute("data-photo-slot");
    var kind = slot.getAttribute("data-photo-kind");
    var sec = slot.closest("section"), h = sec && sec.querySelector("h1, h2");
    var where = h ? S.textOf(h) : id;
    if (kind === "background") return "Band background: " + where;
    if (kind === "portrait") { var nm = slot.closest(".person"); return "Team photo: " + (nm ? S.textOf(nm.querySelector(".name")) : id); }
    if (/\.poster$/.test(id)) return "Video poster: " + where;
    return "Photo: " + where;
  }
  function defaultPhotoId(slot) {
    var d = S.slotDefaults[slot.getAttribute("data-photo-slot")] || {};
    if (slot.getAttribute("data-photo-kind") === "background") {
      var c = [].filter.call(slot.classList, function (x) { return BAND_TEXTURE[x]; })[0];
      return c ? BAND_TEXTURE[c] : null;
    }
    if (!d.src || !manifest) return null;
    var hit = manifest.photos.filter(function (p) { return S.sizesOf(p).some(function (s) { return s.src === d.src; }); })[0];
    return hit ? hit.id : null;
  }
  function currentPick(slot) {
    var p = obj(S.readEdits().photos[slot.getAttribute("data-photo-slot")]);
    return p.photo ? p : null;
  }
  function slotVisible(slot) {
    var r = slot.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) return false;
    for (var n = slot; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
    }
    return true;
  }

  // "Change photo" and "Edit testimonials" pills sit in a layer over the page (a button can't go inside the team
  // cards, which are buttons themselves); they follow their slots on every layout change.
  var pills = [];
  function buildPills() {
    pillLayer = el("div", { class: "dg-tool dg-pills" });
    document.body.appendChild(pillLayer);
    pills = [];
    document.querySelectorAll("[data-photo-slot]").forEach(function (slot) {
      var b = button("Change photo", { class: "dg-pill", "data-for": slot.getAttribute("data-photo-slot"), "aria-label": "Change photo: " + slotLabel(slot).replace(/^[^:]+: /, "") });
      b.addEventListener("click", function () { openPhotoDrawer(slot, b); });
      pillLayer.appendChild(b);
      pills.push({ btn: b, target: slot, under: !!slot.closest(".hero.bleed") });
    });
    S.carousels.forEach(function (c) {
      var place = c.el.getAttribute("data-placement");
      if (!place) return;
      var band = c.el.closest("section") || c.el;
      var b = button("Edit testimonials", { class: "dg-pill" });
      b.addEventListener("click", function () { openBankDrawer(place, b); });
      pillLayer.appendChild(b);
      pills.push({ btn: b, target: band, left: true });
    });
    placePills();
  }
  var placing = false;
  function placePills() {
    if (placing || !pillLayer) return;
    placing = true;
    requestAnimationFrame(function () {
      placing = false;
      pills.forEach(function (p) {
        var vis = p.target.isConnected && (p.target.hasAttribute("data-photo-slot") ? slotVisible(p.target) : p.target.getBoundingClientRect().height > 0);
        p.btn.hidden = !vis;
        if (!vis) return;
        var r = p.target.getBoundingClientRect(), x = window.scrollX, y = window.scrollY;
        var w = p.btn.offsetWidth || 120;
        var header = document.querySelector("header.site");
        var top = r.top + 10 + (p.under && header ? header.offsetHeight : 0); // the home hero sits under the header
        var left = p.left ? r.left + 10 : r.right - w - 10;
        p.btn.style.top = Math.round(top + y) + "px";
        p.btn.style.left = Math.round(Math.max(4, left) + x) + "px";
      });
    });
  }
  ["resize", "click", "keyup", "transitionend", "toggle", "load"].forEach(function (ev) { window.addEventListener(ev, placePills, true); });
  if ("ResizeObserver" in window) new ResizeObserver(placePills).observe(document.body);
  S.onEdits(placePills);

  // The drawer: one side panel for the photo picker and the testimonial bank (a bottom sheet on phones)
  var drawer = null, drawerReturn = null;
  function openDrawer(title, returnTo) {
    closeDrawer();
    drawerReturn = returnTo || null;
    drawer = el("aside", { class: "dg-tool dg-drawer", role: "dialog", "aria-label": title });
    var head = el("div", { class: "dg-drawer-head" });
    var h = el("h2", { class: "dg-drawer-title", tabindex: "-1" }, title);
    head.appendChild(h);
    head.appendChild(button("Close", { class: "dg-btn" }, closeDrawer));
    drawer.appendChild(head);
    var body = el("div", { class: "dg-drawer-body" });
    drawer.appendChild(body);
    document.body.appendChild(drawer);
    root.classList.add("dg-drawer-open");
    h.focus();
    return body;
  }
  // Esc closes the drawer wherever the focus is (a re-drawn photo grid can drop it to the page), unless a field,
  // the font popover or the switcher has it
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !drawer || field || document.querySelector(".dg-pop")) return;
    if (e.target.closest && e.target.closest(".switcher")) return;
    e.preventDefault();
    closeDrawer();
  });
  function closeDrawer() {
    if (!drawer) return;
    drawer.remove();
    drawer = null;
    root.classList.remove("dg-drawer-open");
    if (drawerReturn && drawerReturn.isConnected) drawerReturn.focus();
    drawerReturn = null;
  }

  function aspectOf(slot, which) {
    var a = slot.getAttribute("data-aspect-" + which);
    var m = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(a || "");
    if (m) return +m[1] / +m[2];
    var r = slot.getBoundingClientRect();
    return r.height ? r.width / r.height : 4 / 3;
  }
  function savePick(slot, pick) {
    var e = S.readEdits(), id = slot.getAttribute("data-photo-slot");
    if (pick) e.photos[id] = pick; else delete e.photos[id];
    S.writeEdits(e);
    return S.applyPhotoEdits();
  }
  function openPhotoDrawer(slot, from) {
    var body = openDrawer("Change photo", from);
    body.appendChild(el("p", { class: "dg-muted" }, slotLabel(slot)));
    var status = el("p", { class: "dg-status", "aria-live": "polite" });
    body.appendChild(status);
    getManifest().then(function () { photoStep(slot, body, status); }, function () {
      status.textContent = "The photo library couldn't load. Open the preview from its link (not from a file on disk) to change photos.";
    });
  }
  function photoStep(slot, body, status) {
    var kind = slot.getAttribute("data-photo-kind") || "inline";
    if (kind === "background") {
      var d = S.design();
      body.appendChild(el("p", { class: "dg-hint" }, "Visible in designs 4 and 5." + (d === "v4" || d === "v5" ? "" : " Switch to design 4 or 5 to see it.")));
    }
    if (slot.hasAttribute("data-photo-missing")) {
      body.appendChild(el("p", { class: "dg-warn" }, "The photo picked for this spot is no longer in the library, so the page's own photo shows."));
    }
    var missing = S.missingPhotos().length;
    if (missing > 1 || (missing === 1 && !slot.hasAttribute("data-photo-missing"))) {
      body.appendChild(el("p", { class: "dg-muted" }, missing + (missing === 1 ? " photo" : " photos") + " you picked elsewhere " + (missing === 1 ? "is" : "are") + " no longer in the library."));
    }
    var pick = currentPick(slot), currentId = pick ? pick.photo : defaultPhotoId(slot);
    // filters: orientation, then tags
    var filt = { o: "all", tag: "" };
    var chips = el("div", { class: "dg-chips", role: "group", "aria-label": "Show" });
    [["all", "All"], ["landscape", "Landscape"], ["portrait", "Portrait"], ["panorama", "Wide"]].forEach(function (o) {
      var b = button(o[1], { class: "dg-chip", "aria-pressed": o[0] === "all" ? "true" : "false" }, function () {
        filt.o = o[0];
        chips.querySelectorAll(".dg-chip").forEach(function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
        drawGrid();
      });
      chips.appendChild(b);
    });
    body.appendChild(chips);
    var tags = {};
    manifest.photos.forEach(function (p) { arr(p.tags).forEach(function (t) { tags[t] = 1; }); });
    var tagSel = el("select", { "aria-label": "Tag" });
    tagSel.appendChild(el("option", { value: "" }, "Any tag"));
    Object.keys(tags).sort().forEach(function (t) { tagSel.appendChild(el("option", { value: t }, t)); });
    tagSel.addEventListener("change", function () { filt.tag = tagSel.value; drawGrid(); });
    var tagRow = el("label", { class: "dg-inline" }, "Tag ");
    tagRow.appendChild(tagSel);
    body.appendChild(tagRow);
    var grid = el("div", { class: "dg-grid", role: "list" });
    body.appendChild(grid);
    var framing = el("div", { class: "dg-framing" });
    body.appendChild(framing);
    function drawGrid() {
      grid.textContent = "";
      manifest.photos.filter(function (p) {
        return (filt.o === "all" || p.orientation === filt.o) && (!filt.tag || arr(p.tags).indexOf(filt.tag) > -1);
      }).forEach(function (p) {
        var sizes = S.sizesOf(p);
        if (!sizes.length) return;
        var cell = el("div", { role: "listitem" });
        var b = button(null, { class: "dg-thumb", "aria-pressed": p.id === currentId ? "true" : "false", title: p.alt || p.id });
        var img = el("img", { src: sizes[0].src, alt: "", loading: "lazy", width: "160", height: String(Math.round(160 * p.h / p.w)) });
        b.appendChild(img);
        b.appendChild(el("span", { class: "visually-hidden" }, (p.alt || p.id) + (p.id === currentId ? " (current)" : "")));
        b.addEventListener("click", function () {
          currentId = p.id;
          var next = { photo: p.id, focal: { x: p.focal.x, y: p.focal.y }, fit: "cover" };
          savePick(slot, next).then(function () {
            drawGrid();
            drawFraming(p, next);
            status.textContent = "Photo changed. Set the framing below.";
            var again = grid.querySelector('.dg-thumb[aria-pressed="true"]');
            if (again) again.focus();
          });
        });
        cell.appendChild(b);
        grid.appendChild(cell);
      });
    }
    function drawFraming(p, pk) {
      framing.textContent = "";
      if (!p) return;
      framing.appendChild(el("h3", { class: "dg-sub" }, "Framing"));
      framing.appendChild(el("p", { class: "dg-muted" }, "Put the dot on the faces or heads. It stays in frame on every screen. Applies to this spot only."));
      var sizes = S.sizesOf(p), src = (sizes.filter(function (s) { return s.w <= 1280; }).pop() || sizes[0]).src;
      if (p.orientation === "portrait" && aspectOf(slot, "desktop") > 1.2) {
        framing.appendChild(el("p", { class: "dg-warn" }, "This is a portrait photo in a wide spot: much of it will be cropped. Check the previews."));
      }
      var stage = el("div", { class: "dg-stage" });
      var big = el("img", { src: src, alt: "", draggable: "false" });
      var dot = el("button", { type: "button", class: "dg-dot", "aria-label": "Focal point" });
      stage.appendChild(big); stage.appendChild(dot);
      framing.appendChild(stage);
      var nums = el("div", { class: "dg-nums" });
      var xIn = el("input", { type: "number", min: "0", max: "100", step: "1", "aria-label": "Across, percent" });
      var yIn = el("input", { type: "number", min: "0", max: "100", step: "1", "aria-label": "Down, percent" });
      var lx = el("label", null, "Across "); lx.appendChild(xIn); lx.appendChild(document.createTextNode(" %"));
      var ly = el("label", null, "Down "); ly.appendChild(yIn); ly.appendChild(document.createTextNode(" %"));
      nums.appendChild(lx); nums.appendChild(ly);
      framing.appendChild(nums);
      var previews = el("div", { class: "dg-previews" });
      var mk = function (label, ratio) {
        var f = el("figure", { class: "dg-preview" });
        var box = el("div", { class: "dg-preview-box" });
        box.style.setProperty("--r", String(Math.round(ratio * 1000) / 1000));
        var im = el("img", { src: src, alt: "" });
        box.appendChild(im);
        f.appendChild(box);
        f.appendChild(el("figcaption", null, label));
        previews.appendChild(f);
        return im;
      };
      var pd = mk("Desktop", aspectOf(slot, "desktop")), pp = mk("Phone", aspectOf(slot, "phone"));
      framing.appendChild(previews);
      var whole = el("input", { type: "checkbox", id: "dg-whole" });
      var wl = el("label", { class: "dg-inline", for: "dg-whole" });
      wl.appendChild(whole); wl.appendChild(document.createTextNode(" Show whole photo (no crop)"));
      framing.appendChild(wl);
      var acts = el("div", { class: "dg-acts" });
      acts.appendChild(button("Reset to the page's photo", { class: "dg-btn" }, function () {
        savePick(slot, null).then(function () { currentId = defaultPhotoId(slot); drawGrid(); framing.textContent = ""; status.textContent = "Back to the page's own photo."; });
      }));
      acts.appendChild(button("Done", { class: "dg-btn dg-primary" }, closeDrawer));
      framing.appendChild(acts);
      var state = { x: pk.focal.x, y: pk.focal.y, fit: pk.fit === "contain" ? "contain" : "cover" };
      var saveT = null;
      var paint = function (persist) {
        state.x = Math.min(1, Math.max(0, state.x)); state.y = Math.min(1, Math.max(0, state.y));
        var pos = S.pctPos(state);
        dot.style.left = state.x * 100 + "%";
        dot.style.top = state.y * 100 + "%";
        dot.setAttribute("aria-valuetext", Math.round(state.x * 100) + "% across, " + Math.round(state.y * 100) + "% down");
        dot.title = "Focal point: " + dot.getAttribute("aria-valuetext") + ". Arrow keys move it.";
        xIn.value = Math.round(state.x * 100); yIn.value = Math.round(state.y * 100);
        [pd, pp].forEach(function (im) { im.style.objectPosition = pos; im.style.objectFit = state.fit; });
        whole.checked = state.fit === "contain";
        if (persist) {
          clearTimeout(saveT);
          saveT = setTimeout(function () {
            savePick(slot, { photo: p.id, focal: { x: Math.round(state.x * 1000) / 1000, y: Math.round(state.y * 1000) / 1000 }, fit: state.fit });
          }, 150);
        }
      };
      var fromPointer = function (e) {
        var r = big.getBoundingClientRect();
        state.x = (e.clientX - r.left) / r.width;
        state.y = (e.clientY - r.top) / r.height;
        paint(true);
      };
      var dragging = false;
      stage.addEventListener("pointerdown", function (e) { dragging = true; stage.setPointerCapture(e.pointerId); fromPointer(e); e.preventDefault(); });
      stage.addEventListener("pointermove", function (e) { if (dragging) fromPointer(e); });
      stage.addEventListener("pointerup", function () { dragging = false; });
      dot.addEventListener("keydown", function (e) {
        var step = e.shiftKey ? 0.1 : 0.01, moved = true;
        if (e.key === "ArrowLeft") state.x -= step; else if (e.key === "ArrowRight") state.x += step;
        else if (e.key === "ArrowUp") state.y -= step; else if (e.key === "ArrowDown") state.y += step;
        else moved = false;
        if (moved) { e.preventDefault(); paint(true); }
      });
      xIn.addEventListener("change", function () { state.x = (+xIn.value || 0) / 100; paint(true); });
      yIn.addEventListener("change", function () { state.y = (+yIn.value || 0) / 100; paint(true); });
      whole.addEventListener("change", function () { state.fit = whole.checked ? "contain" : "cover"; paint(true); });
      paint(false);
    }
    drawGrid();
    if (pick && photoById(pick.photo)) drawFraming(photoById(pick.photo), pick);
  }

  /* ================= Testimonial bank (BRIEF B5) ================= */
  var PLACE_NAMES = { home: "Home", advising: "Monastic Advising" };
  function overlay(e) {
    var o = e.testimonials = obj(e.testimonials);
    ["edit", "order"].forEach(function (k) { o[k] = obj(o[k]); });
    ["add", "hide", "show", "remove"].forEach(function (k) { o[k] = arr(o[k]); });
    var seed = S.bankSeed();
    if (o.baseRev === undefined && seed) o.baseRev = seed.rev;
    return o;
  }
  function tidy(o) {
    ["edit", "order"].forEach(function (k) { if (!Object.keys(o[k]).length) delete o[k]; });
    ["add", "hide", "show", "remove"].forEach(function (k) { if (!o[k].length) delete o[k]; });
  }
  function seedItem(id) { return arr(obj(S.bankSeed()).items).filter(function (t) { return t.id === id; })[0]; }
  function bankWrite(e) {
    var o = e.testimonials;
    tidy(o);
    if (Object.keys(o).filter(function (k) { return k !== "baseRev"; }).length === 0) delete e.testimonials;
    S.writeEdits(e);
    S.renderBank();
    showBankNotes();
  }
  function showBankNotes() {
    document.querySelectorAll(".dg-bank-note").forEach(function (n) { n.remove(); });
    if (!editing) return;
    S.carousels.forEach(function (c) {
      var band = c.el.closest("section");
      if (band && band.hasAttribute("data-bank-empty")) {
        c.el.parentNode.insertBefore(el("p", { class: "dg-note dg-bank-note", contenteditable: "false" }, "No quotes are shown here, so visitors don't see this band. Show one in Edit testimonials."), c.el);
      }
    });
  }
  function openBankDrawer(placement, from) {
    var body = openDrawer("Edit testimonials: " + PLACE_NAMES[placement], from);
    if (!S.bankSeed()) {
      body.appendChild(el("p", { class: "dg-status" }, "The testimonial bank couldn't load. Open the preview from its link (not from a file on disk) to edit testimonials."));
      return;
    }
    drawBank(body, placement);
  }
  function drawBank(body, placement, focusId) {
    body.textContent = "";
    var e = S.readEdits(), o = obj(e.testimonials), seed = S.bankSeed();
    var items = S.bankFor(S.mergeBank(seed, o), placement, S.bankOrder(o));
    var shown = items.filter(function (t) { return t.status === "show"; }).length;
    body.appendChild(el("p", { class: "dg-muted" }, shown + " shown of " + items.length + " quotes for " + PLACE_NAMES[placement] + ". Quotes from DG's bank can be hidden, not deleted."));
    if (shown > 7) body.appendChild(el("p", { class: "dg-hint" }, "Five to seven quotes read best. You can still show as many as you like."));
    // seconds per quote: Auto is R5's formula
    var secs = el("select", { id: "dg-secs" });
    [["auto", "Auto (5–15 s, by length)"], ["2", "2 s"], ["4", "4 s"], ["6", "6 s"], ["8", "8 s"]].forEach(function (s) { secs.appendChild(el("option", { value: s[0] }, s[1])); });
    var cur = o.secondsPerQuote !== undefined ? String(o.secondsPerQuote) : String(seed.secondsPerQuote || "auto");
    secs.value = cur;
    secs.addEventListener("change", function () {
      var e2 = S.readEdits(), ov = overlay(e2), v = secs.value === "auto" ? "auto" : +secs.value;
      if (v === (seed.secondsPerQuote || "auto")) delete ov.secondsPerQuote; else ov.secondsPerQuote = v;
      bankWrite(e2);
    });
    var sl = el("label", { class: "dg-inline", for: "dg-secs" }, "Seconds per quote ");
    sl.appendChild(secs);
    body.appendChild(sl);
    body.appendChild(el("p", { class: "dg-muted" }, "Applies to every carousel. Pause, and pausing on hover or focus, work the same at every setting."));
    var list = el("ol", { class: "dg-bank" });
    items.forEach(function (t, k) {
      var li = el("li", { class: "dg-quote" + (t.status === "show" ? "" : " is-hidden") });
      li.appendChild(el("p", { class: "dg-quote-text" }, t.quote));
      var who = [t.name || "(no name)", t.role].filter(Boolean).join(", ");
      li.appendChild(el("p", { class: "dg-muted" }, who + (t.status === "show" ? "" : " · hidden") + (t.added ? " · added by you" : "")));
      if (t.quote.length > 280) li.appendChild(el("p", { class: "dg-warn" }, "Long: check it on a phone."));
      if (/abbreviated/i.test(t.source)) li.appendChild(el("p", { class: "dg-muted" }, "Shortened from DG's Testimonials page."));
      if (t.consent === "confirm") li.appendChild(el("p", { class: "dg-note" }, "Confirm it's OK to publish this quote."));
      var acts = el("div", { class: "dg-acts" });
      var tog = button(t.status === "show" ? "Hide" : "Show", { class: "dg-btn", "data-id": t.id }, function () { toggleQuote(t); drawBank(body, placement, t.id); });
      acts.appendChild(tog);
      acts.appendChild(button("Up", { class: "dg-btn", disabled: k === 0, "aria-label": "Move up" }, function () { moveQuote(items, k, -1, placement); drawBank(body, placement, t.id); }));
      acts.appendChild(button("Down", { class: "dg-btn", disabled: k === items.length - 1, "aria-label": "Move down" }, function () { moveQuote(items, k, 1, placement); drawBank(body, placement, t.id); }));
      acts.appendChild(button("Edit", { class: "dg-btn" }, function () { quoteForm(li, t, placement, body); }));
      if (t.added) acts.appendChild(button("Delete", { class: "dg-btn dg-danger" }, function () {
        if (!window.confirm("Delete this quote you added?")) return;
        var e2 = S.readEdits(), ov = overlay(e2);
        ov.add = ov.add.filter(function (a) { return obj(a).id !== t.id; });
        Object.keys(ov.order).forEach(function (p) { ov.order[p] = arr(ov.order[p]).filter(function (id) { return id !== t.id; }); });
        bankWrite(e2);
        drawBank(body, placement);
      }));
      li.appendChild(acts);
      list.appendChild(li);
    });
    var addBtn = button("+ Add a quote", { class: "dg-btn dg-primary" });
    addBtn.addEventListener("click", function () { quoteForm(null, null, placement, body, addBtn); });
    body.appendChild(addBtn);
    body.appendChild(list);
    body.appendChild(button("Reset testimonials", { class: "dg-btn" }, function () {
      if (!window.confirm("Undo every change to the testimonials (shown, hidden, order, edits and quotes you added)?")) return;
      var e2 = S.readEdits();
      delete e2.testimonials;
      S.writeEdits(e2);
      S.renderBank();
      showBankNotes();
      drawBank(body, placement);
    }));
    if (focusId) {
      var b = body.querySelector('[data-id="' + focusId + '"]');
      if (b) b.focus();
    }
  }
  function toggleQuote(t) {
    var e = S.readEdits(), o = overlay(e), next = t.status === "show" ? "hide" : "show";
    if (t.added) {
      o.add.forEach(function (a) { if (obj(a).id === t.id) a.status = next; });
    } else {
      var s0 = obj(seedItem(t.id)).status === "show" ? "show" : "hide";
      o.hide = o.hide.filter(function (id) { return id !== t.id; });
      o.show = o.show.filter(function (id) { return id !== t.id; });
      if (next !== s0) o[next].push(t.id);
    }
    bankWrite(e);
  }
  function moveQuote(items, k, dir, placement) {
    var ids = items.map(function (t) { return t.id; });
    var j = k + dir;
    if (j < 0 || j >= ids.length) return;
    var tmp = ids[k]; ids[k] = ids[j]; ids[j] = tmp;
    var e = S.readEdits(), o = overlay(e);
    o.order[placement] = ids;
    bankWrite(e);
  }
  function quoteForm(li, t, placement, body, anchor) {
    var old = body.querySelector(".dg-qform");
    if (old) old.remove();
    var f = el("form", { class: "dg-qform" });
    var q = el("textarea", { rows: "5", id: "dg-q", maxlength: String(MAX_TEXT) });
    q.value = t ? t.quote : "";
    var nm = el("input", { type: "text", id: "dg-qn", maxlength: "100" });
    nm.value = t ? t.name : "";
    var rl = el("input", { type: "text", id: "dg-qr", maxlength: "100" });
    rl.value = t ? t.role : (placement === "advising" ? "monastic advising participant" : "retreat participant");
    var lab = function (forId, text, input, hint) {
      var w = el("div", { class: "dg-f" });
      w.appendChild(el("label", { for: forId }, text));
      w.appendChild(input);
      if (hint) w.appendChild(el("small", { class: "dg-muted" }, hint));
      f.appendChild(w);
    };
    lab("dg-q", "Quote, word for word", q, "Include the quotation marks you want shown.");
    lab("dg-qn", "Name (first name, or leave blank)", nm);
    lab("dg-qr", "Role", rl);
    var where = el("fieldset", { class: "dg-f" });
    where.appendChild(el("legend", null, "Shows on"));
    var places = t ? t.placements : [placement];
    S.placements.forEach(function (p) {
      var c = el("input", { type: "checkbox", value: p, id: "dg-qp-" + p });
      c.checked = places.indexOf(p) > -1;
      var l = el("label", { class: "dg-inline", for: "dg-qp-" + p });
      l.appendChild(c); l.appendChild(document.createTextNode(" " + PLACE_NAMES[p]));
      where.appendChild(l);
    });
    f.appendChild(where);
    var err = el("p", { class: "dg-warn", "aria-live": "polite" });
    f.appendChild(err);
    var acts = el("div", { class: "dg-acts" });
    acts.appendChild(button(t ? "Save" : "Add", { class: "dg-btn dg-primary", type: "submit" }));
    acts.appendChild(button("Cancel", { class: "dg-btn" }, function () { f.remove(); }));
    if (t && t.seed && obj(obj(obj(S.readEdits().testimonials).edit)[t.id]) && Object.keys(obj(obj(obj(S.readEdits().testimonials).edit)[t.id])).length) {
      acts.appendChild(button("Use DG's text", { class: "dg-btn" }, function () {
        var e = S.readEdits(), o = overlay(e);
        delete o.edit[t.id];
        bankWrite(e);
        drawBank(body, placement, t.id);
      }));
    }
    f.appendChild(acts);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = { quote: S.normalize(q.value), name: S.normalize(nm.value).replace(/\n/g, " "), role: S.normalize(rl.value).replace(/\n/g, " ") };
      v.placements = [].filter.call(where.querySelectorAll("input"), function (c) { return c.checked; }).map(function (c) { return c.value; });
      var problem = !v.quote ? "is empty" : textProblem(v.quote) || textProblem(v.name) || textProblem(v.role);
      if (problem) { err.textContent = "Not saved: the quote " + problem + "."; return; }
      if (!v.placements.length) { err.textContent = "Pick at least one page."; return; }
      var e = S.readEdits(), o = overlay(e);
      if (!t) {
        var id = "local-" + today().replace(/-/g, "") + "-" + (o.add.length + 1);
        while (o.add.some(function (a) { return obj(a).id === id; })) id += "x";
        o.add.push({ id: id, quote: v.quote, name: v.name, role: v.role, placements: v.placements, status: "show", consent: "confirm", source: "added in the preview" + (e.author ? " by " + e.author : "") });
        bankWrite(e);
        drawBank(body, placement, id);
        return;
      }
      if (t.added) {
        o.add.forEach(function (a) { if (obj(a).id === t.id) { a.quote = v.quote; a.name = v.name; a.role = v.role; a.placements = v.placements; } });
      } else {
        var s = seedItem(t.id), diff = {};
        ["quote", "name", "role"].forEach(function (k) { if (v[k] !== (s[k] || "")) diff[k] = v[k]; });
        if (v.placements.join() !== arr(s.placements).join()) diff.placements = v.placements;
        if (Object.keys(diff).length) o.edit[t.id] = diff; else delete o.edit[t.id];
      }
      bankWrite(e);
      drawBank(body, placement, t.id);
    });
    if (li) li.appendChild(f); else anchor.insertAdjacentElement("afterend", f);
    q.focus();
  }

  /* ================= Fonts (BRIEF B3) ================= */
  var ROLE_INFO = { // name, what it covers, then the default family and weight from boot.js
    heading: ["Headings", "Heading (section title)"],
    body: ["Body text", "Body text"],
    quote: ["Quotes", "Quote (testimonial)"],
    number: ["Numbers & dates", "Number (impact numbers and dates)"],
    label: ["Labels & navigation", "Label (navigation, form labels, captions)"],
    button: ["Buttons", "Button"]
  };
  Object.keys(ROLE_INFO).forEach(function (r) {
    var d = arr(obj(S.boot.roleDefaults)[r]);
    ROLE_INFO[r].push(d[0] || "Inter", d[1] || 400);
  });
  var PAIRS = [ // a short static list (B3), serif headings with a sans for text
    ["Fraunces", "Inter", "the preview's own pair"], ["Lora", "Source Sans 3"], ["Playfair Display", "Lato"],
    ["Libre Baskerville", "Work Sans"], ["Cormorant Garamond", "Nunito Sans"], ["EB Garamond", "Karla"],
    ["Spectral", "IBM Plex Sans"], ["DM Serif Display", "DM Sans"]
  ];
  var CATS = [["", "All"], ["serif", "Serif"], ["sans-serif", "Sans"], ["display", "Display"], ["handwriting", "Handwriting"], ["monospace", "Monospace"]];
  var catalog = null, catalogMap = {};
  function getCatalog() {
    return S.loadJSON(CATALOG_JSON).then(function (c) {
      if (!catalog) {
        catalog = arr(obj(c).fonts).map(function (r) { return { family: r[0], category: r[1], weights: arr(r[2]), italic: !!r[3], variable: !!r[4] }; });
        catalog.forEach(function (f) { catalogMap[f.family] = f; });
      }
      return catalog;
    });
  }
  function rolePick(role) {
    var p = obj(S.readEdits().fonts.roles[role]);
    return p.family ? p : { family: ROLE_INFO[role][2], weight: ROLE_INFO[role][3], isDefault: true };
  }
  function nearestWeight(weights, w) {
    return weights.slice().sort(function (a, b) { return Math.abs(a - w) - Math.abs(b - w) || a - b; })[0] || 400;
  }
  function familiesInUse() {
    var f = S.readEdits().fonts, set = {};
    S.roles.forEach(function (r) { set[rolePick(r).family] = 1; });
    Object.keys(f.oneOffs).forEach(function (k) { if (S.keyed(k)) set[obj(f.oneOffs[k]).family] = 1; });
    return Object.keys(set);
  }
  function warnings() {
    var out = [], fams = familiesInUse();
    if (fams.length > 3) out.push("More than 3 font families in use (" + fams.join(", ") + "). Most sites use two.");
    ["body", "label"].forEach(function (r) {
      var c = obj(catalogMap[rolePick(r).family]).category;
      if (c === "handwriting" || c === "display" || c === "monospace") {
        out.push(ROLE_INFO[r][0] + ": " + { handwriting: "a handwriting", display: "a display", monospace: "a monospace" }[c] + " font is hard to read at small sizes.");
      }
    });
    return out;
  }
  // Applies a pick live, then waits for the font: if it can't load within 8 s, the previous font comes back
  function setPick(target, pick, done) {
    var e = S.readEdits(), prev;
    var fam = catalogMap[pick.family];
    if (!fam) return;
    var p = { family: fam.family, weight: nearestWeight(fam.weights, pick.weight), weights: fam.weights.slice() };
    if (target.role) {
      prev = e.fonts.roles[target.role];
      var info = ROLE_INFO[target.role];
      if (p.family === info[2] && p.weight === info[3]) delete e.fonts.roles[target.role]; else e.fonts.roles[target.role] = p;
    } else {
      prev = e.fonts.oneOffs[target.key];
      e.fonts.oneOffs[target.key] = p;
    }
    S.writeEdits(e);
    S.applyFonts();
    var link = S.boot.needsLink && S.boot.needsLink(p) ? document.getElementById("gf-" + p.family.toLowerCase().replace(/ /g, "-")) : null;
    var failed = false;
    var fail = function () {
      if (failed) return;
      failed = true;
      var e2 = S.readEdits();
      if (target.role) { if (prev) e2.fonts.roles[target.role] = prev; else delete e2.fonts.roles[target.role]; }
      else { if (prev) e2.fonts.oneOffs[target.key] = prev; else delete e2.fonts.oneOffs[target.key]; }
      S.writeEdits(e2);
      S.applyFonts();
      done(false, p);
    };
    var timer = setTimeout(fail, 8000);
    var check = function () {
      if (!document.fonts || !document.fonts.load) { clearTimeout(timer); done(true, p); return; }
      document.fonts.load(p.weight + ' 16px "' + p.family + '"').then(function (faces) {
        if (failed) return;
        clearTimeout(timer);
        if (faces && faces.length) done(true, p); else fail();
      }, function () { clearTimeout(timer); fail(); });
    };
    if (link && !link.sheet) {
      link.addEventListener("load", check, { once: true });
      link.addEventListener("error", function () { clearTimeout(timer); fail(); }, { once: true });
    } else check();
  }

  var fontsBox = null;
  function openFonts(box) {
    fontsBox = box;
    box.textContent = "";
    box.appendChild(el("p", { class: "sw-hint" }, "Loading the font list…"));
    getCatalog().then(function () { drawRoles(); }, function () {
      box.textContent = "";
      box.appendChild(el("p", { class: "sw-hint" }, "The font list couldn't load. Open the preview from its link (not from a file on disk) to change fonts."));
    });
  }
  function drawRoles(note) {
    var box = fontsBox;
    box.textContent = "";
    var top = el("div", { class: "sw-edits" });
    top.appendChild(button("Pick on page", { title: "Click any text on the page to change its font" }, startPickOnPage));
    top.appendChild(button("Reset fonts", null, function () {
      var e = S.readEdits();
      e.fonts = { roles: {}, oneOffs: {} };
      S.writeEdits(e);
      S.applyFonts();
      drawRoles("Back to the default fonts.");
    }));
    box.appendChild(top);
    if (note) box.appendChild(el("p", { class: "sw-hint", role: "status" }, note));
    var rows = el("div", { class: "dg-roles" });
    S.roles.forEach(function (r) {
      var p = rolePick(r), row = el("div", { class: "dg-role" });
      var name = el("div", { class: "dg-role-name" });
      name.appendChild(el("b", null, ROLE_INFO[r][0]));
      name.appendChild(el("span", { class: "dg-role-font" }, p.family + " " + p.weight + (p.isDefault ? " (default)" : "")));
      var sample = el("span", { class: "dg-sample", "aria-hidden": "true" }, "Ag");
      sample.style.fontFamily = "var(--role-" + r + ")";
      sample.style.fontWeight = "var(--weight-" + r + ")";
      row.appendChild(sample);
      row.appendChild(name);
      var acts = el("div", { class: "dg-role-acts" });
      acts.appendChild(button("Change", { "aria-label": "Change " + ROLE_INFO[r][0] }, function () { drawPicker({ role: r }); }));
      if (!p.isDefault) acts.appendChild(button("Reset", { "aria-label": "Reset " + ROLE_INFO[r][0] }, function () {
        var e = S.readEdits();
        delete e.fonts.roles[r];
        S.writeEdits(e);
        S.applyFonts();
        drawRoles(ROLE_INFO[r][0] + " back to " + ROLE_INFO[r][2] + ".");
      }));
      row.appendChild(acts);
      rows.appendChild(row);
    });
    box.appendChild(rows);
    var one = S.readEdits().fonts.oneOffs, keys = Object.keys(one).filter(function (k) { return S.keyed(k); });
    if (keys.length) {
      var d = el("div", { class: "dg-oneoffs" });
      d.appendChild(el("b", null, "One-off changes (" + keys.length + ")"));
      keys.forEach(function (k) {
        var r = el("div", { class: "dg-role" });
        r.appendChild(el("span", { class: "dg-role-font" }, "“" + S.textOf(S.keyed(k)).slice(0, 40) + "”: " + one[k].family + " " + one[k].weight));
        r.appendChild(button("Reset", null, function () {
          var e = S.readEdits();
          delete e.fonts.oneOffs[k];
          S.writeEdits(e);
          S.applyFonts();
          drawRoles();
        }));
        d.appendChild(r);
      });
      box.appendChild(d);
    }
    warnings().forEach(function (w) { box.appendChild(el("p", { class: "sw-hint dg-warn" }, w)); });
  }
  function drawPicker(target) {
    var box = fontsBox;
    box.textContent = "";
    var label = target.role ? ROLE_INFO[target.role][0] : "Just this text";
    var start = target.role ? rolePick(target.role) : obj(S.readEdits().fonts.oneOffs[target.key]);
    var undo = target.role ? S.readEdits().fonts.roles[target.role] : S.readEdits().fonts.oneOffs[target.key];
    var head = el("div", { class: "dg-pick-head" });
    head.appendChild(el("b", null, label + ": choose a font"));
    head.appendChild(button("Back", null, function () { drawRoles(); }));
    box.appendChild(head);
    var status = el("p", { class: "sw-hint", "aria-live": "polite" });
    var q = el("input", { type: "search", placeholder: "Search 1,800+ Google fonts", "aria-label": "Search fonts" });
    box.appendChild(q);
    var cat = "";
    var chips = el("div", { class: "sw-opts", role: "group", "aria-label": "Category" });
    CATS.forEach(function (c) {
      var b = button(c[1], { class: c[0] === "" ? "on" : "" }, function () {
        cat = c[0];
        chips.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
        drawList();
      });
      chips.appendChild(b);
    });
    box.appendChild(chips);
    if (target.role) {
      var pairs = el("details", { class: "dg-pairs" });
      pairs.appendChild(el("summary", null, "Suggested pairs"));
      PAIRS.forEach(function (pr) {
        if (!catalogMap[pr[0]] || !catalogMap[pr[1]]) return;
        pairs.appendChild(button(pr[0] + " + " + pr[1] + (pr[2] ? " (" + pr[2] + ")" : ""), { class: "dg-pair" }, function () {
          status.textContent = "Loading " + pr[0] + " and " + pr[1] + "…";
          var pending = 0, bad = [];
          [["heading", pr[0]], ["quote", pr[0]], ["number", pr[0]], ["body", pr[1]], ["label", pr[1]], ["button", pr[1]]].forEach(function (x) {
            pending++;
            setPick({ role: x[0] }, { family: x[1], weight: ROLE_INFO[x[0]][3] }, function (ok, p) {
              if (!ok && bad.indexOf(p.family) < 0) bad.push(p.family);
              if (--pending === 0) {
                status.textContent = bad.length ? bad.join(" and ") + " couldn't load; try another." : pr[0] + " for headings, quotes and numbers; " + pr[1] + " for text, labels and buttons.";
                drawWarn();
              }
            });
          });
        }));
      });
      box.appendChild(pairs);
    }
    var wrow = el("label", { class: "dg-inline" }, "Weight ");
    var wsel = el("select", { "aria-label": "Weight" });
    wrow.appendChild(wsel);
    box.appendChild(wrow);
    var list = el("div", { class: "dg-fontlist", role: "listbox", "aria-label": "Fonts" });
    box.appendChild(list);
    box.appendChild(status);
    var warnBox = el("div");
    box.appendChild(warnBox);
    var acts = el("div", { class: "sw-edits" });
    acts.appendChild(button("Undo", { title: "Back to the font this had when you opened the list" }, function () {
      var e = S.readEdits();
      if (target.role) { if (undo) e.fonts.roles[target.role] = undo; else delete e.fonts.roles[target.role]; }
      else { if (undo) e.fonts.oneOffs[target.key] = undo; else delete e.fonts.oneOffs[target.key]; }
      S.writeEdits(e);
      S.applyFonts();
      current = target.role ? rolePick(target.role) : obj(undo);
      fillWeights();
      drawList();
      status.textContent = "Undone.";
    }));
    acts.appendChild(button("Reset to default", null, function () {
      var e = S.readEdits();
      if (target.role) delete e.fonts.roles[target.role]; else delete e.fonts.oneOffs[target.key];
      S.writeEdits(e);
      S.applyFonts();
      current = target.role ? rolePick(target.role) : {};
      fillWeights();
      drawList();
      status.textContent = target.role ? label + " back to " + ROLE_INFO[target.role][2] + "." : "Back to its role's font.";
    }));
    box.appendChild(acts);
    var current = start;
    function fillWeights() {
      wsel.textContent = "";
      var fam = catalogMap[current.family];
      (fam ? fam.weights : [400]).forEach(function (w) { wsel.appendChild(el("option", { value: String(w) }, String(w))); });
      wsel.value = String(current.weight || 400);
      wsel.disabled = !fam;
    }
    wsel.addEventListener("change", function () {
      if (!current.family) return;
      apply(current.family, +wsel.value);
    });
    function drawWarn() {
      warnBox.textContent = "";
      warnings().forEach(function (w) { warnBox.appendChild(el("p", { class: "sw-hint dg-warn" }, w)); });
    }
    function apply(family, weight) {
      status.textContent = "Loading " + family + "…";
      setPick(target, { family: family, weight: weight }, function (ok, p) {
        status.textContent = ok ? family + " " + p.weight + " applied." : "This font couldn't load; try another.";
        if (ok) current = p;
        fillWeights();
        drawList();
        drawWarn();
      });
      current = { family: family, weight: nearestWeight(catalogMap[family].weights, weight) };
      fillWeights();
      drawList();
    }
    var LIMIT = 200;
    function drawList() {
      list.textContent = "";
      var term = q.value.trim().toLowerCase();
      var hits = catalog.filter(function (f) { return (!cat || f.category === cat) && (!term || f.family.toLowerCase().indexOf(term) > -1); });
      hits.slice(0, LIMIT).forEach(function (f) {
        var b = button(f.family, { class: "dg-font", role: "option", "aria-selected": f.family === current.family ? "true" : "false" }, function () {
          apply(f.family, current.weight || ROLE_INFO[target.role || "body"][3]);
        });
        b.appendChild(el("small", null, " " + { "sans-serif": "sans", serif: "serif", display: "display", handwriting: "handwriting", monospace: "mono" }[f.category]));
        list.appendChild(b);
      });
      if (hits.length > LIMIT) list.appendChild(el("p", { class: "sw-hint" }, "Showing " + LIMIT + " of " + hits.length.toLocaleString("en-US") + ". Type to narrow the list."));
      if (!hits.length) list.appendChild(el("p", { class: "sw-hint" }, "No font by that name. Every Google font is here; check the spelling."));
    }
    q.addEventListener("input", drawList);
    fillWeights();
    drawList();
    drawWarn();
    q.focus();
  }

  // Pick on page: the next click on any text is captured (it doesn't follow links), then "all" or "just this one"
  function roleOf(n) {
    if (n.closest(".stat b, .rg-day")) return "number";
    if (n.closest(".carousel blockquote")) return "quote";
    if (n.closest(".btn, .pillar-name, .carousel .ctrls button")) return "button";
    if (n.closest("nav.primary a, label, .field-label, .rg-month, .carousel figcaption, [data-counter]")) return "label";
    if (n.closest("h1, h2, h3, h4, .brand, .person .name, .initials")) return "heading";
    return "body";
  }
  var picking = null;
  function startPickOnPage() {
    if (picking) return;
    root.classList.add("dg-picking");
    S.say("Click any text on the page to change its font. Esc cancels.");
    var onClick = function (e) {
      if (inTools(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      stopPicking();
      var n = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      choosePickTarget(n, e.clientX, e.clientY);
    };
    var onKey = function (e) { if (e.key === "Escape") { stopPicking(); S.say(""); } };
    picking = { click: onClick, key: onKey };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  }
  function stopPicking() {
    if (!picking) return;
    document.removeEventListener("click", picking.click, true);
    document.removeEventListener("keydown", picking.key, true);
    picking = null;
    root.classList.remove("dg-picking");
  }
  function choosePickTarget(n, x, y) {
    var role = roleOf(n), keyedEl = n.closest("[data-edit]");
    var pop = el("div", { class: "dg-tool dg-pop", role: "dialog", "aria-label": "Change this font" });
    pop.appendChild(el("p", null, ROLE_INFO[role][1]));
    var close = function () { pop.remove(); };
    pop.appendChild(button("Change all " + ROLE_INFO[role][0] + " (recommended)", { class: "dg-btn dg-primary" }, function () {
      close(); openFontsPanel(); drawPicker({ role: role });
    }));
    var one = button("Change just this one", { class: "dg-btn", disabled: !keyedEl }, function () {
      close(); openFontsPanel(); drawPicker({ key: keyedEl.getAttribute("data-edit") });
    });
    pop.appendChild(one);
    if (!keyedEl) pop.appendChild(el("p", { class: "dg-muted" }, "This text can only change with its role."));
    pop.appendChild(button("Cancel", { class: "dg-btn" }, close));
    pop.style.left = Math.min(window.innerWidth - 300, Math.max(8, x)) + window.scrollX + "px";
    pop.style.top = y + window.scrollY + 12 + "px";
    document.body.appendChild(pop);
    pop.querySelector("button").focus();
    pop.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }
  function openFontsPanel() {
    if (!sw.classList.contains("open")) sw.querySelector(".sw-toggle").click();
    var d = sw.querySelector(".sw-fonts-panel");
    if (!d.open) d.open = true;
    fontsBox = sw.querySelector(".sw-fonts");
  }

  /* ================= My edits: save, copy, load, reset (BRIEF B1) ================= */
  var TOP_KEYS = ["schema", "updated", "author", "exportedFrom", "design", "colors", "fonts", "photos", "text", "testimonials", "settings"];
  function exportObject() {
    var e = S.readEdits();
    if (e.author === undefined) {
      var a = window.prompt("Your name, so Anid knows whose edits these are (optional):", "");
      e.author = (a || "").trim().slice(0, 80);
      S.writeEdits(e);
    }
    var out = { schema: "dg-edits/1", updated: e.updated || nowISO(), author: e.author, exportedFrom: location.pathname, design: S.design() };
    ["colors", "fonts", "photos", "text", "testimonials", "settings"].forEach(function (k) { if (e[k]) out[k] = e[k]; });
    return out;
  }
  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: name });
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function saveFile(isBackup) {
    var x = exportObject(), name = "dg-edits-" + today() + (isBackup ? "-backup" : "") + ".json";
    download(name, JSON.stringify(x, null, 2) + "\n");
    if (!isBackup) S.markExported();
    return name;
  }
  // a short inline question under the My edits buttons
  function ask(text, options) {
    return new Promise(function (resolve) {
      var old = sw.querySelector(".dg-ask");
      if (old) old.remove();
      var box = el("div", { class: "dg-ask", role: "group", "aria-label": "Question" });
      box.appendChild(el("p", null, text));
      var acts = el("div", { class: "sw-edits" });
      options.forEach(function (o, k) {
        acts.appendChild(button(o, { class: k === 0 ? "dg-primary" : "" }, function () { box.remove(); resolve(k); }));
      });
      box.appendChild(acts);
      sw.querySelector("[data-unsaved]").insertAdjacentElement("beforebegin", box);
      if (!sw.classList.contains("open")) sw.querySelector(".sw-toggle").click();
      acts.querySelector("button").focus();
    });
  }
  function myEdits(what, from) {
    if (what === "save") { var n = saveFile(false); S.say("Saved " + n + ". Send it to Anid, or attach it to your dated Notion page."); return; }
    if (what === "copy") {
      var text = JSON.stringify(exportObject(), null, 2);
      var ok = function () { S.markExported(); S.say("Copied. Paste it into your dated Notion page or an email to Anid."); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { window.prompt("Copy your edits:", text); ok(); });
      else { window.prompt("Copy your edits:", text); ok(); }
      return;
    }
    if (what === "load") { loadFlow(); return; }
    if (what === "reset") { resetFlow(); return; }
  }
  function withBackup(question) {
    if (!Object.keys(S.flatten(S.readEdits())).length) return Promise.resolve(true);
    return ask(question, ["Download a backup first", "Continue without a backup", "Cancel"]).then(function (k) {
      if (k === 2) return false;
      if (k === 0) saveFile(true);
      return true;
    });
  }
  function loadFlow(file) {
    withBackup("Loading a file replaces the edits in this browser.").then(function (go) {
      if (!go) return;
      if (file) { readFile(file); return; }
      var input = el("input", { type: "file", accept: ".json,application/json" });
      input.style.display = "none";
      input.addEventListener("change", function () { if (input.files[0]) readFile(input.files[0]); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }
  sw.addEventListener("dragover", function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types, "Files") > -1) { e.preventDefault(); sw.classList.add("dg-drop"); } });
  sw.addEventListener("dragleave", function () { sw.classList.remove("dg-drop"); });
  sw.addEventListener("drop", function (e) {
    sw.classList.remove("dg-drop");
    if (!e.dataTransfer || !e.dataTransfer.files[0]) return;
    e.preventDefault();
    loadFlow(e.dataTransfer.files[0]);
  });
  function readFile(file) {
    if (file.size > 2e6) { S.say("That file is too large to be a dg-edits file.", true); return; }
    var r = new FileReader();
    r.onload = function () {
      var data;
      try { data = JSON.parse(String(r.result)); } catch (x) { S.say("That file isn't a dg-edits file (it isn't valid JSON).", true); return; }
      S.say("Checking the file…");
      Promise.all([getCatalog().catch(function () { return null; }), getManifest().catch(function () { return null; }),
        S.loadJSON(S.BANK_JSON).catch(function () { return null; })]).then(function (ctx) {
        var res = validate(data, { catalog: ctx[0] ? catalogMap : null, manifest: ctx[1], seed: ctx[2] });
        if (res.fatal) { S.say(res.fatal, true); return; }
        res.edits.updated = nowISO();
        try { localStorage.setItem("dg-edits-v1", JSON.stringify(res.edits)); } catch (x) { S.say("This browser won't store the edits.", true); return; }
        try { localStorage.setItem("dg-edits-exported", JSON.stringify(S.flatten(res.edits))); } catch (x) {}
        try { sessionStorage.setItem("dg-load-report", JSON.stringify({ name: file.name, skipped: res.skipped, count: Object.keys(S.flatten(res.edits)).length })); } catch (x) {}
        location.reload();
      });
    };
    r.readAsText(file);
  }
  // shown once after the reload that follows Load edits
  (function () {
    var rep;
    try { rep = JSON.parse(sessionStorage.getItem("dg-load-report") || "null"); sessionStorage.removeItem("dg-load-report"); } catch (x) {}
    if (!rep) return;
    var box = el("div", { class: "dg-ask" });
    box.appendChild(el("p", null, "Loaded " + rep.count + (rep.count === 1 ? " change" : " changes") + " from " + rep.name + "." + (rep.skipped.length ? " Skipped " + rep.skipped.length + ":" : "")));
    if (rep.skipped.length) {
      var ul = el("ul", { class: "dg-skipped" });
      rep.skipped.slice(0, 30).forEach(function (s) { ul.appendChild(el("li", null, s)); });
      if (rep.skipped.length > 30) ul.appendChild(el("li", null, "…and " + (rep.skipped.length - 30) + " more"));
      box.appendChild(ul);
    }
    box.appendChild(button("OK", null, function () { box.remove(); }));
    sw.querySelector("[data-unsaved]").insertAdjacentElement("beforebegin", box);
    if (!sw.classList.contains("open")) sw.querySelector(".sw-toggle").click();
  })();

  function resetFlow() {
    var opts = ["Reset text on this page", "Reset fonts", "Reset photos", "Reset testimonials", "Reset colors", "Reset site settings", "Reset everything…", "Cancel"];
    ask("What should go back to the page's own version?", opts).then(function (k) {
      var e = S.readEdits();
      if (k === 0) {
        var n = 0;
        Object.keys(e.text).forEach(function (key) {
          var node = S.keyed(key);
          if (!node) return;
          S.setText(node, S.textDefaults[key]);
          delete e.text[key];
          n++;
        });
        S.writeEdits(e);
        S.say(n ? "Text on this page is back to the page's own (" + n + (n === 1 ? " change" : " changes") + " removed)." : "No text edits on this page.");
      } else if (k === 1) { e.fonts = { roles: {}, oneOffs: {} }; S.writeEdits(e); S.applyFonts(); if (fontsBox) drawRoles(); S.say("Fonts are back to the defaults."); }
      else if (k === 2) { e.photos = {}; S.writeEdits(e); S.applyPhotoEdits(); S.say("Photos are back to the page's own."); }
      else if (k === 3) { delete e.testimonials; S.writeEdits(e); S.renderBank(); showBankNotes(); S.say("Testimonials are back to DG's bank."); }
      else if (k === 4) { e.colors = {}; S.writeEdits(e); S.applyColorEdits(); S.say("Colors are back to each version's own, in all five designs."); }
      else if (k === 5) { e.settings = {}; S.writeEdits(e); S.refreshSwitches(); S.say("Site settings are back to their defaults."); }
      else if (k === 6) {
        withBackup("Reset everything removes all your edits in this browser: text on every page, fonts, photos, testimonials, colors and settings.").then(function (go) {
          if (!go) return;
          ask("Reset everything? This can't be undone.", ["Reset everything", "Cancel"]).then(function (c) {
            if (c !== 0) return;
            try { localStorage.removeItem("dg-edits-v1"); localStorage.removeItem("dg-edits-exported"); } catch (x) {}
            location.reload();
          });
        });
      }
    });
  }

  /* ---------- Load edits: the file is untrusted (BRIEF B1, research/13 §6). Valid parts load; everything else is
     skipped and listed; nothing is ever rendered as markup. ---------- */
  var HEX = /^#[0-9a-f]{6}$/i, KEY = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/, ID = /^[a-z0-9][a-z0-9-]{0,80}$/i;
  var SETTING_VALUES = { impactPage: ["off", "on"], missionVariant: ["text", "photo"] };
  function validate(data, ctx) {
    var skipped = [], out = { schema: "dg-edits/1", colors: {}, fonts: { roles: {}, oneOffs: {} }, photos: {}, text: {}, testimonials: {}, settings: {} };
    data = obj(data);
    if (data.schema !== "dg-edits/1") return { fatal: "That file isn't a dg-edits/1 file, so nothing was loaded." };
    Object.keys(data).forEach(function (k) { if (TOP_KEYS.indexOf(k) < 0) skipped.push("unknown part “" + k.slice(0, 40) + "”"); });
    if (typeof data.author === "string") out.author = data.author.slice(0, 80);
    // colors
    var tokens = S.slots.map(function (s) { return s[0]; });
    Object.keys(obj(data.colors)).forEach(function (v) {
      if (!/^v[1-5]$/.test(v)) { skipped.push("colors for unknown design “" + v.slice(0, 20) + "”"); return; }
      Object.keys(obj(data.colors[v])).forEach(function (t) {
        var val = data.colors[v][t];
        if (tokens.indexOf(t) < 0) skipped.push("color " + v + " " + t.slice(0, 30) + ": not a color slot");
        else if (typeof val !== "string" || !HEX.test(val)) skipped.push("color " + v + " " + t + ": not a #rrggbb color");
        else (out.colors[v] = out.colors[v] || {})[t] = val.toLowerCase();
      });
    });
    // fonts
    var fonts = obj(data.fonts);
    var checkFont = function (label, p) {
      p = obj(p);
      if (!ctx.catalog) { skipped.push(label + ": the font list couldn't load to check it"); return null; }
      var fam = ctx.catalog[p.family];
      if (!fam) { skipped.push(label + ": “" + String(p.family).slice(0, 40) + "” isn't in the font list"); return null; }
      if (fam.weights.indexOf(p.weight) < 0) { skipped.push(label + ": " + fam.family + " has no weight " + String(p.weight).slice(0, 6)); return null; }
      return { family: fam.family, weight: p.weight, weights: fam.weights.slice() };
    };
    Object.keys(obj(fonts.roles)).forEach(function (r) {
      if (S.roles.indexOf(r) < 0) { skipped.push("font role “" + r.slice(0, 20) + "”: not a role"); return; }
      var p = checkFont("font for " + r, fonts.roles[r]);
      if (p) out.fonts.roles[r] = p;
    });
    Object.keys(obj(fonts.oneOffs)).forEach(function (k) {
      if (!KEY.test(k)) { skipped.push("one-off font: bad key"); return; }
      var p = checkFont("one-off font " + k, fonts.oneOffs[k]);
      if (p) out.fonts.oneOffs[k] = p;
    });
    // photos
    Object.keys(obj(data.photos)).forEach(function (slot) {
      var p = obj(data.photos[slot]), f = obj(p.focal);
      if (!KEY.test(slot)) { skipped.push("photo: bad spot name"); return; }
      if (!ctx.manifest) { skipped.push("photo " + slot + ": the photo library couldn't load to check it"); return; }
      if (!arr(ctx.manifest.photos).some(function (x) { return x.id === p.photo; })) { skipped.push("photo " + slot + ": “" + String(p.photo).slice(0, 40) + "” isn't in the library"); return; }
      if (typeof f.x !== "number" || typeof f.y !== "number" || f.x < 0 || f.x > 1 || f.y < 0 || f.y > 1) { skipped.push("photo " + slot + ": focal point outside the photo"); return; }
      if (p.fit !== undefined && p.fit !== "cover" && p.fit !== "contain") { skipped.push("photo " + slot + ": fit must be cover or contain"); return; }
      out.photos[slot] = { photo: p.photo, focal: { x: f.x, y: f.y }, fit: p.fit === "contain" ? "contain" : "cover" };
    });
    // text
    Object.keys(obj(data.text)).forEach(function (k) {
      var t = obj(data.text[k]);
      if (!KEY.test(k)) { skipped.push("text: bad key"); return; }
      var problem = textProblem(t.value);
      if (problem) { skipped.push("text " + k + ": " + problem); return; }
      out.text[k] = { value: t.value, was: typeof t.was === "string" && /^[0-9a-f]{8}$/.test(t.was) ? t.was : "", at: typeof t.at === "string" ? t.at.slice(0, 40) : "" };
    });
    // testimonials
    var tm = obj(data.testimonials), o = {}, seedIds = ctx.seed ? arr(ctx.seed.items).map(function (t) { return t.id; }) : null;
    if (Object.keys(tm).length) {
      if (!seedIds) skipped.push("testimonials: the bank couldn't load to check them");
      else {
        if (typeof tm.baseRev === "number") o.baseRev = tm.baseRev;
        var addIds = [];
        var cleanQuote = function (label, a, needId) {
          a = obj(a);
          var x = {};
          if (needId) {
            if (typeof a.id !== "string" || !/^local-[a-z0-9-]{1,40}$/i.test(a.id)) { skipped.push(label + ": bad id"); return null; }
            x.id = a.id;
          }
          var bad = "";
          ["quote", "name", "role"].forEach(function (f) {
            if (a[f] === undefined) return;
            var p = textProblem(a[f]);
            if (p) bad = f + " " + p; else x[f] = a[f];
          });
          if (bad) { skipped.push(label + ": " + bad); return null; }
          if (a.placements !== undefined) {
            if (!Array.isArray(a.placements) || a.placements.some(function (p) { return S.placements.indexOf(p) < 0; })) { skipped.push(label + ": unknown page"); return null; }
            x.placements = a.placements.slice();
          }
          if (needId) {
            if (!x.quote) { skipped.push(label + ": no quote"); return null; }
            x.status = a.status === "hide" ? "hide" : "show";
            x.consent = "confirm";
            x.source = typeof a.source === "string" && !textProblem(a.source) ? a.source.slice(0, 200) : "added in the preview";
            if (!x.placements) x.placements = ["home"];
          }
          return x;
        };
        arr(tm.add).forEach(function (a, k) { var x = cleanQuote("added quote " + (k + 1), a, true); if (x) { (o.add = o.add || []).push(x); addIds.push(x.id); } });
        Object.keys(obj(tm.edit)).forEach(function (id) {
          if (seedIds.indexOf(id) < 0) { skipped.push("testimonial edit " + id.slice(0, 40) + ": not in the bank"); return; }
          var x = cleanQuote("testimonial " + id, tm.edit[id], false);
          if (x && Object.keys(x).length) (o.edit = o.edit || {})[id] = x;
        });
        ["hide", "show", "remove"].forEach(function (k) {
          arr(tm[k]).forEach(function (id) {
            if (typeof id === "string" && seedIds.indexOf(id) > -1) (o[k] = o[k] || []).push(id);
            else skipped.push("testimonials " + k + ": unknown quote " + String(id).slice(0, 40));
          });
        });
        Object.keys(obj(tm.order)).forEach(function (p) {
          if (S.placements.indexOf(p) < 0) { skipped.push("testimonial order for unknown page " + p.slice(0, 20)); return; }
          var ids = arr(tm.order[p]).filter(function (id) { return typeof id === "string" && (seedIds.indexOf(id) > -1 || addIds.indexOf(id) > -1); });
          (o.order = o.order || {})[p] = ids;
        });
        if (tm.secondsPerQuote !== undefined) {
          if (tm.secondsPerQuote === "auto" || [2, 4, 6, 8].indexOf(tm.secondsPerQuote) > -1) o.secondsPerQuote = tm.secondsPerQuote;
          else skipped.push("seconds per quote: must be Auto, 2, 4, 6 or 8");
        }
        Object.keys(tm).forEach(function (k) {
          if (["baseRev", "edit", "add", "hide", "show", "remove", "order", "secondsPerQuote"].indexOf(k) < 0) skipped.push("testimonials: unknown part “" + k.slice(0, 30) + "”");
        });
      }
    }
    if (Object.keys(o).length) out.testimonials = o; else delete out.testimonials;
    // settings
    Object.keys(obj(data.settings)).forEach(function (k) {
      var v = data.settings[k];
      if (!SETTING_VALUES[k]) skipped.push("setting “" + k.slice(0, 30) + "”: unknown");
      else if (SETTING_VALUES[k].indexOf(v) < 0) skipped.push("setting " + k + ": must be " + SETTING_VALUES[k].join(" or "));
      else if (v !== S.settings[k]) out.settings[k] = v;
    });
    return { edits: out, skipped: skipped };
  }

  window.dgEditor = { setEditing: setEditing, myEdits: myEdits, openFonts: openFonts, validate: validate };
})();
