/**
 * Google Places text search — called directly from the browser using the
 * public browser key (VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY).
 * No Lovable connector gateway or server function required.
 */

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  reviewUrl: string;
}

const BROWSER_KEY = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

export async function searchGooglePlaces(
  query: string,
): Promise<{ results: PlaceResult[] }> {
  if (!BROWSER_KEY) {
    throw new Error(
      "Google Maps key not configured. " +
        "Add VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY to your .env file.",
    );
  }

  const q = query.trim().slice(0, 200);
  if (!q) return { results: [] };

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": BROWSER_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textQuery: q }),
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
}
