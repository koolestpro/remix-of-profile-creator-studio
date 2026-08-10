import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useDeferredValue } from "react";
import {
  Plus,
  Save,
  Eye,
  LayoutGrid,
  Smartphone,
  Sparkles,
  Trash2,
  Copy,
  ExternalLink,
  Link2,
  ArrowLeft,
  Loader2,
  Pencil,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  IdCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ClickAnalytics } from "@/components/ClickAnalytics";
import { ColorField } from "@/components/ColorField";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LinkEditor } from "@/components/LinkEditor";
import { PhonePreview } from "@/components/PhonePreview";
import type {
  ProfileData,
  LinkItem,
  ProfileType,
  CardData,
  SocialItem,
  IconKey,
} from "@/lib/profile-types";
import { createDefaultCardData } from "@/lib/profile-types";
import { ICON_DEFAULT_TEXT, SOCIAL_ICON_OPTIONS, renderIcon } from "@/lib/icon-registry";
import { useRequireAuth } from "@/lib/use-require-auth";
import {
  getProfile,
  saveProfile,
  deleteProfile,
  slugify,
  uploadPdf,
  uploadImage,
  generateUniquePdfCode,
  setProfileSlug,
} from "@/lib/profile-store";

export const Route = createFileRoute("/edit/$id")({
  head: () => ({
    meta: [{ title: "Edit Profile — Link Profile Studio" }],
  }),
  component: EditProfile,
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Toast copy for a finished PDF upload — surfaces whether/how much the
 *  auto-compressor (see pdf-compress.ts) actually shrank the file, so it's
 *  never a silent, invisible step. Only mentions it when the reduction is
 *  large enough to matter (small rounding-level differences stay quiet). */
function pdfUploadToastMessage(originalSize: number, uploadedSize: number): string {
  const shrunkMeaningfully = uploadedSize < originalSize * 0.97;
  if (!shrunkMeaningfully) return "PDF uploaded — click Save to publish";
  const pct = Math.round(100 * (1 - uploadedSize / originalSize));
  return `PDF uploaded — compressed ${formatFileSize(originalSize)} → ${formatFileSize(uploadedSize)} (${pct}% smaller). Click Save to publish`;
}

function EditProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  // Guard: if Supabase is configured and the session has expired, bounce to
  // /login instead of letting saves/uploads fail with a cryptic RLS error.
  const { ready: authReady } = useRequireAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  // Track the saved slug so we can skip the slug uniqueness DB query on saves
  // where the profile name hasn't changed (cuts save time roughly in half).
  const [savedSlug, setSavedSlug] = useState<string | undefined>();
  const [origin, setOrigin] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [uploadingLinkId, setUploadingLinkId] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);

  // Defer the phone preview so rapid keystrokes don't block the input.
  // React will finish the input re-render first, then update the preview.
  const deferredProfile = useDeferredValue(profile);

  useEffect(() => {
    setOrigin(window.location.origin);
    let active = true;
    (async () => {
      try {
        const p = await getProfile(id);
        if (!active) return;
        if (!p) {
          setNotFound(true);
          return;
        }
        setProfile(p);
        setSavedSlug(p.slug);
      } catch {
        if (active) setNotFound(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (!authReady) {
    return <div className="min-h-screen bg-canvas" />;
  }

  if (notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="text-center">
          <p className="mb-4 text-sm text-muted-foreground">Profile not found.</p>
          <Button onClick={() => navigate({ to: "/" })}>Back to portal</Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="min-h-screen bg-canvas" />;
  }

  const update = <K extends keyof ProfileData>(k: K, v: ProfileData[K]) =>
    setProfile((p) => (p ? { ...p, [k]: v } : p));

  const isCard = profile.profileType === "card";
  const card: CardData = { ...createDefaultCardData(), ...(profile.cardData ?? {}) };

  /** Patches a single business-card field, seeding defaults on first edit. */
  const updateCard = <K extends keyof CardData>(k: K, v: CardData[K]) =>
    setProfile((p) =>
      p ? { ...p, cardData: { ...createDefaultCardData(), ...(p.cardData ?? {}), [k]: v } } : p,
    );

  const updateSocial = (sid: string, patch: Partial<SocialItem>) =>
    updateCard(
      "socials",
      card.socials.map((s) => (s.id === sid ? { ...s, ...patch } : s)),
    );

  const addSocial = () =>
    updateCard("socials", [
      ...card.socials,
      { id: crypto.randomUUID(), icon: "instagram" as IconKey, url: "" },
    ]);

  const removeSocial = (sid: string) =>
    updateCard(
      "socials",
      card.socials.filter((s) => s.id !== sid),
    );

  const moveSocial = (sid: string, dir: -1 | 1) => {
    const i = card.socials.findIndex((s) => s.id === sid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= card.socials.length) return;
    const next = [...card.socials];
    [next[i], next[j]] = [next[j], next[i]];
    updateCard("socials", next);
  };

  const updateLink = (lid: string, patch: Partial<LinkItem>) =>
    setProfile((p) =>
      p ? { ...p, links: p.links.map((l) => (l.id === lid ? { ...l, ...patch } : l)) } : p,
    );

  const addLink = () =>
    setProfile((p) => {
      if (!p) return p;
      const def = ICON_DEFAULT_TEXT["google"];
      return {
        ...p,
        links: [
          ...p.links,
          {
            id: crypto.randomUUID(),
            icon: "google" as const,
            title: def.title,
            subtitle: def.subtitle,
            url: "",
          },
        ],
      };
    });

  const removeLink = (lid: string) =>
    setProfile((p) => (p ? { ...p, links: p.links.filter((l) => l.id !== lid) } : p));

  const moveLink = (lid: string, dir: -1 | 1) =>
    setProfile((p) => {
      if (!p) return p;
      const i = p.links.findIndex((l) => l.id === lid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.links.length) return p;
      const links = [...p.links];
      [links[i], links[j]] = [links[j], links[i]];
      return { ...p, links };
    });

  const handleSave = async () => {
    if (!profile.profileName.trim()) {
      toast.error("Profile name is required. Please name your QR code design before saving.");
      document.getElementById("profile-name-input")?.focus();
      return;
    }
    setSaving(true);
    try {
      const result = await saveProfile(id, profile, savedSlug);
      if (result === undefined) {
        // Supabase update matched 0 rows — profile doesn't exist in DB yet.
        // This happens if Supabase env vars are missing or migration not run.
        toast.error(
          "Save failed: profile not found in database. Check that VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set in Vercel and the DB migration has been run.",
          { duration: 10000 },
        );
        return;
      }
      if (result.slug) setSavedSlug(result.slug);
      toast.success(`Saved "${profile.profileName || "Untitled"}"`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? JSON.stringify(err));
      // Surface the real error (e.g. missing DB columns → run migration)
      toast.error(`Couldn't save: ${msg}`, { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${profile.profileName}"? This cannot be undone.`)) return;
    try {
      await deleteProfile(id);
      toast.success("Profile deleted");
      navigate({ to: "/" });
    } catch {
      toast.error("Couldn't delete. Please try again.");
    }
  };

  // The public URL is locked to the slug assigned on first save (see
  // saveProfile) and does NOT change when the name is edited afterwards.
  // Fall back to a live slugify only for a brand-new, never-saved profile
  // that doesn't have one yet.
  const slug = savedSlug || slugify(profile.profileName);
  const url = `${origin}/p/${slug}`;

  const startEditSlug = () => {
    setSlugDraft(slug);
    setEditingSlug(true);
  };

  const cancelEditSlug = () => {
    setEditingSlug(false);
    setSlugDraft("");
  };

  const confirmEditSlug = async () => {
    const next = slugify(slugDraft);
    if (!next || next === slug) {
      cancelEditSlug();
      return;
    }
    setSlugSaving(true);
    try {
      const finalSlug = await setProfileSlug(id, next);
      setSavedSlug(finalSlug);
      toast.success("URL updated");
      setEditingSlug(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't update the URL.";
      toast.error(msg);
    } finally {
      setSlugSaving(false);
    }
  };

  const handlePdfUpload = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }

    const toastId = toast.loading("Uploading PDF…");
    try {
      const { url: pdfUrl, originalSize, uploadedSize } = await uploadPdf(id, file);
      // Reuse an existing code on re-upload; otherwise mint a readable, unique
      // one from the business/QR name, e.g. "JUICES4LIFE2343" → /pdf/JUICES4LIFE2343.
      const code =
        profile.pdfCode ||
        (await generateUniquePdfCode(profile.businessName || profile.profileName));
      setProfile((p) =>
        p
          ? {
              ...p,
              mainButtonPdf: pdfUrl,
              mainButtonPdfName: file.name,
              pdfCode: code,
              mainButtonUrl: `${window.location.origin}/pdf/${code}`,
            }
          : p,
      );
      toast.success(pdfUploadToastMessage(originalSize, uploadedSize), {
        id: toastId,
        duration: 5000,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? JSON.stringify(err));
      toast.error(`PDF upload failed: ${msg}`, { id: toastId, duration: 8000 });
    }
  };

  const handleLinkPdfUpload = async (linkId: string, file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }

    const link = profile.links.find((l) => l.id === linkId);
    const toastId = toast.loading("Uploading PDF…");
    setUploadingLinkId(linkId);
    try {
      const { url: pdfUrl, originalSize, uploadedSize } = await uploadPdf(id, file);
      // Reuse an existing code on re-upload; otherwise mint a readable, unique
      // one for this link, e.g. "MENU4821" → /pdf/MENU4821.
      const code =
        link?.pdfCode ||
        (await generateUniquePdfCode(profile.businessName || link?.title || "link"));
      updateLink(linkId, {
        pdfUrl,
        pdfName: file.name,
        pdfCode: code,
        url: `${window.location.origin}/pdf/${code}`,
      });
      toast.success(pdfUploadToastMessage(originalSize, uploadedSize), {
        id: toastId,
        duration: 5000,
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? JSON.stringify(err));
      toast.error(`PDF upload failed: ${msg}`, { id: toastId, duration: 8000 });
    } finally {
      setUploadingLinkId(null);
    }
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas">
      <Toaster richColors position="bottom-center" />

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight text-foreground">
                Link Profile Studio
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Editing: {profile.businessName || profile.profileName || "Untitled"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> All Profiles
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild className="sm:hidden">
              <Link to="/" aria-label="All Profiles">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              disabled={previewing || saving}
              onClick={async () => {
                if (!profile.profileName.trim()) {
                  toast.error("Profile name is required. Please name your QR code design first.");
                  document.getElementById("profile-name-input")?.focus();
                  return;
                }
                // Open the tab synchronously (inside the click) so the browser
                // doesn't block it as a pop-up after the async save. Paint a
                // small loading page instead of leaving the user on about:blank.
                const win = window.open("", "_blank");
                if (win) {
                  win.document.write(
                    `<!doctype html><meta charset="utf-8"><title>Opening preview…</title>` +
                      `<body style="margin:0;height:100vh;display:grid;place-items:center;` +
                      `font-family:system-ui,sans-serif;color:#6b7280;background:#f7f1e1">` +
                      `Opening preview…</body>`,
                  );
                }
                setPreviewing(true);
                try {
                  const saved = await saveProfile(id, profile, savedSlug);
                  if (saved?.slug) setSavedSlug(saved.slug);
                  const target = saved?.slug ?? slug;
                  if (win) win.location.href = `/p/${target}`;
                  else window.open(`/p/${target}`, "_blank", "noopener,noreferrer");
                } catch {
                  win?.close();
                  toast.error("Couldn't open preview. Please try again.");
                } finally {
                  setPreviewing(false);
                }
              }}
            >
              {previewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Preview
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              style={{ background: "var(--gradient-primary)" }}
              className="text-white shadow-md transition active:scale-95"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <Save className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">{saving ? "Saving…" : "Save Changes"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-3 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          {/* Public link — first thing in the column so it's reachable without
           *  scrolling, alongside the sticky preview on the right. */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" /> Your unique profile URL
            </div>
            {editingSlug ? (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                <div className="mb-1.5 truncate font-mono text-[11px] text-muted-foreground">
                  {origin}/p/
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEditSlug();
                      if (e.key === "Escape") cancelEditSlug();
                    }}
                    className="h-9 min-w-0 flex-1 bg-background font-mono text-xs"
                    placeholder="custom-url"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0"
                    title="Save URL"
                    disabled={slugSaving}
                    onClick={confirmEditSlug}
                  >
                    {slugSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5 sm:mr-1.5" />
                    )}
                    <span className="hidden sm:inline">Save</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0"
                    title="Cancel"
                    disabled={slugSaving}
                    onClick={cancelEditSlug}
                  >
                    <X className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {origin ? url : "Loading..."}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    title="Edit URL"
                    onClick={startEditSlug}
                  >
                    <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    title="Copy public URL"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("URL copied to clipboard");
                      } catch {
                        toast.error("Couldn't copy. Select and copy manually.");
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Copy</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    title="Open the live page in a new tab"
                    onClick={() => window.open(`/p/${slug}`, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Open link</span>
                  </Button>
                </div>
              </div>
            )}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Renaming this profile won't change the URL — edit it here if you want the link to
              match a new name. Only do this before sharing the link or printing a QR code.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Format</h2>
                <p className="text-xs text-muted-foreground">
                  Switch layouts any time — each format keeps its own content, so nothing is lost
                  when you switch back.
                </p>
              </div>
              <Select
                value={profile.profileType ?? "landing"}
                onValueChange={(v) => update("profileType", v as ProfileType)}
              >
                <SelectTrigger className="w-full sm:w-[190px]" aria-label="Profile format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landing">Landing page</SelectItem>
                  <SelectItem value="card">Business card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Branding</h2>
            <p className="text-xs text-muted-foreground">
              Images and identity displayed at the top of your profile.
            </p>
            <div className="mt-5 space-y-5">
              <ImageUploadField
                label={isCard ? "Main banner image or video" : "Header image or video"}
                hint="Recommended 1200×525px, or a short looping video"
                value={profile.headerImage}
                onChange={(v) => update("headerImage", v)}
                onUpload={(file) => uploadImage(id, file)}
                onError={(msg) => toast.error(`Upload failed: ${msg}`, { duration: 8000 })}
                acceptVideo
              />
              <ImageUploadField
                label={isCard ? "Second photo (profile picture)" : "Secondary image / logo"}
                hint="Square, 400×400px"
                value={profile.secondaryImage}
                onChange={(v) => {
                  update("secondaryImage", v);
                  // Reset zoom on a fresh upload so it doesn't inherit the
                  // previous image's crop.
                  if (v) update("secondaryImageZoom", 100);
                }}
                aspect="square"
                onUpload={(file) => uploadImage(id, file)}
                onError={(msg) => toast.error(`Image upload failed: ${msg}`, { duration: 8000 })}
              />
              {profile.secondaryImage && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">Logo zoom / crop</label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {profile.secondaryImageZoom ?? 100}%
                    </span>
                  </div>
                  <Slider
                    value={[profile.secondaryImageZoom ?? 100]}
                    min={100}
                    max={200}
                    step={10}
                    onValueChange={([v]) => update("secondaryImageZoom", v)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Drag right to zoom in if the logo looks too zoomed out or cut off in the circle.
                  </p>
                </div>
              )}
            </div>
            {isCard ? (
              <div className="mt-5 space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Company / organisation
                </label>
                <Input
                  value={profile.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  placeholder="Northlight Studio"
                />
                <p className="text-xs text-muted-foreground">
                  Not shown on the card itself — saved into the contact file as the company, so it
                  lands in the visitor's phonebook.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Business name</label>
                  <Input
                    value={profile.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                    placeholder="Your business"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tagline</label>
                  <Input
                    value={profile.businessDescription}
                    onChange={(e) => update("businessDescription", e.target.value)}
                    placeholder="Short description"
                  />
                </div>
              </div>
            )}
          </section>

          {/* ----- Business card only ----- */}
          {isCard && (
            <>
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">Card details</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  The name, title and action button shown under the photo.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Full name</label>
                    <Input
                      value={card.fullName}
                      onChange={(e) => updateCard("fullName", e.target.value)}
                      placeholder="Maya Okonkwo"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Business and title
                    </label>
                    <Input
                      value={card.jobTitle}
                      onChange={(e) => updateCard("jobTitle", e.target.value)}
                      placeholder="Founder & CEO"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">
                      Save contact button text
                    </label>
                    <Input
                      value={card.saveContactText}
                      onChange={(e) => updateCard("saveContactText", e.target.value)}
                      placeholder="Save contact"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tapping this downloads a contact file with the name, title, phone, email,
                      website and address below — it saves straight into the visitor's contacts.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-foreground">About me</h2>
                <p className="text-xs text-muted-foreground">
                  The pill heading and the description underneath it.
                </p>
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Heading</label>
                    <Input
                      value={card.aboutHeading}
                      onChange={(e) => updateCard("aboutHeading", e.target.value)}
                      placeholder="About Me"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <Textarea
                      value={card.aboutText}
                      onChange={(e) => updateCard("aboutText", e.target.value)}
                      placeholder="A short paragraph about who you are and what you do."
                      rows={4}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-foreground">Contact me</h2>
                <p className="text-xs text-muted-foreground">
                  Leave any field blank to hide that row. Phone, email and website are tappable.
                </p>
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Heading</label>
                    <Input
                      value={card.contactHeading}
                      onChange={(e) => updateCard("contactHeading", e.target.value)}
                      placeholder="Contact me"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Phone <span className="text-muted-foreground">— taps to call</span>
                      </label>
                      <Input
                        type="tel"
                        value={card.phone}
                        onChange={(e) => updateCard("phone", e.target.value)}
                        placeholder="+44 7700 900123"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Email <span className="text-muted-foreground">— taps to email</span>
                      </label>
                      <Input
                        type="email"
                        value={card.email}
                        onChange={(e) => updateCard("email", e.target.value)}
                        placeholder="you@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Location <span className="text-muted-foreground">— text only</span>
                      </label>
                      <Input
                        value={card.location}
                        onChange={(e) => updateCard("location", e.target.value)}
                        placeholder="221B Baker Street, London"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Website <span className="text-muted-foreground">— opens the site</span>
                      </label>
                      <Input
                        value={card.website}
                        onChange={(e) => updateCard("website", e.target.value)}
                        placeholder="yourcompany.com"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-foreground">Social media icons</h2>
                <p className="text-xs text-muted-foreground">
                  Shown in the "Find me on" grid at the bottom of the card.
                </p>
                <div className="mt-5 space-y-3">
                  {card.socials.map((social, i) => (
                    <div
                      key={social.id}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg">
                        {social.iconUrl ? (
                          <img
                            src={social.iconUrl}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          renderIcon(social.icon, "h-full w-full object-contain")
                        )}
                      </span>
                      <Select
                        value={social.icon}
                        onValueChange={(v) => updateSocial(social.id, { icon: v as IconKey })}
                      >
                        <SelectTrigger className="w-full sm:w-[160px]" aria-label="Platform">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOCIAL_ICON_OPTIONS.map((o) => (
                            <SelectItem key={o.key} value={o.key}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={social.url}
                        onChange={(e) => updateSocial(social.id, { url: e.target.value })}
                        placeholder="https://instagram.com/yourhandle"
                        className="flex-1"
                      />
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === 0}
                          onClick={() => moveSocial(social.id, -1)}
                          title="Move up"
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === card.socials.length - 1}
                          onClick={() => moveSocial(social.id, 1)}
                          title="Move down"
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeSocial(social.id)}
                          title="Remove"
                          aria-label="Remove social link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {card.socials.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
                      No social icons yet — click "Add social icon" to get started.
                    </p>
                  )}
                  <Button onClick={addSocial} size="sm" className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add social icon
                  </Button>
                </div>
              </section>
            </>
          )}

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Theme</h2>
            <p className="text-xs text-muted-foreground">
              Pick a color from anywhere on your screen with the eyedropper, or open the picker.
            </p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <ColorField
                label="Main background color"
                value={profile.bgColor}
                onChange={(v) => update("bgColor", v)}
              />
              <ColorField
                label="Button color"
                value={profile.buttonColor}
                onChange={(v) => update("buttonColor", v)}
              />
              <ColorField
                label={
                  isCard
                    ? "Text color (name, title, description)"
                    : "Text color (name, tagline, powered by)"
                }
                value={profile.textColor}
                onChange={(v) => update("textColor", v)}
              />
              <ColorField
                label={
                  isCard ? "Text color inside buttons" : "Action text color (View Menu & Share)"
                }
                value={profile.actionTextColor}
                onChange={(v) => update("actionTextColor", v)}
              />
            </div>
          </section>

          {/* ----- Landing page only ----- */}
          {!isCard && (
            <>
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Main Button Link</h2>
                    <p className="text-xs text-muted-foreground">
                      The primary call-to-action displayed above your links.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title="Remove main button"
                    onClick={() => {
                      update("mainButtonText", "");
                      update("mainButtonUrl", "");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Button text</label>
                    <Input
                      value={profile.mainButtonText}
                      onChange={(e) => update("mainButtonText", e.target.value)}
                      placeholder="View Menu"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Redirect URL</label>
                    <Input
                      value={profile.mainButtonUrl}
                      onChange={(e) => update("mainButtonUrl", e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => document.getElementById("main-pdf-upload")?.click()}
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
                    void handlePdfUpload(e.dataTransfer.files?.[0]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      document.getElementById("main-pdf-upload")?.click();
                    }
                  }}
                  className={`mt-4 cursor-pointer rounded-lg border-2 border-dashed bg-muted/30 p-4 transition hover:border-primary hover:bg-muted/50 ${
                    pdfDragOver
                      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {profile.mainButtonPdf
                          ? "Replace PDF (menu)"
                          : "Click to upload a PDF (menu)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        We'll host it at a unique URL and auto-fill the redirect above. Click or
                        drag and drop a PDF here.
                      </p>
                      {profile.mainButtonPdfName && (
                        <p className="mt-1 text-xs text-foreground">
                          📄 {profile.mainButtonPdfName}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        id="main-pdf-upload"
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          await handlePdfUpload(file);
                        }}
                      />
                      {profile.mainButtonPdf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            setProfile((p) =>
                              p
                                ? {
                                    ...p,
                                    mainButtonPdf: undefined,
                                    mainButtonPdfName: undefined,
                                    mainButtonUrl: "",
                                  }
                                : p,
                            )
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Links</h2>
                  <p className="text-xs text-muted-foreground">
                    Add up to as many links as you need.
                  </p>
                </div>
                <div className="mt-5 space-y-3">
                  {profile.links.map((link, i) => (
                    <LinkEditor
                      key={link.id}
                      link={link}
                      index={i}
                      total={profile.links.length}
                      onChange={(patch) => updateLink(link.id, patch)}
                      onRemove={() => removeLink(link.id)}
                      onMove={(dir) => moveLink(link.id, dir)}
                      onUploadPdf={(file) => handleLinkPdfUpload(link.id, file)}
                      uploadingPdf={uploadingLinkId === link.id}
                    />
                  ))}
                  {profile.links.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">
                      No links yet — click "Add link" to get started.
                    </p>
                  )}
                  <Button onClick={addLink} size="sm" className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add link
                  </Button>
                </div>
              </section>
            </>
          )}

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Show "Powered by Tap and Rate"
                </h2>
                <p className="text-xs text-muted-foreground">
                  Display the Tap and Rate badge at the bottom of your public profile.
                </p>
              </div>
              <Switch
                checked={profile.showPoweredBy !== false}
                onCheckedChange={(v) => update("showPoweredBy", v)}
              />
            </div>
            {profile.showPoweredBy !== false && (
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Badge logo color</label>
                  <p className="text-xs text-muted-foreground">
                    Pick blue for light backgrounds, white for dark ones — so the badge is never
                    invisible.
                  </p>
                </div>
                <Select
                  value={profile.poweredByLogo ?? "blue"}
                  onValueChange={(v) => update("poweredByLogo", v as "blue" | "white")}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blue logo</SelectItem>
                    <SelectItem value="white">White logo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>

          {!isCard && (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Show menu button</h2>
                  <p className="text-xs text-muted-foreground">
                    Display the menu icon at the top-left of your public profile (next to Share).
                  </p>
                </div>
                <Switch
                  checked={profile.showMenuButton !== false}
                  onCheckedChange={(v) => update("showMenuButton", v)}
                />
              </div>
            </section>
          )}

          <section
            className="overflow-hidden rounded-2xl border border-border p-4 shadow-elegant sm:p-6"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor="profile-name-input" className="text-sm font-medium text-white/90">
                  QR Code design name <span className="text-white">*</span>
                </label>
                <Input
                  id="profile-name-input"
                  value={profile.profileName}
                  onChange={(e) => update("profileName", e.target.value)}
                  placeholder="e.g. Juices4Life — Harlesden Branch"
                  aria-invalid={!profile.profileName.trim()}
                  className={`h-11 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/50 ${
                    profile.profileName.trim()
                      ? "border-white/20"
                      : "border-red-300 ring-1 ring-red-300/60"
                  }`}
                />
                {profile.profileName.trim() ? (
                  <p className="text-xs text-white/70">
                    This name identifies your QR code design in your dashboard.
                  </p>
                ) : (
                  <p className="text-xs font-medium text-red-100">
                    Profile name is required to save.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleDelete}
                  className="h-12 flex-1 border-white/30 bg-transparent text-white hover:bg-white/10 md:flex-none"
                >
                  <Trash2 className="mr-2 h-5 w-5" /> Delete
                </Button>
                <Button
                  size="lg"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-12 flex-1 bg-white px-6 text-base font-semibold text-foreground shadow-lg transition hover:bg-white/90 active:scale-95 md:min-w-[180px] md:flex-none md:px-8"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  {saving ? "Saving…" : "Save Design"}
                </Button>
              </div>
            </div>
          </section>

          <ClickAnalytics
            profileId={id}
            links={profile.links}
            mainButtonText={profile.mainButtonText}
          />
        </div>

        {/* Preview column — sticky so clients can see the phone without
         *  scrolling. On short viewports the panel scrolls internally rather
         *  than letting the phone get clipped by the fold. */}
        <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" /> Live preview
            </div>
            <PhonePreview profile={deferredProfile ?? profile} />
          </div>
        </aside>
      </main>
    </div>
  );
}
