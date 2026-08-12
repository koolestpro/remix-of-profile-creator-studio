/**
 * Public HTTP proxy for Google Places Autocomplete, consumed by the client's
 * Shopify storefront.
 *
 * Why a proxy at all: the Google key must never reach the browser. A key that
 * is safe to publish would have to be HTTP-referrer restricted, and referrer
 * restrictions are trivially spoofed — anyone could lift it and bill the
 * client's Google account. Keeping the key server-side means the storefront
 * only ever talks to us, and we decide who may ask.
 *
 * Mounted directly in src/server.ts rather than as a route file, because these
 * are plain cross-origin JSON endpoints with their own CORS rules and have
 * nothing to do with the app's page router.
 *
 * Endpoints (both POST, both JSON):
 *   /api/places/autocomplete  { input, sessionToken, country? } -> suggestions
 *   /api/places/details       { placeId, sessionToken }         -> address
 */
import { resolveMapsKey, MAPS_KEY_SETUP_MESSAGE } from "@/lib/maps-key";

const AUTOCOMPLETE_PATH = "/api/places/autocomplete";
const DETAILS_PATH = "/api/places/details";
const BUSINESS_PATH = "/api/places/business-search";

/** Longest address fragment we will forward. Anything more is not a search. */
const MAX_INPUT = 200;

/* ============================================================
 * CORS
 * ============================================================ */

/**
 * Origins permitted to call these endpoints, from PLACES_ALLOWED_ORIGINS
 * (comma-separated). Supports a leading "*." wildcard so one entry can cover
 * every myshopify.com preview domain.
 *
 * With no value configured nothing is allowed — failing closed is the right
 * default for an endpoint that spends the client's money.
 */
function allowedOrigins(): string[] {
  return (process.env.PLACES_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().toLowerCase().replace(/\/$/, ""))
    .filter(Boolean);
}

function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = origin.toLowerCase().replace(/\/$/, "");
  return allowedOrigins().some((allowed) => {
    if (allowed === "*") return true;
    if (allowed.startsWith("*.")) {
      // "*.myshopify.com" matches https://foo.myshopify.com but not evil-myshopify.com
      const suffix = allowed.slice(1); // ".myshopify.com"
      try {
        return new URL(normalized).hostname.endsWith(suffix);
      } catch {
        return false;
      }
    }
    return normalized === allowed;
  });
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    // Echo the specific origin rather than "*" so the allowlist is meaningful.
    "Access-Control-Allow-Origin": origin ?? "",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

/* ============================================================
 * Best-effort rate limiting
 * ============================================================ */

const HITS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

/**
 * Per-IP throttle. Serverless instances are ephemeral and not shared, so this
 * is a speed bump against casual abuse, not a guarantee — the real protection
 * is the origin allowlist plus Google Cloud quotas.
 */
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = HITS.get(ip);
  if (!entry || now > entry.resetAt) {
    HITS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (HITS.size > 5000) HITS.clear(); // bound memory on long-lived instances
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

/* ============================================================
 * Address component mapping
 * ============================================================ */

interface GoogleComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface MappedAddress {
  address1: string;
  address2: string;
  city: string;
  province: string;
  provinceCode: string;
  zip: string;
  country: string;
  countryCode: string;
  formatted: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Flattens Google's component list into the fields a Shopify address form uses.
 *
 * The city lookup order matters: UK results carry the town in `postal_town` and
 * have no `locality` at all, so keying on `locality` alone (the common example
 * you'll find online) silently yields a blank city for every British address.
 */
export function mapAddressComponents(
  components: GoogleComponent[],
  formatted: string,
  location?: { latitude?: number; longitude?: number },
): MappedAddress {
  const find = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types?.includes(t)));

  const streetNumber = find("street_number")?.longText ?? "";
  const route = find("route")?.longText ?? "";
  const subpremise = find("subpremise")?.longText ?? "";

  const city =
    find("postal_town")?.longText ??
    find("locality")?.longText ??
    find("sublocality_level_1", "sublocality")?.longText ??
    find("administrative_area_level_2")?.longText ??
    "";

  const provinceComp = find("administrative_area_level_1");
  const countryComp = find("country");

  return {
    address1: [streetNumber, route].filter(Boolean).join(" "),
    address2: subpremise,
    city,
    province: provinceComp?.longText ?? "",
    provinceCode: provinceComp?.shortText ?? "",
    zip: find("postal_code")?.longText ?? "",
    country: countryComp?.longText ?? "",
    countryCode: countryComp?.shortText ?? "",
    formatted,
    latitude: location?.latitude,
    longitude: location?.longitude,
  };
}

/* ============================================================
 * Handlers
 * ============================================================ */

async function handleAutocomplete(body: unknown, origin: string | null, key: string) {
  const { input, sessionToken, country } = (body ?? {}) as {
    input?: unknown;
    sessionToken?: unknown;
    country?: unknown;
  };

  if (typeof input !== "string" || input.trim().length < 2) {
    return json({ suggestions: [] }, 200, origin);
  }

  const payload: Record<string, unknown> = {
    input: input.trim().slice(0, MAX_INPUT),
  };
  // Session tokens group an autocomplete series plus its details call into one
  // billable session. Without them every keystroke bills separately.
  if (typeof sessionToken === "string" && sessionToken.length <= 64) {
    payload.sessionToken = sessionToken;
  }
  if (typeof country === "string" && /^[a-z]{2}$/i.test(country)) {
    payload.includedRegionCodes = [country.toLowerCase()];
  }

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "X-Goog-Api-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Places autocomplete failed:", res.status, detail);
    return json({ error: "Address lookup unavailable", status: res.status }, 502, origin);
  }

  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }>;
  };

  // Deliberately narrow: the storefront needs an id and two strings. Passing
  // Google's full payload through would leak billing-relevant detail and grow
  // the response for no benefit.
  const suggestions = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map((p) => ({
      placeId: p.placeId!,
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
      full: p.text?.text ?? "",
    }));

  return json({ suggestions }, 200, origin);
}

async function handleDetails(body: unknown, origin: string | null, key: string) {
  const { placeId, sessionToken } = (body ?? {}) as {
    placeId?: unknown;
    sessionToken?: unknown;
  };

  if (typeof placeId !== "string" || !/^[A-Za-z0-9_-]{5,255}$/.test(placeId)) {
    return json({ error: "A valid placeId is required" }, 400, origin);
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
  if (typeof sessionToken === "string" && sessionToken.length <= 64) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      // Requesting only these fields keeps the call in a cheaper billing tier.
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Places details failed:", res.status, detail);
    return json({ error: "Address lookup unavailable", status: res.status }, 502, origin);
  }

  const data = (await res.json()) as {
    formattedAddress?: string;
    addressComponents?: GoogleComponent[];
    location?: { latitude?: number; longitude?: number };
  };

  return json(
    {
      address: mapAddressComponents(
        data.addressComponents ?? [],
        data.formattedAddress ?? "",
        data.location,
      ),
    },
    200,
    origin,
  );
}

/**
 * Finds a customer's Google Business listing by name.
 *
 * Uses Places text search rather than autocomplete: shoppers type a business
 * name ("Juices4Life Harlesden"), not a postal address, and text search matches
 * listings far better while returning the name and address in one call.
 *
 * Returns a ready-made write-a-review URL alongside each result — the same
 * format the profile editor produces, so an order can be fulfilled without
 * anyone looking the listing up a second time.
 */
async function handleBusinessSearch(body: unknown, origin: string | null, key: string) {
  const { query, country } = (body ?? {}) as { query?: unknown; country?: unknown };

  if (typeof query !== "string" || query.trim().length < 2) {
    return json({ results: [] }, 200, origin);
  }

  const payload: Record<string, unknown> = { textQuery: query.trim().slice(0, MAX_INPUT) };
  // searchText takes a single `regionCode` string. `includedRegionCodes` is an
  // autocomplete-only field and makes this endpoint 400.
  if (typeof country === "string" && /^[a-z]{2}$/i.test(country)) {
    payload.regionCode = country.toLowerCase();
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "Content-Type": "application/json",
      // Required by searchText — the call 400s without it. Requesting only
      // these three fields also keeps it in the cheapest billing tier.
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Places business search failed:", res.status, detail);
    return json({ error: "Business lookup unavailable", status: res.status }, 502, origin);
  }

  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
    }>;
  };

  const results = (data.places ?? [])
    .filter((p) => p.id)
    .map((p) => ({
      placeId: p.id!,
      name: p.displayName?.text ?? "Unnamed business",
      address: p.formattedAddress ?? "",
      reviewUrl: `https://search.google.com/local/writereview?placeid=${p.id}`,
    }));

  return json({ results }, 200, origin);
}

/* ============================================================
 * Entry point
 * ============================================================ */

/**
 * Returns a Response when the request targets a Places endpoint, or null to let
 * the normal app router handle it.
 */
export async function handlePlacesApi(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname !== AUTOCOMPLETE_PATH && pathname !== DETAILS_PATH && pathname !== BUSINESS_PATH) {
    return null;
  }

  const origin = request.headers.get("origin");

  if (!originAllowed(origin)) {
    // 403 with no CORS headers: the browser reports a CORS failure, and a
    // direct caller gets a clear reason.
    return new Response(
      JSON.stringify({
        error:
          "Origin not allowed. Add this storefront's URL to PLACES_ALLOWED_ORIGINS " +
          "in the hosting environment variables.",
      }),
      { status: 403, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  if (rateLimited(clientIp(request))) {
    return json({ error: "Too many requests. Please slow down." }, 429, origin);
  }

  const { key } = resolveMapsKey();
  if (!key) {
    console.error(MAPS_KEY_SETUP_MESSAGE);
    return json({ error: "Address lookup is not configured." }, 500, origin);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  try {
    if (pathname === AUTOCOMPLETE_PATH) return await handleAutocomplete(body, origin, key);
    if (pathname === BUSINESS_PATH) return await handleBusinessSearch(body, origin, key);
    return await handleDetails(body, origin, key);
  } catch (err) {
    console.error("Places proxy error:", err);
    return json({ error: "Address lookup failed" }, 500, origin);
  }
}
