import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Sparkles,
  Pencil,
  Trash2,
  ExternalLink,
  LayoutGrid,
  Copy,
  CopyPlus,
  Folder as FolderIcon,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listProfiles,
  createProfile,
  deleteProfile,
  duplicateProfile,
  slugify,
  listFolders,
  createFolder,
  deleteFolder,
  moveProfileToFolder,
  type StoredProfile,
  type Folder,
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

const ALL = "__all__";
const UNCATEGORIZED = "__uncategorized__";

function Portal() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [pendingDelete, setPendingDelete] = useState<StoredProfile | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<Folder | null>(null);

  const refresh = () => {
    setProfiles(listProfiles());
    setFolders(listFolders());
  };

  useEffect(() => {
    refresh();
    setLoaded(true);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...profiles].sort((a, b) => b.updatedAt - a.updatedAt);
    if (activeFolder === UNCATEGORIZED) {
      list = list.filter((p) => !p.folderId);
    } else if (activeFolder !== ALL) {
      list = list.filter((p) => p.folderId === activeFolder);
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.profileName.toLowerCase().includes(q) ||
          p.businessName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [profiles, query, activeFolder]);

  const countFor = (id: string) => {
    if (id === ALL) return profiles.length;
    if (id === UNCATEGORIZED) return profiles.filter((p) => !p.folderId).length;
    return profiles.filter((p) => p.folderId === id).length;
  };

  const handleCreate = () => {
    const name = newName.trim() || "Untitled Profile";
    const p = createProfile(name);
    if (activeFolder !== ALL && activeFolder !== UNCATEGORIZED) {
      moveProfileToFolder(p.id, activeFolder);
    }
    setNewName("");
    toast.success(`Created “${p.profileName}”`);
    navigate({ to: "/edit/$id", params: { id: p.id } });
  };

  const handleDelete = (p: StoredProfile) => {
    setPendingDelete(p);
  };

  const confirmDeleteProfile = () => {
    if (!pendingDelete) return;
    deleteProfile(pendingDelete.id);
    refresh();
    toast.success("Profile deleted");
    setPendingDelete(null);
  };

  const handleDuplicate = (p: StoredProfile) => {
    const copy = duplicateProfile(p.id);
    if (copy) {
      refresh();
      toast.success(`Duplicated as “${copy.profileName}”`);
    }
  };

  const handleCopyUrl = async (p: StoredProfile) => {
    const url = `${window.location.origin}/p/${slugify(p.profileName)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard");
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const f = createFolder(name);
    setNewFolderName("");
    refresh();
    setActiveFolder(f.id);
    toast.success(`Folder “${f.name}” created`);
  };

  const handleDeleteFolder = (f: Folder) => {
    if (
      !confirm(
        `Delete folder “${f.name}”? Profiles inside will move to Uncategorized.`,
      )
    )
      return;
    deleteFolder(f.id);
    if (activeFolder === f.id) setActiveFolder(ALL);
    refresh();
    toast.success("Folder deleted");
  };

  const handleMoveToFolder = (profileId: string, folderId: string | null) => {
    moveProfileToFolder(profileId, folderId);
    refresh();
    const folderName =
      folderId === null
        ? "Uncategorized"
        : folders.find((f) => f.id === folderId)?.name ?? "folder";
    toast.success(`Moved to ${folderName}`);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Toaster richColors position="top-right" />

      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
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

      <main className="mx-auto grid max-w-[1400px] gap-6 px-6 py-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Folders sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FolderIcon className="h-4 w-4" /> Folders
            </h2>
            <nav className="space-y-1">
              <FolderItem
                active={activeFolder === ALL}
                onClick={() => setActiveFolder(ALL)}
                color="#64748b"
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
                label="All profiles"
                count={countFor(ALL)}
              />
              <FolderItem
                active={activeFolder === UNCATEGORIZED}
                onClick={() => setActiveFolder(UNCATEGORIZED)}
                color="#94a3b8"
                icon={<Inbox className="h-3.5 w-3.5" />}
                label="Uncategorized"
                count={countFor(UNCATEGORIZED)}
              />
              {folders.length > 0 && (
                <div className="my-2 border-t border-border" />
              )}
              {folders.map((f) => (
                <FolderItem
                  key={f.id}
                  active={activeFolder === f.id}
                  onClick={() => setActiveFolder(f.id)}
                  color={f.color}
                  label={f.name}
                  count={countFor(f.id)}
                  onDelete={() => handleDeleteFolder(f)}
                />
              ))}
            </nav>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <FolderPlus className="h-3.5 w-3.5" /> New folder
            </h3>
            <div className="flex gap-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="Folder name"
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div>
          {/* Create profile */}
          <section
            className="overflow-hidden rounded-2xl p-6 shadow-elegant"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Create a new profile
                </h2>
                <p className="text-sm text-white/80">
                  {activeFolder === ALL || activeFolder === UNCATEGORIZED
                    ? "Give your profile a name to get started."
                    : `Will be added to “${folders.find((f) => f.id === activeFolder)?.name}”.`}
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
                  {activeFolder === ALL
                    ? "All profiles"
                    : activeFolder === UNCATEGORIZED
                      ? "Uncategorized"
                      : folders.find((f) => f.id === activeFolder)?.name ??
                        "Profiles"}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filtered.length})
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
                  : "No profiles match this view."}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((p) => (
                  <ProfileCard
                    key={p.id}
                    profile={p}
                    folders={folders}
                    onDelete={() => handleDelete(p)}
                    onDuplicate={() => handleDuplicate(p)}
                    onCopyUrl={() => handleCopyUrl(p)}
                    onMoveToFolder={(folderId) =>
                      handleMoveToFolder(p.id, folderId)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function FolderItem({
  active,
  onClick,
  color,
  icon,
  label,
  count,
  onDelete,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon?: React.ReactNode;
  label: string;
  count: number;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-2 truncate text-left"
      >
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-white"
          style={{ background: color }}
        >
          {icon ?? <FolderIcon className="h-3 w-3" />}
        </span>
        <span className="flex-1 truncate">{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 transition group-hover:opacity-100"
          title="Delete folder"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  folders,
  onDelete,
  onDuplicate,
  onCopyUrl,
  onMoveToFolder,
}: {
  profile: StoredProfile;
  folders: Folder[];
  onDelete: () => void;
  onDuplicate: () => void;
  onCopyUrl: () => void;
  onMoveToFolder: (folderId: string | null) => void;
}) {
  const slug = slugify(profile.profileName);
  const updated = new Date(profile.updatedAt).toLocaleDateString();
  const currentFolder = folders.find((f) => f.id === profile.folderId);

  const qrTarget = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${slug}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=${encodeURIComponent(qrTarget)}`;

  return (
    <div className="group flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-card p-3 pr-4 shadow-sm transition hover:shadow-md">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1">
        <img
          src={qrSrc}
          alt={`QR code for ${profile.profileName}`}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {profile.profileName}
          </h3>
          <span className="truncate text-xs text-muted-foreground">
            · {profile.businessName || "—"}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Updated {updated}</span>
          {currentFolder && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: currentFolder.color }}
                />
                {currentFolder.name}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm">
          <Link to="/edit/$id" params={{ id: profile.id }}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-2"
          title="Copy public URL"
          onClick={onCopyUrl}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-2"
          title="Duplicate profile"
          onClick={onDuplicate}
        >
          <CopyPlus className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="px-2"
              title="More options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
              <Inbox className="mr-2 h-4 w-4" /> Uncategorized
            </DropdownMenuItem>
            {folders.map((f) => (
              <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(f.id)}>
                <span
                  className="mr-2 h-3 w-3 rounded-sm"
                  style={{ background: f.color }}
                />
                {f.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.open(`/p/${slug}`, "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Open public URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete profile
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
