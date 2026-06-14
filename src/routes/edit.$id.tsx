import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Save, Eye, LayoutGrid, Smartphone, Sparkles, Trash2, Copy, Link2, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ColorField } from "@/components/ColorField";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LinkEditor } from "@/components/LinkEditor";
import { PhonePreview } from "@/components/PhonePreview";
import type { ProfileData, LinkItem } from "@/lib/profile-types";
import { ICON_DEFAULT_TEXT } from "@/lib/icon-registry";
import { getProfile, saveProfile, deleteProfile, slugify, uploadPdf } from "@/lib/profile-store";

export const Route = createFileRoute("/edit/$id")({
  head: () => ({
    meta: [{ title: "Edit Profile — Link Profile Studio" }],
  }),
  component: EditProfile,
});

function EditProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [origin, setOrigin] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

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
      } catch {
        if (active) setNotFound(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

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
          { id: crypto.randomUUID(), icon: "google" as const, title: def.title, subtitle: def.subtitle, url: "" },
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
    setSaving(true);
    try {
      const result = await saveProfile(id, profile);
      if (result === undefined) {
        // Supabase update matched 0 rows — profile doesn't exist in DB yet.
        // This happens if Supabase env vars are missing or migration not run.
        toast.error(
          "Save failed: profile not found in database. Check that VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set in Vercel and the DB migration has been run.",
          { duration: 10000 },
        );
        return;
      }
      toast.success(`Saved "${profile.profileName || "Untitled"}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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

  const slug = slugify(profile.profileName);
  const url = `${origin}/p/${slug}`;

  return (
    <div className="min-h-screen bg-canvas">
      <Toaster richColors position="top-right" />

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
                Editing: {profile.businessName || "Untitled profile"}
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
              onClick={async () => {
                // Persist current edits, then open the public page in a new tab
                // using the slug the store actually saved.
                const saved = await saveProfile(id, profile);
                const target = saved?.slug ?? slug;
                window.open(`/p/${target}`, "_blank", "noopener,noreferrer");
              }}
            >
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              style={{ background: "var(--gradient-primary)" }}
              className="text-white shadow-md"
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
        <div className="space-y-4 sm:space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Branding</h2>
            <p className="text-xs text-muted-foreground">
              Images and identity displayed at the top of your profile.
            </p>
            <div className="mt-5 space-y-5">
              <ImageUploadField
                label="Header image"
                hint="Recommended 1200×525px"
                value={profile.headerImage}
                onChange={(v) => update("headerImage", v)}
              />
              <ImageUploadField
                label="Secondary image / logo"
                hint="Square, 400×400px"
                value={profile.secondaryImage}
                onChange={(v) => update("secondaryImage", v)}
                aspect="square"
              />
            </div>
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
          </section>

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
            </div>
          </section>

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
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById("main-pdf-upload")?.click();
                }
              }}
              className="mt-4 cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 transition hover:border-primary hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {profile.mainButtonPdf ? "Replace PDF (menu)" : "Click to upload a PDF (menu)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    We'll host it at a unique URL and auto-fill the redirect above.
                  </p>
                  {profile.mainButtonPdfName && (
                    <p className="mt-1 text-xs text-foreground">📄 {profile.mainButtonPdfName}</p>
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
                      if (!file) return;
                      const toastId = toast.loading("Uploading PDF…");
                      try {
                        const url = await uploadPdf(id, file);
                        setProfile((p) =>
                          p
                            ? {
                                ...p,
                                mainButtonPdf: url,
                                mainButtonPdfName: file.name,
                                mainButtonUrl: `${window.location.origin}/pdf/${id}`,
                              }
                            : p,
                        );
                        toast.success("PDF uploaded — click Save to publish", { id: toastId });
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        toast.error(`PDF upload failed: ${msg}`, { id: toastId, duration: 8000 });
                      }
                    }}
                  />
                  {profile.mainButtonPdf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setProfile((p) =>
                          p ? { ...p, mainButtonPdf: undefined, mainButtonPdfName: undefined, mainButtonUrl: "" } : p
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
          </section>

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

          <section
            className="overflow-hidden rounded-2xl border border-border p-4 shadow-elegant sm:p-6"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <label className="text-sm font-medium text-white/90">QR Code design name</label>
                <Input
                  value={profile.profileName}
                  onChange={(e) => update("profileName", e.target.value)}
                  placeholder="e.g. Juices4Life — Harlesden Branch"
                  className="h-11 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/50"
                />
                <p className="text-xs text-white/70">
                  This name identifies your QR code design in your dashboard.
                </p>
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
                  className="h-12 flex-1 bg-white px-6 text-base font-semibold text-foreground shadow-lg transition hover:bg-white/90 md:min-w-[180px] md:flex-none md:px-8"
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
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" /> Your unique profile URL
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="flex-1 truncate font-mono text-xs text-foreground">
                {origin ? url : "Loading..."}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("URL copied to clipboard");
                  } catch {
                    toast.error("Couldn't copy. Select and copy manually.");
                  }
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" /> Live preview
            </div>
            <PhonePreview profile={profile} />
          </div>
        </aside>
      </main>
    </div>
  );
}
