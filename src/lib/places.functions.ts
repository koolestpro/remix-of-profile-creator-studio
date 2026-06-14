/**
 * Google Places text search — runs SERVER-SIDE via createServerFn to avoid
 * CORS / HTTP-referrer-restriction issues with browser requests.
 *
 * Uses VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY from .env.local / Vercel env.
 * No Lovable connector gateway or separate GOOGLE_MAPS_API_KEY required.
 */
import { createServerFn } from "@tanstack/react-start";

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  reviewUrl: string;
}

export const searchGooglePlaces = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => {
    if (!data || typeof data.query !== "string") {
      throw new Error("query is required");
    }
    const q = data.query.trim().slice(0, 200);
    if (!q) throw new Error("query is empty");
    return { query: q };
  })
  .handler(async ({ data }) => {
    // process.env picks up VITE_* vars on the server via Vite/Vinxi env loading
    const mapsKey =
      process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

    if (!mapsKey) {
      throw new Error(
        "Google Maps key not configured. " +
          "Add VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY to .env.local.",
      );
    }

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": mapsKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ textQuery: data.query }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Places search failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
      }>;
    };

    const results: PlaceResult[] = (json.places ?? []).map((p) => ({
      id: p.id,
      name: p.displayName?.text ?? "Unnamed place",
      address: p.formattedAddress ?? "",
      reviewUrl: `https://search.google.com/local/writereview?placeid=${p.id}`,
    }));

    return { results };
  });
