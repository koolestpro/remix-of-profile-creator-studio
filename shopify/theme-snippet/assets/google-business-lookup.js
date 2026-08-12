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
  var DEBOUNCE_MS = 300;

  if (!PROXY) {
    console.warn("[business-lookup] No lookup endpoint configured — disabled.");
    return;
  }

  /** Someone pasting a URL already knows their link; don't search for it. */
  function looksLikeUrl(v) {
    return /^https?:\/\//i.test(v) || /(google\.[a-z.]+|goo\.gl|maps\.app)/i.test(v);
  }

  function attach(input) {
    if (input.dataset.gblBound === "1") return;
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

    function close() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      results = [];
      active = -1;
    }

    function choose(i) {
      var r = results[i];
      if (!r) return;
      input.value = r.name + " — " + r.reviewUrl;
      close();
      hint.hidden = false;
      hint.textContent = "✓ " + r.name + (r.address ? ", " + r.address : "");
      hint.className = "gbl-hint gbl-hint--ok";
      // The theme watches these to unlock its add-to-cart button.
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function highlight(i) {
      var items = list.querySelectorAll(".gbl-item");
      for (var n = 0; n < items.length; n++) {
        items[n].classList.toggle("is-active", n === i);
        items[n].setAttribute("aria-selected", n === i ? "true" : "false");
      }
      active = i;
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
      results.forEach(function (r, i) {
        var li = document.createElement("li");
        li.className = "gbl-item";
        li.setAttribute("role", "option");
        li.id = list.id + "-o" + i;

        var n = document.createElement("span");
        n.className = "gbl-item-name";
        n.textContent = r.name;
        var a = document.createElement("span");
        a.className = "gbl-item-addr";
        a.textContent = r.address;
        li.appendChild(n);
        li.appendChild(a);

        // mousedown beats blur, which would close the list first
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          choose(i);
        });
        list.appendChild(li);
      });
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function search(q) {
      if (controller) controller.abort();
      controller = new AbortController();
      hint.hidden = false;
      hint.className = "gbl-hint";
      hint.textContent = "Searching Google…";

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
          results = d.results || [];
          render();
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
      if (q.length < MIN_CHARS || looksLikeUrl(q)) {
        close();
        hint.hidden = true;
        return;
      }
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

    input.addEventListener("blur", function () {
      setTimeout(close, 150);
    });
  }

  function scan() {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) attach(nodes[i]);
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
