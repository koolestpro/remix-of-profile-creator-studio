# Google Address Autocomplete for Shopify

Address autocomplete on the client's storefront, using the same Google Places
setup as Tapandrate.

**The Google key never goes into the theme.** The storefront calls a lookup
endpoint on the existing Tapandrate deployment, which holds the key server-side
and only answers approved storefront domains.

```
Shopify storefront  ──POST──▶  tapandrateai.co.uk/api/places/*  ──▶  Google Places API
   (no key anywhere)              (key lives here)
```

> **Why not just hide the key in Shopify?**
> You can't. Theme settings, metafields, Liquid variables — anything Liquid
> renders ends up in the page source, where any visitor can read it with
> View Source. The only two safe options are a server-side proxy (this) or a
> browser key locked by HTTP-referrer restrictions (visible but domain-locked,
> and spoofable). A referrer-locked key also *cannot* be the key Vercel uses,
> because server calls carry no referrer — one key can't be both.

---

## Files

| File | Goes where |
|---|---|
| `theme-snippet/assets/address-autocomplete.js` | Theme → Assets |
| `theme-snippet/assets/address-autocomplete.css` | Theme → Assets |
| `theme-snippet/snippets/address-autocomplete.liquid` | Theme → Snippets |

Already built and live on the server side — nothing to do here:

| Piece | Location |
|---|---|
| Lookup endpoints | `src/lib/places-api.ts` |
| Server wiring | `src/server.ts` |
| Shared key resolution | `src/lib/maps-key.ts` |

`extensions/` holds a Shopify app-extension version of the same thing. Ignore it
for now — it's there if you ever want the install to survive theme changes
without re-pasting.

---

## Step 1 — Google Cloud (client's own project)

The key should belong to the client, not you. If it's on your project, you pay
for their traffic, you carry the liability, and the store breaks if you part
ways.

**Moving it to their project:**

1. Client creates a project at [console.cloud.google.com](https://console.cloud.google.com) and enables billing.
2. They add you under **IAM & Admin** as **Editor**.
3. **APIs & Services → Enable APIs** → enable **Places API (New)**.
   The classic "Places API" is a different product and won't work.
4. **Credentials → Create credentials → API key.**
5. On that key:
   - **Application restrictions:** `None` or `IP addresses`.
     **Not** "HTTP referrers" — these calls come from a server with no referrer.
   - **API restrictions:** restrict to *Places API (New)*.
6. **Billing → Budgets & alerts** → set a monthly alert.

Migration is then just swapping the value in Vercel — nothing else changes.

If you'd rather launch on your existing key first, that works; it's already
correctly configured. Just plan the move.

## Step 2 — Vercel (one new variable)

**Vercel → Tapandrate project → Settings → Environment Variables.**

You've already added the Maps key. Add one more:

| Name | Value |
|---|---|
| `PLACES_ALLOWED_ORIGINS` | `https://theshop.com,https://www.theshop.com,*.myshopify.com` |

Then **redeploy** — env changes only apply to a new deployment.

- Comma-separated, full origins including `https://`.
- Include **both** the apex and `www` — they're different origins to a browser.
- `*.myshopify.com` covers the `.myshopify.com` domain and dev stores. It matches
  on hostname suffix, so a lookalike like `evil-myshopify.com` is rejected.
- **If unset, every request is refused.** Deliberate — an endpoint that spends
  money fails closed, not open.

## Step 3 — Shopify theme

1. **Online Store → Themes.** Work on the theme labelled **Live**.
   (If you'd rather stage it: duplicate the live theme, edit the copy, then
   publish the copy. Do not edit an unpublished theme and expect customers to
   see it — see *Verify* below.)
2. **⋯ → Edit code.**
3. **Assets → Add a new asset** → upload `address-autocomplete.js`.
4. **Assets → Add a new asset** → upload `address-autocomplete.css`.
5. **Snippets → Add a new snippet** → name it `address-autocomplete` → paste in
   `address-autocomplete.liquid`.
6. Edit the two settings at the top of that snippet if needed (endpoint URL and
   country code).
7. **Layout → theme.liquid** → immediately before `</body>`:

   ```liquid
   {% render 'address-autocomplete' %}
   ```

8. Save.

---

## Verify it's live for customers, not just for you

This is the step that matters — last time it worked for you and customers
couldn't see it, and this is how that gets caught.

1. **Confirm the theme is published.** Online Store → Themes → the theme you
   edited must be the one under **Live**, not under *Theme library*.
   Editing a draft theme is the single most common cause of "works for me only",
   because preview links only render for logged-in staff.
2. **Open the store in a private/incognito window**, logged out of admin, using
   the real domain — not a `?preview_theme_id=` link.
3. Go to a page with an address field (customer account → addresses, or the
   custom form) and type three characters of a real address.
4. Suggestions should appear. Arrow keys move, Enter selects, Escape closes.
5. On selection, city / postcode / country fill in.
6. **Ask someone else to try it on their phone, off your wifi.** If it works for
   them, it's genuinely live.
7. **DevTools → Network:** requests go to `tapandrateai.co.uk`.
   **DevTools → View source:** search for `AIza` — there must be zero matches.

---

## Cost

Autocomplete is billed per *session*, not per keystroke. A session is a run of
autocomplete calls plus the one details call that ends it, tied together by a
session token. The script issues one per search and rotates it after each
selection, so a customer typing an address is one session, not fifteen requests.

To reduce spend: raise `minimum_characters` to 4 or 5 in the snippet, keep the
country restriction on, and set a quota cap in Google Cloud → APIs & Services →
Quotas.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Nothing happens; console shows a CORS error | Storefront origin missing from `PLACES_ALLOWED_ORIGINS`, or you didn't redeploy after adding it |
| `403 Origin not allowed` | Same — check apex vs `www` |
| `500 Address lookup is not configured` | `VITE_GOOGLE_MAPS_API_KEY` not set on Vercel |
| `502 Address lookup unavailable` | Google rejected the key — check Places API (New) is enabled, billing active, restrictions not "HTTP referrers". The Vercel function log has Google's exact message |
| Works for you, not customers | You edited a draft theme, or you're testing a preview link. See *Verify* above |
| Suggestions appear but fields don't fill | The form uses non-standard field names — send me the theme code and I'll add the selectors |
| Province/state not filled | Expected on UK addresses; Shopify has no province field for GB |

---

## Note on Shopify checkout

This does not apply to Shopify's native checkout. Checkout can't be modified
without Shopify Plus, and it already has Google-powered address autocomplete
built in — there's nothing to add there. This covers customer account address
forms and any custom forms on the storefront.
