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
  source: "VITE_GOOGLE_MAPS_API_KEY" | "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY";
}

export function resolveMapsKey(): ResolvedMapsKey {
  const primary = process.env.VITE_GOOGLE_MAPS_API_KEY;
  const raw = primary ?? process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

  // Keys pasted into a .env file with surrounding quotes arrive with the quotes
  // attached in some hosts, producing a key Google silently rejects.
  const key = raw?.trim().replace(/^["']|["']$/g, "") || undefined;

  return {
    key,
    source: primary ? "VITE_GOOGLE_MAPS_API_KEY" : "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY",
  };
}

export const MAPS_KEY_SETUP_MESSAGE =
  "Google Maps key not configured on the server. Add VITE_GOOGLE_MAPS_API_KEY to your " +
  "hosting environment variables (Vercel → Project → Settings → Environment Variables), " +
  "then redeploy. A .env.local file only works on your own machine — it is gitignored and " +
  "never reaches the deployed site.";
