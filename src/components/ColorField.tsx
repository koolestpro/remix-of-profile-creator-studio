import { useEffect, useRef, useState } from "react";
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
  "#FFFFFF", "#F5F5F5", "#A3A3A3", "#525252", "#000000",
  "#F4EAD5", "#F2C879", "#E58F65", "#C2410C", "#7C2D12",
  "#F87171", "#EF4444", "#EC4899", "#A78BFA", "#7C3AED",
  "#3B82F6", "#0EA5E9", "#22C55E", "#10B981", "#F59E0B",
];

/* ---------- color math ---------- */
function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  const toHex = (x: number) => x.toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/* ---------- 2D picker surface ---------- */
function PickerSurface({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const hsl = hexToHsl(value) ?? { h: 0, s: 100, l: 50 };

  // position from hue (x) and lightness (y, top=100% → bottom=0%)
  const xPct = (hsl.h / 360) * 100;
  const yPct = ((100 - hsl.l) / 100) * 100;

  const pickFromEvent = (clientX: number, clientY: number) => {
    const el = surfaceRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    const h = x * 360;
    const l = (1 - y) * 100;
    onChange(hslToHex(h, 100, l));
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => pickFromEvent(e.clientX, e.clientY);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  return (
    <div
      ref={surfaceRef}
      onPointerDown={(e) => {
        setDragging(true);
        pickFromEvent(e.clientX, e.clientY);
      }}
      className="relative h-40 w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-border"
      style={{
        background:
          "linear-gradient(to bottom, #fff 0%, transparent 50%, #000 100%), linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))",
      }}
    >
      <div
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{ left: `${xPct}%`, top: `${yPct}%` }}
      />
    </div>
  );
}

/* ---------- main field ---------- */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const handleEyedropper = async () => {
    if (!window.EyeDropper) {
      // Mobile / Safari: fall back to the native system color picker
      pickerRef.current?.click();
      return;
    }
    try {
      const ed = new window.EyeDropper();
      const result = await ed.open();
      onChange(result.sRGBHex);
    } catch { /* cancelled */ }
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
          <PopoverContent className="w-72 p-3" align="start">
            <PickerSurface value={value} onChange={onChange} />

            <div className="mt-3 flex items-center gap-2">
              <div
                className="h-9 w-9 rounded-md border border-border"
                style={{ backgroundColor: value }}
              />
              <Input
                value={value.toUpperCase()}
                onChange={(e) => onChange(e.target.value)}
                className="h-9 font-mono uppercase"
                maxLength={7}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => pickerRef.current?.click()}
                title="System color picker"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18M3 12h18" />
                </svg>
              </Button>
            </div>

            <p className="mb-1.5 mt-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Presets
            </p>
            <div className="grid grid-cols-10 gap-1">
              {PRESET_SWATCHES.map((c) => {
                const active = c.toUpperCase() === value.toUpperCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`h-5 w-5 rounded border transition hover:scale-110 ${
                      active ? "ring-2 ring-primary ring-offset-1" : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <input
          ref={pickerRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
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
