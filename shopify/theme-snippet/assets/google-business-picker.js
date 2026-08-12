/**
 * Google Business picker for the product page.
 *
 * The customer types their business name, picks their Google listing, and the
 * choice rides along with the item as Shopify line item properties — so the
 * order arrives already knowing which listing the product is for.
 *
 * No API key here. Lookups go to the proxy endpoint configured in the snippet,
 * which holds the key server-side.
 *
 * Falls back to free-text entry when a listing genuinely can't be found (new
 * businesses often aren't on Google yet), flagged so you know it needs setting
 * up by hand.
 */
(function () {
  "use strict";

  var config = window.TapAndRateBusinessPicker || {};
  var PROXY = (config.proxyUrl || "").replace(/\/$/, "");
  var COUNTRY = (config.country || "").trim();
  var MIN_CHARS = Number(config.minChars) || 3;
  var REQUIRED = config.required !== false;
  var DEBOUNCE_MS = 300;

  if (!PROXY) {
    console.warn("[business-picker] No lookup endpoint configured — disabled.");
    return;
  }

  function h(el, sel) {
    return el.querySelector(sel);
  }

  /* ------------------------------------------------------------------
   * One picker instance per product form
   * ---------------------------------------------------------------- */
  function init(root) {
    if (root.dataset.gbpReady === "1") return;
    root.dataset.gbpReady = "1";

    var input = h(root, "[data-gbp-input]");
    var list = h(root, "[data-gbp-list]");
    var empty = h(root, "[data-gbp-empty]");
    var searchBox = h(root, "[data-gbp-search]");
    var selected = h(root, "[data-gbp-selected]");
    var manual = h(root, "[data-gbp-manual]");
    var errorEl = h(root, "[data-gbp-error]");

    var props = {
      name: h(root, "[data-gbp-p-name]"),
      addr: h(root, "[data-gbp-p-addr]"),
      pid: h(root, "[data-gbp-p-pid]"),
      url: h(root, "[data-gbp-p-url]"),
      flag: h(root, "[data-gbp-p-flag]"),
    };

    var timer = null;
    var controller = null;
    var results = [];
    var active = -1;

    /**
     * Shopify creates a line item property for every submitted input, including
     * blank ones. Disabling empties keeps orders clean.
     */
    function setProp(el, value) {
      if (!el) return;
      el.value = value || "";
      el.disabled = !value;
    }

    function isComplete() {
      return Boolean(props.name.value);
    }

    function clearError() {
      if (errorEl) errorEl.hidden = true;
      root.classList.remove("gbp--invalid");
    }

    function showError(msg) {
      if (!errorEl) return;
      if (msg) errorEl.textContent = msg;
      errorEl.hidden = false;
      root.classList.add("gbp--invalid");
    }

    function closeList() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      results = [];
      active = -1;
    }

    function showSelected(name, address) {
      h(root, "[data-gbp-selname]").textContent = name;
      h(root, "[data-gbp-seladdr]").textContent = address || "";
      searchBox.hidden = true;
      manual.hidden = true;
      selected.hidden = false;
      clearError();
    }

    function reset() {
      setProp(props.name, "");
      setProp(props.addr, "");
      setProp(props.pid, "");
      setProp(props.url, "");
      setProp(props.flag, "");
      selected.hidden = true;
      manual.hidden = true;
      searchBox.hidden = false;
      input.value = "";
      closeList();
      input.focus();
    }

    function choose(i) {
      var r = results[i];
      if (!r) return;
      setProp(props.name, r.name);
      setProp(props.addr, r.address);
      setProp(props.pid, r.placeId);
      setProp(props.url, r.reviewUrl);
      setProp(props.flag, "");
      showSelected(r.name, r.address);
    }

    function render() {
      list.innerHTML = "";
      if (!results.length) {
        closeList();
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;
      results.forEach(function (r, i) {
        var li = document.createElement("li");
        li.className = "gbp__item";
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.id = list.id + "-o" + i;

        var n = document.createElement("span");
        n.className = "gbp__item-name";
        n.textContent = r.name;
        var a = document.createElement("span");
        a.className = "gbp__item-addr";
        a.textContent = r.address;
        li.appendChild(n);
        li.appendChild(a);

        // mousedown fires before blur, which would otherwise close the list first
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          choose(i);
        });
        list.appendChild(li);
      });
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function highlight(i) {
      var items = list.querySelectorAll(".gbp__item");
      for (var n = 0; n < items.length; n++) {
        var on = n === i;
        items[n].classList.toggle("is-active", on);
        items[n].setAttribute("aria-selected", on ? "true" : "false");
        if (on) input.setAttribute("aria-activedescendant", items[n].id);
      }
      active = i;
    }

    function search(q) {
      if (controller) controller.abort();
      controller = new AbortController();
      root.classList.add("gbp--loading");

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
          console.error("[business-picker]", err);
          results = [];
          closeList();
          if (empty) empty.hidden = false;
        })
        .then(function () {
          root.classList.remove("gbp--loading");
        });
    }

    /* -------- search box -------- */
    input.addEventListener("input", function () {
      var q = input.value.trim();
      clearTimeout(timer);
      clearError();
      if (empty) empty.hidden = true;
      if (q.length < MIN_CHARS) {
        closeList();
        return;
      }
      timer = setTimeout(function () {
        search(q);
      }, DEBOUNCE_MS);
    });

    input.addEventListener("keydown", function (e) {
      if (list.hidden) return;
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
        closeList();
      }
    });

    input.addEventListener("blur", function () {
      setTimeout(closeList, 150);
    });

    /* -------- change / fallback -------- */
    h(root, "[data-gbp-change]").addEventListener("click", reset);

    h(root, "[data-gbp-cantfind]").addEventListener("click", function () {
      searchBox.hidden = true;
      selected.hidden = true;
      manual.hidden = false;
      closeList();
      var mn = h(root, "[data-gbp-mname]");
      if (mn) mn.focus();
    });

    h(root, "[data-gbp-back]").addEventListener("click", function () {
      manual.hidden = true;
      searchBox.hidden = false;
      setProp(props.name, "");
      setProp(props.addr, "");
      setProp(props.flag, "");
      input.focus();
    });

    // Free-text entry writes the same properties, plus a flag so these orders
    // can be filtered out for manual setup.
    ["[data-gbp-mname]", "[data-gbp-maddr]", "[data-gbp-mlink]"].forEach(function (sel) {
      var el = h(root, sel);
      if (!el) return;
      el.addEventListener("input", function () {
        var name = (h(root, "[data-gbp-mname]") || {}).value || "";
        var addr = (h(root, "[data-gbp-maddr]") || {}).value || "";
        var link = (h(root, "[data-gbp-mlink]") || {}).value || "";
        setProp(props.name, name.trim());
        setProp(props.addr, addr.trim());
        setProp(props.pid, "");
        setProp(props.url, link.trim());
        setProp(props.flag, name.trim() ? "needs manual setup" : "");
        if (name.trim()) clearError();
      });
    });

    /* -------- gate add to cart -------- */
    if (REQUIRED) {
      var form = root.closest("form");

      // Split deliberately in two. The check is pure and cannot throw, so the
      // guard can block before touching the DOM; the feedback below is purely
      // cosmetic and is allowed to fail without letting an incomplete order
      // slip through.
      root._gbpIsComplete = isComplete;

      root._gbpReportInvalid = function () {
        showError();
        if (typeof root.scrollIntoView === "function") {
          root.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (!manual.hidden) {
          var mn = h(root, "[data-gbp-mname]");
          if (mn) mn.focus();
        } else {
          searchBox.hidden = false;
          input.focus();
        }
      };

      if (form) form._gbpRoot = root;
    }

    reset();
  }

  /* ------------------------------------------------------------------
   * Blocking add-to-cart
   *
   * Listeners are registered on document in the CAPTURE phase so they run
   * before the theme's own submit/click handlers, which is the only reliable
   * way to stop a themed AJAX cart from firing.
   * ---------------------------------------------------------------- */
  function guard(e) {
    var form = e.target.closest ? e.target.closest("form") : null;
    if (e.type === "click") {
      var btn = e.target.closest('[name="add"], .m-add-to-cart');
      if (!btn) return;
      form = btn.closest("form");
    }
    if (!form || !form._gbpRoot) return;
    var root = form._gbpRoot;
    if (!root._gbpIsComplete || root._gbpIsComplete()) return;

    // Block FIRST. Showing the error involves scrolling and focusing, and if any
    // of that throws (an older browser, a theme that removed the node) we must
    // not end up having failed open — an order without a business listing is
    // worse than a missing scroll animation.
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      root._gbpReportInvalid();
    } catch (err) {
      console.error("[business-picker]", err);
    }
  }

  document.addEventListener("submit", guard, true);
  document.addEventListener("click", guard, true);

  function scan() {
    var nodes = document.querySelectorAll("[data-gbp]");
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  // Quick view modals and dynamic sections render product forms after load.
  if (window.MutationObserver) {
    new MutationObserver(function () {
      clearTimeout(scan._t);
      scan._t = setTimeout(scan, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
