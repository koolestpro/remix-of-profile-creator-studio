/**
 * Google Business lookup for the store's existing "Add Google Details" step.
 *
 * The theme already renders profile rows (snippets/general-input.liquid and
 * bundle-builder.liquid), each with a `.detail-input` where the customer is
 * asked for "your Google review link or business name". Their own code reads
 * those values into Profile N line item properties and gates add-to-cart on
 * them being filled.
 *
 * This attaches a live business search to those inputs. Rather than adding a
 * competing field, it fills the existing one, so the theme's validation and
 * cart logic keep working untouched.
 *
 * On selection the input becomes:
 *     Business Name — https://search.google.com/local/writereview?placeid=…
 *
 * one string carrying both the human-readable name and the actionable review
 * URL, which is exactly what lands in the Profile N property on the order.
 *
 * No API key here — lookups go to the proxy, which holds the key server-side.
 */
(function () {
  "use strict";

  var config = window.TapAndRateBusinessLookup || {};
  var PROXY = (config.proxyUrl || "").replace(/\/$/, "");
  var COUNTRY = (config.country || "").trim();
  var MIN_CHARS = Number(config.minChars) || 3;
  var SELECTOR = config.selector || ".detail-input";
  // Short: the prefix cache below means most keystrokes repaint instantly from
  // memory, so the network call is a background correction rather than the
  // thing the customer is waiting on.
  var DEBOUNCE_MS = 140;

  /**
   * Results keyed by the query that produced them, shared across every row on
   * the page. Typing one more character usually needs no network at all — we
   * narrow the previous result set locally, which is what makes it feel like
   * the whole of Google is already loaded.
   */
  var CACHE = Object.create(null);

  function cachedFor(q) {
    if (CACHE[q]) return CACHE[q];
    // Fall back to the longest prefix we've already fetched and filter it.
    for (var len = q.length - 1; len >= MIN_CHARS; len--) {
      var prev = CACHE[q.slice(0, len)];
      if (prev) {
        var needle = q.toLowerCase();
        return prev.filter(function (r) {
          return (r.name + " " + r.address).toLowerCase().indexOf(needle) !== -1;
        });
      }
    }
    return null;
  }

  if (!PROXY) {
    console.warn("[business-lookup] No lookup endpoint configured — disabled.");
    return;
  }

  /** Someone pasting a URL already knows their link; don't search for it. */
  function looksLikeUrl(v) {
    return /^https?:\/\//i.test(v) || /(google\.[a-z.]+|goo\.gl|maps\.app)/i.test(v);
  }

  /* ---------------------------------------------------------------
   * Manual mode
   *
   * "add it manually here" and "Can't Find Your Listing?" both switch the
   * panel over to pasting a review link. While it's on, the field is no longer
   * a search box, so no lookups fire.
   * ------------------------------------------------------------- */
  function panelOf(el) {
    return el.closest ? el.closest(".tr-panel") : null;
  }

  /**
   * Whether business search applies to this particular field.
   *
   * Two very different cases:
   *
   *  - Single-product pages: the whole panel is Google or it isn't, decided in
   *    Liquid and published as data-tr-search.
   *
   *  - Bundle pages: each slot has its own "Product Type" dropdown, so one row
   *    may be Google and the next Trustpilot. The answer therefore depends on
   *    what's selected in *this* slot right now, and changes as they switch.
   */
  function searchAllowedFor(input) {
    // Bundle slot: decided by the product type chosen in this row.
    var slot = input.closest(".bb-slot, .bundle-card");
    if (slot) {
      var sel = slot.querySelector(".bb-select");
      if (!sel) return false;
      var opt = sel.options[sel.selectedIndex];
      var label = (opt && (opt.dataset.title || opt.textContent)) || "";
      // Nothing chosen yet, or a non-Google product — no Google lookup.
      return /google/i.test(label);
    }

    // Single-product panel: decided in Liquid and published on the panel.
    var panel = panelOf(input);
    if (panel) return panel.getAttribute("data-tr-search") !== "off";

    // Anything else — a field we don't recognise, in markup we didn't write.
    // Fail closed: never spend Google quota on a field nobody vouched for.
    return false;
  }

  /* Switching product type inside a bundle slot re-decides the question, so
   * any open list has to go and the prompt should match the new choice. */
  document.addEventListener("change", function (e) {
    var sel = e.target.closest ? e.target.closest(".bb-select") : null;
    if (!sel) return;
    var slot = sel.closest(".bb-slot, .bundle-card");
    if (!slot) return;
    var input = slot.querySelector(".detail-input");
    if (!input) return;

    if (input._gblClose) input._gblClose();
    if (input._gblHint) input._gblHint.hidden = true;

    input.placeholder = searchAllowedFor(input)
      ? "Search your business name"
      : "Add URL or business details here";
  });

  function isManual(el) {
    var p = panelOf(el);
    return Boolean(p && p.classList.contains("is-manual"));
  }

  /** Placeholders can't be swapped by CSS, so they're set here. */
  function syncPlaceholders(panel) {
    var manual = panel.classList.contains("is-manual");
    var inputs = panel.querySelectorAll(".detail-input");
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var next = manual ? el.dataset.placeholderManual : el.dataset.placeholderSearch;
      if (next) el.placeholder = next;
    }
  }

  /**
   * Switches the panel between searching and manual entry.
   *
   * Each mode keeps its own text, the way the reference design does with its
   * separate `location` and `reviewLink` fields. Searching for a business and
   * then clicking "Can't find your listing?" must present an empty box — not
   * the abandoned search term — and coming back should restore what was there.
   */
  function setManual(panel, on) {
    var inputs = panel.querySelectorAll(".detail-input");

    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];

      if (on) {
        el.dataset.valSearch = el.value;
        el.value = el.dataset.valManual || "";
      } else {
        el.dataset.valManual = el.value;
        el.value = el.dataset.valSearch || "";
      }

      // A leftover "✓ Business, address" confirmation refers to the value we
      // just swapped out, so it has to go with it.
      if (el._gblHint) el._gblHint.hidden = true;
      if (el._gblClose) el._gblClose();

      // Let the theme's add-to-cart validation see the new value, without
      // waking our own search handler.
      el.dataset.gblFilling = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      delete el.dataset.gblFilling;
    }

    panel.classList.toggle("is-manual", on);
    syncPlaceholders(panel);

    var focusTarget = panel.querySelector(".detail-input");
    if (focusTarget) focusTarget.focus();
  }

  document.addEventListener("click", function (e) {
    var on = e.target.closest("[data-tr-manual-on]");
    var toggle = e.target.closest("[data-tr-manual-toggle]");
    if (!on && !toggle) return;
    var panel = panelOf(on || toggle);
    if (!panel) return;
    e.preventDefault();
    setManual(panel, on ? true : !panel.classList.contains("is-manual"));
  });

  function attach(input) {
    if (input.dataset.gblBound === "1") return;

    // Never bind outside the two places we know about — the Step 2 panel and a
    // bundle slot. Bundle rows are still bound even when the row isn't Google,
    // because the shopper can switch product type at any moment; that case is
    // re-checked per keystroke by searchAllowedFor().
    var known = input.closest(".tr-panel, .bb-slot, .bundle-card");
    if (!known) return;

    // Panel-level products that will never search: don't bind at all.
    var panel = input.closest(".tr-panel");
    if (panel && !input.closest(".bb-slot, .bundle-card")) {
      if (panel.getAttribute("data-tr-search") === "off") return;
    }

    input.dataset.gblBound = "1";

    // The theme sets position:relative on .input-group; anchor to that when
    // present so the dropdown lines up with the field.
    var anchor = input.parentElement;
    if (getComputedStyle(anchor).position === "static") {
      anchor.style.position = "relative";
    }

    var list = document.createElement("ul");
    list.className = "gbl-list";
    list.setAttribute("role", "listbox");
    list.id = "gbl-" + Math.random().toString(36).slice(2, 9);
    list.hidden = true;
    input.insertAdjacentElement("afterend", list);

    var hint = document.createElement("div");
    hint.className = "gbl-hint";
    hint.hidden = true;
    input.insertAdjacentElement("afterend", hint);

    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id);

    var timer = null;
    var controller = null;
    var results = [];
    var active = -1;
    // Remembered so refocusing the field can restore the previous list without
    // spending another Google lookup.
    var lastQuery = "";

    // Hides the list but KEEPS the results, so returning to the field can show
    // them again. Clearing them here was why the suggestions never came back.
    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      active = -1;
    }

    // Exposed so the manual-mode toggle can tidy this row up when it swaps the
    // value out from under it.
    input._gblClose = close;
    input._gblHint = hint;

    function choose(i) {
      var r = results[i];
      if (!r) return;
      input.value = r.name + " — " + r.reviewUrl;
      close();
      hint.hidden = false;
      hint.textContent = "✓ " + r.name + (r.address ? ", " + r.address : "");
      hint.className = "gbl-hint gbl-hint--ok";
      // The theme watches these to unlock its add-to-cart button. Flagged as a
      // programmatic fill so our own input handler ignores it — the value now
      // contains a Google URL, and without the flag that handler treats it as
      // "user pasted a link" and immediately hides the confirmation we just set.
      input.dataset.gblFilling = "1";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      delete input.dataset.gblFilling;
    }

    function highlight(i) {
      var items = list.querySelectorAll(".gbl-item");
      for (var n = 0; n < items.length; n++) {
        items[n].classList.toggle("is-active", n === i);
        items[n].setAttribute("aria-selected", n === i ? "true" : "false");
      }
      active = i;
    }

    function reopen() {
      if (results.length && list.children.length) {
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }
    }

    /**
     * Bolds the part of the name the customer actually typed, so scanning a
     * list of near-identical branch names is quick.
     */
    function nameWithMatch(name, query) {
      var frag = document.createDocumentFragment();
      var i = name.toLowerCase().indexOf(query.toLowerCase());
      if (i < 0 || !query) {
        frag.appendChild(document.createTextNode(name));
        return frag;
      }
      frag.appendChild(document.createTextNode(name.slice(0, i)));
      var b = document.createElement("b");
      b.textContent = name.slice(i, i + query.length);
      frag.appendChild(b);
      frag.appendChild(document.createTextNode(name.slice(i + query.length)));
      return frag;
    }

    function pinIcon() {
      var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("viewBox", "0 0 24 24");
      s.setAttribute("class", "gbl-pin");
      s.setAttribute("aria-hidden", "true");
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("fill", "currentColor");
      p.setAttribute(
        "d",
        "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
      );
      s.appendChild(p);
      return s;
    }

    /**
     * "Powered by Google" is required by the Places API terms whenever results
     * are shown outside a Google map. Not optional decoration.
     */
    function attribution() {
      var li = document.createElement("li");
      li.className = "gbl-attrib";
      li.setAttribute("role", "presentation");
      li.textContent = "powered by ";
      var g = document.createElement("span");
      g.className = "gbl-g";
      ["G", "o", "o", "g", "l", "e"].forEach(function (ch, i) {
        var s = document.createElement("span");
        s.textContent = ch;
        s.className = "gbl-g" + i;
        g.appendChild(s);
      });
      li.appendChild(g);
      return li;
    }

    function render() {
      list.innerHTML = "";
      if (!results.length) {
        close();
        hint.hidden = false;
        hint.className = "gbl-hint gbl-hint--warn";
        hint.textContent =
          "We couldn't find that on Google. Type your business name differently, " +
          "or just paste your Google review link.";
        return;
      }
      hint.hidden = true;
      var typed = input.value.trim();
      results.forEach(function (r, i) {
        var li = document.createElement("li");
        li.className = "gbl-item";
        li.setAttribute("role", "option");
        li.id = list.id + "-o" + i;

        li.appendChild(pinIcon());

        var text = document.createElement("span");
        text.className = "gbl-item-text";

        var n = document.createElement("span");
        n.className = "gbl-item-name";
        n.appendChild(nameWithMatch(r.name, typed));

        var a = document.createElement("span");
        a.className = "gbl-item-addr";
        a.textContent = r.address;

        text.appendChild(n);
        text.appendChild(a);
        li.appendChild(text);

        // mousedown beats blur, which would close the list first
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          choose(i);
        });
        list.appendChild(li);
      });
      list.appendChild(attribution());
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function search(q) {
      if (controller) controller.abort();
      controller = new AbortController();
      // Deliberately no "searching…" message. The list already shows the best
      // local guess; announcing the network call only makes it feel slower.

      var body = { query: q };
      if (COUNTRY) body.country = COUNTRY;

      fetch(PROXY + "/api/places/business-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
        .then(function (r) {
          if (!r.ok) throw new Error("Lookup failed (" + r.status + ")");
          return r.json();
        })
        .then(function (d) {
          CACHE[q] = d.results || [];
          lastQuery = q;
          // The customer may have typed on while this was in flight; only
          // repaint if it still matches what's in the box.
          if (input.value.trim() === q) {
            results = CACHE[q];
            render();
          }
        })
        .catch(function (err) {
          if (err.name === "AbortError") return;
          console.error("[business-lookup]", err);
          close();
          // Never block the sale on our lookup being down — they can still
          // type or paste their link by hand.
          hint.hidden = false;
          hint.className = "gbl-hint gbl-hint--warn";
          hint.textContent = "Search unavailable — please paste your Google review link.";
        });
    }

    input.addEventListener("input", function () {
      // Ignore programmatic fills (choose() dispatches input to wake the theme).
      if (input.dataset.gblFilling === "1") return;
      var q = input.value.trim();
      clearTimeout(timer);
      // In manual mode the field is for pasting a link, not searching. Same
      // when this row isn't a Google product at all.
      if (isManual(input) || !searchAllowedFor(input)) {
        close();
        hint.hidden = true;
        return;
      }
      if (q.length < MIN_CHARS || looksLikeUrl(q)) {
        close();
        hint.hidden = true;
        return;
      }

      // Paint immediately from what we already know, so the list moves with
      // every keystroke instead of pausing for the network.
      var instant = cachedFor(q);
      if (instant && instant.length) {
        results = instant;
        hint.hidden = true;
        render();
      }

      // Exact hit already on screen — nothing left to fetch.
      if (CACHE[q]) return;

      timer = setTimeout(function () {
        search(q);
      }, DEBOUNCE_MS);
    });

    input.addEventListener("keydown", function (e) {
      if (list.hidden || !results.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        highlight((active + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlight((active - 1 + results.length) % results.length);
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        choose(active);
      } else if (e.key === "Escape") {
        close();
      }
    });

    // Coming back to the field shows the previous matches again. Re-searching
    // only when the text has actually changed keeps this free.
    input.addEventListener("focus", function () {
      var q = input.value.trim();
      if (isManual(input) || !searchAllowedFor(input) || looksLikeUrl(q) || q.length < MIN_CHARS)
        return;
      if (q === lastQuery) reopen();
      else search(q);
    });

    input.addEventListener("click", function () {
      if (list.hidden) reopen();
    });

    // Deliberately NOT a blur handler. Blur also fires when the browser loses
    // focus — switching to another app closed the list and it never returned.
    // Closing on an outside pointer press is what the customer actually means.
    document.addEventListener("mousedown", function (e) {
      if (e.target === input || list.contains(e.target)) return;
      close();
    });

    // Tabbing away should still close it, but only when focus really moved to
    // another element on the page.
    input.addEventListener("keydown", function (e) {
      if (e.key === "Tab") close();
    });
  }

  function scan() {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) attach(nodes[i]);
    // Rows are cloned from a <template> after the panel may already be in
    // manual mode, so new rows need their placeholder brought into line.
    var panels = document.querySelectorAll(".tr-panel");
    for (var p = 0; p < panels.length; p++) syncPlaceholders(panels[p]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  // Profile rows are cloned from a <template> as the customer adds them, so
  // a one-off scan would only ever catch the first row.
  if (window.MutationObserver) {
    new MutationObserver(function () {
      clearTimeout(scan._t);
      scan._t = setTimeout(scan, 150);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
