import { useRef } from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

const PRESET_SWATCHES = [
  // Neutrals
  "#FFFFFF", "#F5F5F5", "#E5E5E5", "#A3A3A3", "#525252", "#1F1F1F", "#000000",
  // Warm / cream
  "#FFF8E7", "#F4EAD5", "#E9D8A6", "#F2C879", "#E58F65", "#C2410C", "#7C2D12",
  // Reds & pinks
  "#FECACA", "#F87171", "#EF4444", "#DC2626", "#F472B6", "#EC4899", "#BE185D",
  // Greens
  "#D1FAE5", "#86EFAC", "#22C55E", "#16A34A", "#10B981", "#047857", "#064E3B",
  // Blues
  "#DBEAFE", "#93C5FD", "#3B82F6", "#1D4ED8", "#0EA5E9", "#0369A1", "#0C2340",
  // Purples
  "#E9D5FF", "#C4B5FD", "#A78BFA", "#7C3AED", "#6D28D9", "#4C1D95", "#312E81",
];

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const handleEyedropper = async () => {
    if (!window.EyeDropper) {
      toast.error("Eyedropper not supported in this browser. Use the color picker instead.");
      return;
    }
    try {
      const ed = new window.EyeDropper();
      const result = await ed.open();
      onChange(result.sRGBHex);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-10 w-12 shrink-0 rounded-md border border-border shadow-sm transition hover:scale-105"
              style={{ backgroundColor: value }}
              aria-label={`Pick color for ${label}`}
            />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Presets</p>
            <div className="grid grid-cols-7 gap-1.5">
              {PRESET_SWATCHES.map((c) => {
                const active = c.toUpperCase() === value.toUpperCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`h-7 w-7 rounded-md border transition hover:scale-110 ${
                      active ? "ring-2 ring-primary ring-offset-1" : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                );
              })}
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium transition hover:bg-muted"
              >
                <span>Custom color</span>
                <span
                  className="h-5 w-5 rounded border border-border"
                  style={{ backgroundColor: value }}
                />
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <input
          ref={pickerRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
        <Input
          value={value.toUpperCase()}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase"
          maxLength={7}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleEyedropper}
          title="Eyedropper"
        >
          <Pipette className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
