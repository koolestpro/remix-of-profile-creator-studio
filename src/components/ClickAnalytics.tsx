import {
  addDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subYears,
} from "date-fns";
import {
  BarChart3,
  Calendar as CalendarIcon,
  MousePointerClick,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ICON_COLORS, renderIcon } from "@/lib/icon-registry";
import {
  getClickAnalytics,
  MAIN_BUTTON_CLICK_ID,
  type ClickAnalyticsResult,
} from "@/lib/profile-store";
import type { LinkItem } from "@/lib/profile-types";

type Preset = "today" | "yesterday" | "7d" | "30d" | "week" | "month" | "year" | "custom";
type CompareMode = "none" | "previous" | "year";

const PRESET_LABEL: Record<Preset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  week: "This week",
  month: "This month",
  year: "This year",
  custom: "Custom range",
};

const PRESET_ORDER: Preset[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "week",
  "month",
  "year",
  "custom",
];

/** `to` is always exclusive (start of the day after the last included day),
 *  so range queries can use a simple `>= from AND < to`. */
function presetRange(preset: Preset, custom?: DateRange): { from: Date; to: Date } {
  const now = new Date();
  const tomorrow = addDays(startOfDay(now), 1);
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: tomorrow };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: startOfDay(now) };
    }
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: tomorrow };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to: tomorrow };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: tomorrow };
    case "month":
      return { from: startOfMonth(now), to: tomorrow };
    case "year":
      return { from: startOfYear(now), to: tomorrow };
    case "custom": {
      const from = custom?.from ? startOfDay(custom.from) : startOfDay(now);
      const to = custom?.to ? addDays(startOfDay(custom.to), 1) : addDays(from, 1);
      return { from, to };
    }
  }
}

function compareRangeFor(
  range: { from: Date; to: Date },
  mode: CompareMode,
): { from: Date; to: Date } | undefined {
  if (mode === "none") return undefined;
  if (mode === "year") return { from: subYears(range.from, 1), to: subYears(range.to, 1) };
  const lengthMs = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - lengthMs), to: range.from };
}

const chartConfig: ChartConfig = {
  clicks: { label: "Clicks", color: "var(--color-chart-1)" },
};

interface Props {
  profileId: string;
  links: LinkItem[];
  /** Label for the main CTA button (e.g. "View Menu"), shown as its own row
   *  in the breakdown so main-button taps are distinguishable from link taps. */
  mainButtonText?: string;
}

export function ClickAnalytics({ profileId, links, mainButtonText }: Props) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [data, setData] = useState<ClickAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => presetRange(preset, customRange), [preset, customRange]);
  const compareRangeValue = useMemo(
    () => compareRangeFor(range, compareMode),
    [range, compareMode],
  );

  const fromTime = range.from.getTime();
  const toTime = range.to.getTime();
  const compareFromTime = compareRangeValue?.from.getTime();
  const compareToTime = compareRangeValue?.to.getTime();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getClickAnalytics(
      profileId,
      { from: new Date(fromTime), to: new Date(toTime) },
      compareFromTime !== undefined && compareToTime !== undefined
        ? { from: new Date(compareFromTime), to: new Date(compareToTime) }
        : undefined,
    )
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setData({ total: 0, series: [], byLink: [] });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profileId, fromTime, toTime, compareFromTime, compareToTime]);

  const delta =
    data?.compareTotal !== undefined && data.compareTotal > 0
      ? ((data.total - data.compareTotal) / data.compareTotal) * 100
      : data?.compareTotal === 0 && (data?.total ?? 0) > 0
        ? 100
        : null;

  const linkLookup = useMemo(() => new Map(links.map((l) => [l.id, l])), [links]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MousePointerClick className="h-4 w-4" /> Link Clicks
          </h2>
          <p className="text-xs text-muted-foreground">
            How often visitors tap the main button and links on this profile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_ORDER.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {PRESET_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === "custom" && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {customRange?.from
                    ? customRange.to && customRange.to.getTime() !== customRange.from.getTime()
                      ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d, yyyy")}`
                      : format(customRange.from, "MMM d, yyyy")
                    : "Pick dates"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                />
              </PopoverContent>
            </Popover>
          )}

          <Select value={compareMode} onValueChange={(v) => setCompareMode(v as CompareMode)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                No comparison
              </SelectItem>
              <SelectItem value="previous" className="text-xs">
                Vs. previous period
              </SelectItem>
              <SelectItem value="year" className="text-xs">
                Vs. same period last year
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <div className="text-3xl font-bold tabular-nums text-foreground">
            {loading ? "—" : (data?.total ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            total click{(data?.total ?? 0) === 1 ? "" : "s"} in this period
          </div>
        </div>
        {!loading && delta !== null && (
          <div
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              delta >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {Math.abs(delta).toFixed(0)}% vs. {(data?.compareTotal ?? 0).toLocaleString()}{" "}
            previously
          </div>
        )}
      </div>

      <div className="mt-4">
        {!loading && data && data.series.length > 0 ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
            <BarChart data={data.series}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(v: string) => format(new Date(`${v}T00:00:00`), "MMM d")}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => format(new Date(`${v}T00:00:00`), "PPP")}
                  />
                }
              />
              <Bar dataKey="clicks" fill="var(--color-clicks)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="grid h-[100px] place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            {loading ? "Loading…" : "No clicks recorded in this period yet."}
          </p>
        )}
      </div>

      {!loading && data && data.byLink.length > 0 && (
        <div className="mt-5 space-y-1.5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Clicks by button/link</p>
          {data.byLink.map((row) => {
            const isMainButton = row.linkId === MAIN_BUTTON_CLICK_ID;
            const link = isMainButton ? undefined : linkLookup.get(row.linkId);
            const accent = isMainButton
              ? "#111111"
              : link
                ? (ICON_COLORS[link.icon] ?? "#6B7280")
                : "#6B7280";
            const label = isMainButton
              ? mainButtonText || "Main button"
              : (link?.title ?? "(deleted link)");
            return (
              <div
                key={row.linkId}
                className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm"
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded"
                  style={{ backgroundColor: `${accent}1A` }}
                >
                  {isMainButton ? (
                    <Star className="h-3.5 w-3.5" style={{ color: accent }} />
                  ) : link ? (
                    renderIcon(link.icon, "h-3.5 w-3.5")
                  ) : (
                    <BarChart3 className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {label}
                  {isMainButton && (
                    <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Main button
                    </span>
                  )}
                </span>
                <span className="tabular-nums font-medium text-foreground">
                  {row.clicks.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
