import { GripVertical, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ICON_OPTIONS, renderIcon } from "@/lib/icon-registry";
import type { LinkItem, IconKey } from "@/lib/profile-types";

interface Props {
  link: LinkItem;
  index: number;
  onChange: (patch: Partial<LinkItem>) => void;
  onRemove: () => void;
}

export function LinkEditor({ link, index, onChange, onRemove }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ iconUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="group rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          Link #{index + 1}
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
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
            onValueChange={(v) => onChange({ icon: v as IconKey })}
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
          <Input
            placeholder="https://redirect-url.com"
            value={link.url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
