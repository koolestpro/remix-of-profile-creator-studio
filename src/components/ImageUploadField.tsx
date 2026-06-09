import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  label: string;
  hint?: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  aspect?: "wide" | "square";
}

export function ImageUploadField({ label, hint, value, onChange, aspect = "wide" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const handle = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onChange(r.result as string);
    r.readAsDataURL(f);
  };
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className={`relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 transition hover:border-primary hover:bg-muted/50 ${
          aspect === "wide" ? "aspect-[16/7]" : "aspect-square w-32"
        }`}
      >
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground shadow"
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
