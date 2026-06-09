import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Save, Eye, LayoutGrid, Smartphone, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ColorField } from "@/components/ColorField";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LinkEditor } from "@/components/LinkEditor";
import { PhonePreview } from "@/components/PhonePreview";
import type { ProfileData, LinkItem } from "@/lib/profile-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Link Profile Studio — Design your bio page" },
      {
        name: "description",
        content:
          "Design and manage Linktree-style bio profiles. Customize colors, images and links with a live phone preview.",
      },
    ],
  }),
  component: Dashboard,
});

const initialProfile: ProfileData = {
  headerImage: undefined,
  secondaryImage: undefined,
  businessName: "Juices4Life Harlesden",
  businessDescription: "Fuel your Life",
  bgColor: "#f4ead5",
  buttonColor: "#111111",
  mainButtonText: "View Menu",
  mainButtonUrl: "https://example.com/menu",
  links: [
    {
      id: crypto.randomUUID(),
      icon: "google",
      title: "Leave us a Google review",
      subtitle: "Share your experience",
      url: "https://google.com",
    },
    {
      id: crypto.randomUUID(),
      icon: "instagram",
      title: "Instagram",
      subtitle: "Follow us",
      url: "https://instagram.com",
    },
    {
      id: crypto.randomUUID(),
      icon: "tiktok",
      title: "TikTok",
      subtitle: "Follow us",
      url: "https://tiktok.com",
    },
    {
      id: crypto.randomUUID(),
      icon: "loyalty",
      title: "Join our Loyalty Programme",
      subtitle: "Earn rewards on every visit",
      url: "https://example.com",
    },
  ],
};

function Dashboard() {
  const [profile, setProfile] = useState<ProfileData>(initialProfile);

  const update = <K extends keyof ProfileData>(k: K, v: ProfileData[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const updateLink = (id: string, patch: Partial<LinkItem>) =>
    setProfile((p) => ({
      ...p,
      links: p.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));

  const addLink = () =>
    setProfile((p) => ({
      ...p,
      links: [
        ...p.links,
        {
          id: crypto.randomUUID(),
          icon: "website",
          title: "",
          subtitle: "",
          url: "",
        },
      ],
    }));

  const removeLink = (id: string) =>
    setProfile((p) => ({ ...p, links: p.links.filter((l) => l.id !== id) }));

  const moveLink = (id: string, dir: -1 | 1) =>
    setProfile((p) => {
      const i = p.links.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.links.length) return p;
      const links = [...p.links];
      [links[i], links[j]] = [links[j], links[i]];
      return { ...p, links };
    });

  return (
    <div className="min-h-screen bg-canvas">
      <Toaster richColors position="top-right" />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-lg text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-foreground">
                Link Profile Studio
              </h1>
              <p className="text-xs text-muted-foreground">
                Editing: {profile.businessName || "Untitled profile"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <LayoutGrid className="mr-2 h-4 w-4" /> All Profiles
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Button>
            <Button
              size="sm"
              onClick={() => toast.success("Profile saved")}
              style={{ background: "var(--gradient-primary)" }}
              className="text-white shadow-md"
            >
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Editor column */}
        <div className="space-y-6">
          {/* Branding */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
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
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-foreground">Full description</label>
              <Textarea
                value={profile.businessDescription}
                onChange={(e) => update("businessDescription", e.target.value)}
                placeholder="Tell visitors more about your business"
                rows={2}
              />
            </div>
          </section>

          {/* Theme */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
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

          {/* Main button link */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
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
          </section>

          {/* Links */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Links</h2>
                <p className="text-xs text-muted-foreground">
                  Add up to as many links as you need. Drag to reorder (coming soon).
                </p>
              </div>
              <Button onClick={addLink} size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add link
              </Button>
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
                  No links yet — click “Add link” to get started.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Phone preview column */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
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
