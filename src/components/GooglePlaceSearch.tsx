import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { searchGooglePlaces, type PlaceResult } from "@/lib/places.functions";

interface Props {
  /** Called with the Google review URL when a result is picked. */
  onPick: (reviewUrl: string) => void;
  label?: string;
  placeholder?: string;
}

/**
 * "Find your Google Business" typeahead. Searches Google Places and hands back
 * a ready-made review URL, so nobody has to hand-craft one.
 *
 * Shared by the landing page's link editor and the business card's social
 * editor — both need the same lookup for their Google entry.
 */
export function GooglePlaceSearch({
  onPick,
  label = "Find your Google Business",
  placeholder = "e.g. Juices4Life Harlesden",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    // Debounced so a burst of keystrokes costs one Places call, not one each.
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { results: found } = await searchGooglePlaces({ data: { query: q } });
        setResults(found);
      } catch (err) {
        console.error("Places search error:", err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Google Places: ${msg}`, { duration: 6000 });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 pr-9"
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </div>
      </div>
      {results && results.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(r.reviewUrl);
                  setResults(null);
                  setQuery("");
                  toast.success(`Linked review URL for ${r.name}`);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs transition hover:bg-accent"
              >
                <div className="font-medium text-foreground">{r.name}</div>
                {r.address && <div className="text-muted-foreground">{r.address}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && !loading && (
        <p className="mt-2 text-xs text-muted-foreground">
          No matches. Try adding the town or street.
        </p>
      )}
    </div>
  );
}
