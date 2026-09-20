/**
 * Resolves the Google Maps API key on the server.
 *
 * Shared by the in-app Places search (places.functions.ts) and the public
 * proxy used by the Shopify storefront (places-api.ts) so there is exactly one
 * place that knows how the key is configured.
 */
export interface ResolvedMapsKey {
  key: string | undefined;
  /** Which env var supplied it — used to diagnose misconfigured deploys. */
  source:
    | "GOOGLE_MAPS_API_KEY"
    | "VITE_GOOGLE_MAPS_API_KEY"
    | "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY";
}

export function resolveMapsKey(): ResolvedMapsKey {
  // GOOGLE_MAPS_API_KEY (no VITE_ prefix) is the preferred name: it stays
  // server-only and can be stored as a Vercel "Secret". The VITE_ names are
  // kept as fallbacks so older deploys keep working.
  const candidates = [
    ["GOOGLE_MAPS_API_KEY", process.env.GOOGLE_MAPS_API_KEY],
    ["VITE_GOOGLE_MAPS_API_KEY", process.env.VITE_GOOGLE_MAPS_API_KEY],
    ["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY", process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY],
  ] as const;
  const found = candidates.find(([, v]) => v && v.trim());
  const raw = found?.[1];

  // Keys pasted into a .env file with surrounding quotes arrive with the quotes
  // attached in some hosts, producing a key Google silently rejects.
  const key = raw?.trim().replace(/^["']|["']$/g, "") || undefined;

  return {
    key,
    source: found?.[0] ?? "GOOGLE_MAPS_API_KEY",
  };
}

export const MAPS_KEY_SETUP_MESSAGE =
  "Google Maps key not configured on the server. Add GOOGLE_MAPS_API_KEY to your " +
  "hosting environment variables (Vercel → Project → Settings → Environment Variables), " +
  "then redeploy. A .env.local file only works on your own machine — it is gitignored and " +
  "never reaches the deployed site.";
