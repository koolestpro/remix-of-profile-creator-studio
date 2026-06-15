import { useRef, useState } from "react";
import { Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  label: string;
  hint?: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  aspect?: "wide" | "square";
  /**
   * Optional uploader. When provided, the picked file is compressed + uploaded
   * (e.g. to Supabase Storage) and onChange receives the resulting URL. When
   * omitted, falls back to embedding the file as a base64 data-URL.
   */
  onUpload?: (file: File) => Promise<string>;
  onError?: (message: string) => void;
}

export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  aspect = "wide",
  onUpload,
  onError,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async (f?: File) => {
    if (!f) return;
    if (onUpload) {
      setUploading(true);
      try {
        const url = await onUpload(f);
        onChange(url);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Image upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    } else {
      // No uploader supplied — embed as base64 (localStorage-only mode).
      const r = new FileReader();
      r.onload = () => onChange(r.result as string);
      r.readAsDataURL(f);
    }
    // Allow re-selecting the same file later.
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {value && !uploading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(undefined)}
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        )}
      </div>
      <div
        onClick={() => !uploading && ref.current?.click()}
        className={`relative overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 transition hover:border-primary hover:bg-muted/50 ${
          uploading ? "cursor-wait" : "cursor-pointer"
        } ${aspect === "wide" ? "aspect-[16/7]" : "aspect-square w-32"}`}
      >
        {uploading ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
            </div>
          </div>
        ) : value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-destructive shadow"
              title="Delete image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-1 text-xs text-muted-foreground">{hint ?? "Click to upload"}</p>
            </div>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}

// re-export so we can keep imports lean
export { Button };
