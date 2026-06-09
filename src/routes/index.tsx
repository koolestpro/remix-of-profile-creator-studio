import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Sparkles, Pencil, Trash2, ExternalLink, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  listProfiles,
  createProfile,
  deleteProfile,
  slugify,
  type StoredProfile,
} from "@/lib/profile-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Profiles — Link Profile Studio" },
      {
        name: "description",
        content:
          "Manage all your Linktree-style bio profiles in one place. Create, search, edit, and delete profiles.",
      },
    ],
  }),
  component: Portal,
});

function Portal() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");

  const refresh = () => setProfiles(listProfiles());

  useEffect(() => {
    refresh();
    setLoaded(true);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...profiles].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.profileName.toLowerCase().includes(q) ||
        p.businessName.toLowerCase().includes(q),
    );
  }, [profiles, query]);

  const handleCreate = () => {
    const name = newName.trim() || "Untitled Profile";
    const p = createProfile(name);
    setNewName("");
    toast.success(`Created “${p.profileName}”`);
    navigate({ to: "/edit/$id", params: { id: p.id } });
  };

  const handleDelete = (p: StoredProfile) => {
    if (!confirm(`Delete “${p.profileName}”? This cannot be undone.`)) return;
    deleteProfile(p.id);
    refresh();
    toast.success("Profile deleted");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Toaster richColors position="top-right" />

      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-foreground">
                Link Profile Studio
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage all your bio profiles
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-10">
        {/* Create + search */}
        <section
          className="overflow-hidden rounded-2xl p-6 shadow-elegant"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Create a new profile</h2>
              <p className="text-sm text-white/80">
                Give your profile a name to get started.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Juices4Life — Wembley Branch"
                className="h-11 flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/50"
              />
              <Button
                size="lg"
                onClick={handleCreate}
                className="h-11 bg-white px-6 font-semibold text-foreground shadow-md transition hover:bg-white/90"
              >
                <Plus className="mr-2 h-4 w-4" /> Create profile
              </Button>
            </div>
          </div>
        </section>

        {/* Profile list */}
        <section className="mt-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">
                Your profiles
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({profiles.length})
                </span>
              </h2>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by profile name…"
                className="pl-9"
              />
            </div>
          </div>

          {!loaded ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
              {profiles.length === 0
                ? "No profiles yet. Create your first one above."
                : "No profiles match your search."}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((p) => (
                <ProfileCard key={p.id} profile={p} onDelete={() => handleDelete(p)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ProfileCard({
  profile,
  onDelete,
}: {
  profile: StoredProfile;
  onDelete: () => void;
}) {
  const slug = slugify(profile.profileName);
  const updated = new Date(profile.updatedAt).toLocaleDateString();

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
      <div
        className="relative h-28"
        style={{
          background: profile.headerImage
            ? `url(${profile.headerImage}) center/cover`
            : profile.bgColor,
        }}
      >
        {profile.secondaryImage && (
          <div className="absolute bottom-0 left-4 h-12 w-12 translate-y-1/2 overflow-hidden rounded-full border-2 border-card bg-card">
            <img
              src={profile.secondaryImage}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 pt-7">
        <h3 className="truncate text-base font-semibold text-foreground">
          {profile.profileName}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {profile.businessName || "—"}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{profile.links.length} links</span>
          <span>•</span>
          <span>Updated {updated}</span>
        </div>
        <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
          /p/{slug}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link to="/edit/$id" params={{ id: profile.id }}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="px-2"
            title="Open public URL"
            onClick={() => window.open(`/p/${slug}`, "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="px-2 text-destructive hover:text-destructive"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
