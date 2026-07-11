import {
  ArrowDown,
  ArrowUp,
  FileText,
  GripVertical,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ICON_OPTIONS, ICON_COLORS, ICON_DEFAULT_TEXT, renderIcon } from "@/lib/icon-registry";
import type { LinkItem, IconKey } from "@/lib/profile-types";
import { searchGooglePlaces, type PlaceResult } from "@/lib/places.functions";

interface Props {
  link: LinkItem;
  index: number;
  total: number;
  onChange: (patch: Partial<LinkItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  /** Handles the actual upload (Supabase Storage + pdf_code generation) for
   *  icon === "pdf" links. Only needed when that icon is selectable. */
  onUploadPdf?: (file: File) => void;
  /** True while this link's PDF upload is in flight. */
  uploadingPdf?: boolean;
}

export function LinkEditor({
  link,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onUploadPdf,
  uploadingPdf,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[] | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);

  const handleIconUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ iconUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const runPlaceSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? placeQuery).trim();
    if (!q) {
      setPlaceResults(null);
      return;
    }
    setPlaceLoading(true);
    try {
      const { results } = await searchGooglePlaces({ data: { query: q } });
      setPlaceResults(results);
    } catch (err) {
      console.error("Places search error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Google Places: ${msg}`, { duration: 6000 });
    } finally {
      setPlaceLoading(false);
    }
  };

  useEffect(() => {
    if (link.icon !== "google") return;
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceResults(null);
      return;
    }
    const t = setTimeout(() => {
      runPlaceSearch(q);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeQuery, link.icon]);

  const accent = ICON_COLORS[link.icon] ?? "#6B7280";

  return (
    <div
      className="group relative overflow-hidden rounded-xl border-2 bg-card p-4 pl-5 shadow-sm transition hover:shadow-md"
      style={{
        borderColor: accent,
        borderLeftWidth: "6px",
        backgroundImage: `linear-gradient(90deg, ${accent}10, transparent 40%)`,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          Link #{index + 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="h-8 w-8"
            title="Move up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="h-8 w-8"
            title="Move down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        {/* Icon block */}
        <div className="flex flex-col items-center gap-2">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-muted">
            {link.iconUrl ? (
              <img src={link.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              renderIcon(link.icon, "h-6 w-6 text-foreground")
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleIconUpload(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1 h-3 w-3" /> Custom
          </Button>
          {link.iconUrl && (
            <button
              className="text-[10px] text-muted-foreground underline"
              onClick={() => onChange({ iconUrl: undefined })}
            >
              remove
            </button>
          )}
        </div>

        <div className="space-y-2">
          <Select
            value={link.icon}
            onValueChange={(v) => {
              const next = v as IconKey;
              const knownTitles = Object.values(ICON_DEFAULT_TEXT).map((d) => d.title);
              const knownSubs = Object.values(ICON_DEFAULT_TEXT).map((d) => d.subtitle);
              const def = ICON_DEFAULT_TEXT[next];
              const patch: Partial<LinkItem> = { icon: next };
              if (!link.title.trim() || knownTitles.includes(link.title)) {
                patch.title = def.title;
              }
              if (!link.subtitle.trim() || knownSubs.includes(link.subtitle)) {
                patch.subtitle = def.subtitle;
              }
              onChange(patch);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ICON_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Main title (e.g. Instagram)"
            value={link.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
          <Input
            placeholder="Secondary description (e.g. Follow us)"
            value={link.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
          {link.icon === "pdf" ? (
            <>
              <input
                ref={pdfFileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onUploadPdf?.(file);
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => pdfFileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!pdfDragOver) setPdfDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setPdfDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setPdfDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) onUploadPdf?.(file);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pdfFileRef.current?.click();
                  }
                }}
                className={`cursor-pointer rounded-lg border-2 border-dashed bg-muted/30 p-3 transition hover:border-primary hover:bg-muted/50 ${
                  pdfDragOver
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      {uploadingPdf ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {link.pdfUrl ? "Replace PDF" : "Click to upload a PDF"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {link.pdfName ?? "We'll host it and set the link automatically."}
                    </p>
                  </div>
                  {link.pdfUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange({ pdfUrl: undefined, pdfName: undefined, url: "" });
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <Input
              placeholder="https://redirect-url.com"
              value={link.url}
              onChange={(e) => onChange({ url: e.target.value })}
            />
          )}
          {link.icon === "google" && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-foreground">Find your Google Business</p>
              <div className="relative">
                <Input
                  placeholder="e.g. Juices4Life Harlesden"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  className="h-9 pr-9"
                />
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
                  {placeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </div>
              </div>
              {placeResults && placeResults.length > 0 && (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {placeResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange({ url: r.reviewUrl });
                          setPlaceResults(null);
                          setPlaceQuery("");
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
