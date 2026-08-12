#!/usr/bin/env node
/**
 * Shopify theme automation for the address-autocomplete install.
 *
 * Reads credentials from .env.local (gitignored) and talks to the Admin API.
 * Dev Dashboard apps no longer expose an access token in the UI, so if only a
 * client id/secret are present this exchanges them for one via the client
 * credentials grant.
 *
 * Usage:
 *   node scripts/shopify-theme.mjs check      # auth + list themes
 *   node scripts/shopify-theme.mjs pull       # back up live theme locally
 *   node scripts/shopify-theme.mjs duplicate  # copy live theme (unpublished)
 *   node scripts/shopify-theme.mjs install <themeId>  # upload files + wire up
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const API_VERSION = "2026-07";

/* ---------------- env ---------------- */

function readEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) throw new Error(".env.local not found");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = readEnv();
const STORE = env.SHOPIFY_STORE;
if (!STORE) throw new Error("SHOPIFY_STORE missing from .env.local");

/* ---------------- auth ---------------- */

/**
 * Dev Dashboard apps use the client credentials grant: the client id/secret
 * are exchanged for a short-lived access token rather than a token being
 * copied out of the admin UI.
 */
async function getToken() {
  // Theme Access password (shptka_…). Works for stores in someone else's
  // organization, where a Dev Dashboard app cannot be installed at all, and is
  // scoped to themes only.
  if (env.SHOPIFY_THEME_TOKEN) return env.SHOPIFY_THEME_TOKEN;
  if (env.SHOPIFY_ADMIN_TOKEN) return env.SHOPIFY_ADMIN_TOKEN;

  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) {
    throw new Error(
      "No credentials in .env.local. Use ONE of:\n" +
        "  SHOPIFY_THEME_TOKEN   — Theme Access app password (works on any store)\n" +
        "  SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET — Dev Dashboard app (same org only)\n" +
        "  SHOPIFY_ADMIN_TOKEN   — legacy custom app token",
    );
  }

  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Token exchange failed (${res.status}): ${text}\n` +
        "Check the app is installed on this store and the scopes " +
        "read_themes + write_themes are released.",
    );
  }
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error(`No access_token in response: ${text}`);
  return data.access_token;
}

let TOKEN;
async function api(pathname, options = {}) {
  TOKEN ??= await getToken();
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}${pathname}`, {
    ...options,
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${options.method || "GET"} ${pathname} → ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

/* ---------------- theme helpers ---------------- */

async function themes() {
  return (await api("/themes.json")).themes;
}

async function liveTheme() {
  const t = (await themes()).find((x) => x.role === "main");
  if (!t) throw new Error("No published theme found");
  return t;
}

async function getAsset(themeId, key) {
  const q = new URLSearchParams({ "asset[key]": key });
  const r = await api(`/themes/${themeId}/assets.json?${q}`);
  return r.asset;
}

async function putAsset(themeId, key, value) {
  return api(`/themes/${themeId}/assets.json`, {
    method: "PUT",
    body: JSON.stringify({ asset: { key, value } }),
  });
}

/* ---------------- commands ---------------- */

const SNIPPET_DIR = path.join(ROOT, "shopify", "theme-snippet");
const RENDER_TAG = "{% render 'address-autocomplete' %}";

async function cmdCheck() {
  const list = await themes();
  console.log(`Authenticated to ${STORE}\n`);
  for (const t of list) {
    console.log(`  ${String(t.id).padEnd(15)} ${t.role.padEnd(10)} ${t.name}`);
  }
}

async function cmdPull() {
  const theme = await liveTheme();
  const out = path.join(ROOT, "shopify", "backup", `theme-${theme.id}`);
  fs.mkdirSync(out, { recursive: true });

  const { assets } = await api(`/themes/${theme.id}/assets.json`);
  console.log(`Live theme: ${theme.name} (${theme.id}) — ${assets.length} assets`);

  // Only the files we might touch or need to inspect. Pulling every binary
  // asset would take a long time and we don't need images.
  const wanted = assets.filter(
    (a) =>
      a.key === "layout/theme.liquid" ||
      /address|customer|account|contact/i.test(a.key) ||
      a.key.startsWith("sections/") ||
      a.key.startsWith("snippets/"),
  );
  console.log(`Downloading ${wanted.length} relevant files…`);

  for (const a of wanted) {
    try {
      const asset = await getAsset(theme.id, a.key);
      if (asset?.value == null) continue;
      const dest = path.join(out, a.key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, asset.value);
    } catch (e) {
      console.warn(`  skipped ${a.key}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`Saved to ${path.relative(ROOT, out)}`);
}

async function cmdDuplicate() {
  const theme = await liveTheme();
  console.log(`Duplicating "${theme.name}" (${theme.id})…`);
  // Shopify has no direct "duplicate" endpoint; creating from the live theme's
  // published zip is the supported route.
  const created = await api("/themes.json", {
    method: "POST",
    body: JSON.stringify({
      theme: { name: `${theme.name} + address autocomplete`, role: "unpublished" },
    }),
  });
  console.log(
    `Created theme ${created.theme.id}. NOTE: this is an empty theme — ` +
      `duplicate via admin UI instead if you want a full copy.`,
  );
  return created.theme.id;
}

async function cmdInstall(themeId) {
  if (!themeId) throw new Error("Usage: install <themeId>");

  const js = fs.readFileSync(path.join(SNIPPET_DIR, "assets/address-autocomplete.js"), "utf8");
  const css = fs.readFileSync(path.join(SNIPPET_DIR, "assets/address-autocomplete.css"), "utf8");
  const snippet = fs.readFileSync(
    path.join(SNIPPET_DIR, "snippets/address-autocomplete.liquid"),
    "utf8",
  );

  console.log("Uploading assets…");
  await putAsset(themeId, "assets/address-autocomplete.js", js);
  await putAsset(themeId, "assets/address-autocomplete.css", css);
  await putAsset(themeId, "snippets/address-autocomplete.liquid", snippet);

  console.log("Patching layout/theme.liquid…");
  const layout = await getAsset(themeId, "layout/theme.liquid");
  if (!layout?.value) throw new Error("Could not read layout/theme.liquid");

  if (layout.value.includes("address-autocomplete")) {
    console.log("  already wired up — leaving as is");
  } else {
    const patched = layout.value.replace(/<\/body>/i, `  ${RENDER_TAG}\n  </body>`);
    if (patched === layout.value) throw new Error("No </body> found in theme.liquid");
    await putAsset(themeId, "layout/theme.liquid", patched);
    console.log("  render tag added before </body>");
  }

  console.log(`\nDone. Preview: https://${STORE}?preview_theme_id=${themeId}`);
}

/* ---------------- main ---------------- */

const [cmd, arg] = process.argv.slice(2);
const commands = {
  check: cmdCheck,
  pull: cmdPull,
  duplicate: cmdDuplicate,
  install: () => cmdInstall(arg),
};

if (!commands[cmd]) {
  console.log("Commands: check | pull | duplicate | install <themeId>");
  process.exit(1);
}

commands[cmd]().catch((e) => {
  console.error("\n✗ " + e.message);
  process.exit(1);
});
