/**
 * Google Address Autocomplete for Shopify storefronts.
 *
 * Binds to address-line-1 inputs, offers Google suggestions as the customer
 * types, and fills the rest of the address on selection.
 *
 * No API key lives here. Every request goes to the proxy endpoint configured on
 * the app embed block, which holds the key server-side.
 *
 * Implemented as an ARIA combobox so it is keyboard and screen-reader usable:
 * arrow keys move through suggestions, Enter selects, Escape dismisses.
 */
(function () {
  "use strict";

  var config = window.TapAndRateAddressAutocomplete || {};
  var PROXY = (config.proxyUrl || "").replace(/\/$/, "");
  var COUNTRY = (config.country || "").trim();
  var MIN_CHARS = Number(config.minChars) || 3;
  var DEBUG = Boolean(config.debug);
  var DEBOUNCE_MS = 250;

  if (!PROXY) {
    console.warn("[address-autocomplete] No lookup endpoint configured — disabled.");
    return;
  }

  function log() {
    if (DEBUG) console.log.apply(console, ["[address-autocomplete]"].concat([].slice.call(arguments)));
  }

  /**
   * Shopify's own address forms (customer account, and themes that roll their
   * own) use these names. Anything else the merchant adds in the block settings
   * is appended.
   */
  var DEFAULT_SELECTORS = [
    'input[name="address[address1]"]',
    'input[name="checkout[shipping_address][address1]"]',
    'input[id$="_address1"]',
    'input[autocomplete="address-line1"]',
    'input[data-address-autocomplete]',
  ];

  function allSelectors() {
    var extra = (config.selectors || "")
      .split("\n")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    return DEFAULT_SELECTORS.concat(extra).join(",");
  }

  /* ---------------------------------------------------------------
   * Session tokens
   * Google bills a series of autocomplete calls plus the details call
   * as ONE session when they share a token. Without it, every keystroke
   * is billed separately — the difference is large on a busy store.
   * ------------------------------------------------------------- */
  function newToken() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function post(path, body, signal) {
    return fetch(PROXY + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal,
    }).then(function (r) {
      if (!r.ok) throw new Error("Lookup failed (" + r.status + ")");
      return r.json();
    });
  }

  /* ---------------------------------------------------------------
   * Field discovery
   * Finds the sibling fields belonging to the same address form.
   * ------------------------------------------------------------- */
  /**
   * The container holding this input's sibling address fields.
   *
   * Usually the enclosing <form>. Some themes render address fields with no
   * form at all — Minimog's cart shipping estimator is one — so rather than
   * falling back to the whole document (which risks filling fields belonging
   * to a different address block on the same page) we walk up until we find
   * the nearest ancestor that also contains the sibling fields.
   */
  function scopeFor(input) {
    var form = input.closest("form");
    if (form) return form;
    var el = input.parentElement;
    while (el && el !== document.body) {
      if (el.querySelector('[name="address[city]"], [name="address[zip]"]')) return el;
      el = el.parentElement;
    }
    return document;
  }

  function fieldsFor(input) {
    var form = scopeFor(input);
    function pick() {
      for (var i = 0; i < arguments.length; i++) {
        var el = form.querySelector(arguments[i]);
        if (el) return el;
      }
      return null;
    }
    return {
      address2: pick(
        'input[name="address[address2]"]',
        'input[id$="_address2"]',
        'input[autocomplete="address-line2"]'
      ),
      city: pick('input[name="address[city]"]', 'input[id$="_city"]', 'input[autocomplete="address-level2"]'),
      zip: pick('input[name="address[zip]"]', 'input[id$="_zip"]', 'input[autocomplete="postal-code"]'),
      province: pick(
        'select[name="address[province]"]',
        'input[name="address[province]"]',
        'select[id$="_province"]',
        'input[id$="_province"]'
      ),
      country: pick(
        'select[name="address[country]"]',
        'input[name="address[country]"]',
        'select[id$="_country"]',
        'input[id$="_country"]'
      ),
    };
  }

  /** Sets a value and fires the events themes and frameworks listen for. */
  function setValue(el, value) {
    if (!el || value == null || value === "") return;
    if (el.tagName === "SELECT") {
      var target = String(value).toLowerCase();
      var matched = false;
      for (var i = 0; i < el.options.length; i++) {
        var opt = el.options[i];
        if (
          opt.value.toLowerCase() === target ||
          opt.text.toLowerCase() === target
        ) {
          el.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) return;
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ---------------------------------------------------------------
   * The combobox
   * ------------------------------------------------------------- */
  function attach(input) {
    if (input.dataset.taraBound === "1") return;
    input.dataset.taraBound = "1";
    log("binding to", input.name || input.id || input);

    var wrap = document.createElement("div");
    wrap.className = "tara-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var list = document.createElement("ul");
    list.className = "tara-list";
    list.setAttribute("role", "listbox");
    list.id = "tara-list-" + Math.random().toString(36).slice(2, 9);
    list.hidden = true;
    wrap.appendChild(list);

    var status = document.createElement("div");
    status.className = "tara-status";
    status.setAttribute("aria-live", "polite");
    wrap.appendChild(status);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id);
    // Stop the browser's own dropdown fighting ours for the same space.
    input.setAttribute("autocomplete", "off");

    var token = newToken();
    var suggestions = [];
    var active = -1;
    var timer = null;
    var controller = null;

    function close() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      suggestions = [];
      active = -1;
    }

    function highlight(index) {
      var items = list.querySelectorAll(".tara-item");
      for (var i = 0; i < items.length; i++) {
        var on = i === index;
        items[i].classList.toggle("is-active", on);
        items[i].setAttribute("aria-selected", on ? "true" : "false");
        if (on) input.setAttribute("aria-activedescendant", items[i].id);
      }
      active = index;
    }

    function render() {
      list.innerHTML = "";
      if (!suggestions.length) {
        close();
        return;
      }
      suggestions.forEach(function (s, i) {
        var li = document.createElement("li");
        li.className = "tara-item";
        li.id = list.id + "-opt-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");

        var primary = document.createElement("span");
        primary.className = "tara-primary";
        primary.textContent = s.primary;
        var secondary = document.createElement("span");
        secondary.className = "tara-secondary";
        secondary.textContent = s.secondary;

        li.appendChild(primary);
        li.appendChild(secondary);
        // mousedown, not click: click fires after blur, which would have
        // already closed the list.
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          choose(i);
        });
        list.appendChild(li);
      });
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      status.textContent = suggestions.length + " address suggestions available.";
    }

    function search(value) {
      if (controller) controller.abort();
      controller = new AbortController();
      var body = { input: value, sessionToken: token };
      if (COUNTRY) body.country = COUNTRY;

      post("/api/places/autocomplete", body, controller.signal)
        .then(function (data) {
          suggestions = data.suggestions || [];
          render();
        })
        .catch(function (err) {
          if (err.name === "AbortError") return;
          log("autocomplete error", err);
          close();
        });
    }

    function choose(index) {
      var picked = suggestions[index];
      if (!picked) return;
      close();

      post("/api/places/details", { placeId: picked.placeId, sessionToken: token })
        .then(function (data) {
          var a = data.address || {};
          var f = fieldsFor(input);

          setValue(input, a.address1 || picked.full);
          setValue(f.address2, a.address2);
          setValue(f.city, a.city);
          setValue(f.zip, a.zip);
          // Country first: Shopify repopulates the province list when the
          // country changes, so setting province before it would be wiped.
          setValue(f.country, a.country || a.countryCode);
          if (f.province) {
            setTimeout(function () {
              setValue(f.province, a.province || a.provinceCode);
            }, 0);
          }
          status.textContent = "Address filled in.";
          // The session ended with this details call — the next search starts
          // a fresh billable session.
          token = newToken();
        })
        .catch(function (err) {
          log("details error", err);
          // Fall back to the suggestion text so the customer isn't stuck.
          setValue(input, picked.full);
        });
    }

    input.addEventListener("input", function () {
      var value = input.value.trim();
      clearTimeout(timer);
      if (value.length < MIN_CHARS) {
        close();
        return;
      }
      timer = setTimeout(function () {
        search(value);
      }, DEBOUNCE_MS);
    });

    input.addEventListener("keydown", function (e) {
      if (list.hidden) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        highlight((active + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlight((active - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter") {
        if (active >= 0) {
          e.preventDefault();
          choose(active);
        }
      } else if (e.key === "Escape") {
        close();
      }
    });

    input.addEventListener("blur", function () {
      setTimeout(close, 150);
    });
  }

  function scan() {
    var nodes = document.querySelectorAll(allSelectors());
    for (var i = 0; i < nodes.length; i++) attach(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  // Address forms often appear inside modals or are re-rendered by the theme
  // after load, so a one-off scan on DOMContentLoaded isn't enough.
  if (window.MutationObserver) {
    new MutationObserver(function () {
      clearTimeout(scan._t);
      scan._t = setTimeout(scan, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
