import { useRef } from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

// EyeDropper API typing
declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

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
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          className="h-10 w-12 shrink-0 rounded-md border border-border shadow-sm transition hover:scale-105"
          style={{ backgroundColor: value }}
          aria-label={`Pick color for ${label}`}
        />
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
