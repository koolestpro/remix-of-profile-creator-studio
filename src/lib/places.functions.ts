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
  .validator((data: { query: string }) => {
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
      process.env.VITE_GOOGLE_MAPS_API_KEY ?? process.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

    if (!mapsKey) {
      throw new Error(
        "Google Maps key not configured. " +
          "Add VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY to .env.local.",
      );
    }

    console.log("🔑 Using Maps key:", mapsKey.slice(0, 12) + "...");

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

      // Parse the Google error body and surface an actionable hint so the
      // toast message tells you exactly what to fix in Google Cloud Console.
      let hint = "";
      try {
        const parsed = JSON.parse(body) as {
          error?: { status?: string; message?: string };
        };
        const gStatus = parsed.error?.status ?? "";
        const gMsg = parsed.error?.message ?? "";

        if (gStatus === "PERMISSION_DENIED") {
          if (gMsg.includes("not been used") || gMsg.includes("disabled")) {
            hint =
              "\n\n👉 FIX: Go to console.cloud.google.com → APIs & Services → Enable APIs → search for 'Places API (New)' and enable it. (The classic 'Places API' is a different product and won't work here.)";
          } else if (
            gMsg.includes("not authorized") ||
            gMsg.includes("not allowed")
          ) {
            hint =
              "\n\n👉 FIX: Your API key has HTTP-referrer restrictions, but this call goes through the server — it has no referrer. Go to console.cloud.google.com → Credentials → edit this key → set Application restrictions to 'None' (or 'IP addresses').";
          } else {
            hint =
              "\n\n👉 FIX: Check that 'Places API (New)' is enabled and billing is active on your Google Cloud project.";
          }
        } else if (gStatus === "REQUEST_DENIED") {
          hint =
            "\n\n👉 FIX: Billing is not enabled on your Google Cloud project. Visit console.cloud.google.com → Billing to activate it.";
        }
      } catch {
        /* non-JSON body — ignore */
      }

      throw new Error(`Places search failed (${res.status})${hint}\n\nRaw response: ${body}`);
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
