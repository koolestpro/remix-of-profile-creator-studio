import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  FolderInput,
  Inbox,
  MoreHorizontal,
  X,
  Pause,
  Play,
  Eye,
  Check,
  DownloadCloud,
  Download,
  LogOut,
  Loader2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listProfiles,
  createProfile,
  deleteProfile,
  deleteProfiles,
  setProfilesPaused,
  duplicateProfile,
  slugify,
  listFolders,
  createFolder,
  deleteFolder,
  renameFolder,
  moveProfileToFolder,
  moveProfilesToFolder,
  saveProfile,
  FOLDER_COLORS,
  countLocalProfiles,
  localImportDismissed,
  dismissLocalImport,
  importLocalData,
  type StoredProfile,
  type Folder,
} from "@/lib/profile-store";
import { useAuth } from "@/lib/auth";
import { useRequireAuth } from "@/lib/use-require-auth";

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
  const { configured, signOut } = useAuth();
  // Guard: redirect to /login when session expires or after sign out.
  // This also handles the browser back-button after logout.
  useRequireAuth();
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState<string>(FOLDER_COLORS[0]);
  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [pendingDelete, setPendingDelete] = useState<StoredProfile | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<Folder | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [creating, setCreating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [importDismissed, setImportDismissed] = useState(true);
  const [importing, setImporting] = useState(false);

  const refresh = async () => {
    try {
      const [p, f] = await Promise.all([listProfiles(), listFolders()]);
      setProfiles(p);
      setFolders(f);
    } catch {
      toast.error("Couldn't load your profiles.");
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoaded(true));
  }, []);

  // Offer to import any profiles saved locally (only once Supabase is on).
  useEffect(() => {
    if (configured) {
      setLocalCount(countLocalProfiles());
      setImportDismissed(localImportDismissed());
    }
  }, [configured]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await importLocalData();
      await refresh();
      setImportDismissed(true);
      toast.success(
        `Imported ${res.profiles} profile${res.profiles === 1 ? "" : "s"}` +
          (res.folders ? ` and ${res.folders} folder${res.folders === 1 ? "" : "s"}` : ""),
      );
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleDismissImport = () => {
    dismissLocalImport();
    setImportDismissed(true);
  };

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
        (p) => p.profileName.toLowerCase().includes(q) || p.businessName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [profiles, query, activeFolder]);

  const countFor = (id: string) => {
    if (id === ALL) return profiles.length;
    if (id === UNCATEGORIZED) return profiles.filter((p) => !p.folderId).length;
    return profiles.filter((p) => p.folderId === id).length;
  };

  const handleCreate = async () => {
    if (creating) return;
    const name = newName.trim();
    if (!name) {
      toast.error("Please enter a profile name first.");
      return;
    }
    setCreating(true);
    try {
      const p = await createProfile(name);
      if (activeFolder !== ALL && activeFolder !== UNCATEGORIZED) {
        await moveProfileToFolder(p.id, activeFolder);
      }
      setNewName("");
      toast.success(`Created “${p.profileName}”`);
      navigate({ to: "/edit/$id", params: { id: p.id } });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? JSON.stringify(err));
      toast.error(`Couldn't create profile: ${msg}`, { duration: 8000 });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (p: StoredProfile) => {
    setPendingDelete(p);
  };

  const confirmDeleteProfile = async () => {
    if (!pendingDelete) return;
    try {
      await deleteProfile(pendingDelete.id);
      await refresh();
      toast.success("Profile deleted");
    } catch {
      toast.error("Couldn't delete profile.");
    }
    setPendingDelete(null);
  };

  const handleDuplicate = async (p: StoredProfile) => {
    try {
      const copy = await duplicateProfile(p.id);
      if (copy) {
        await refresh();
        toast.success(`Duplicated as “${copy.profileName}”`);
      }
    } catch {
      toast.error("Couldn't duplicate profile.");
    }
  };

  const handleCopyUrl = async (p: StoredProfile) => {
    const url = `${window.location.origin}/p/${p.slug ?? slugify(p.profileName)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard");
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const f = await createFolder(name, newFolderColor);
      setNewFolderName("");
      setNewFolderColor(FOLDER_COLORS[0]);
      await refresh();
      setActiveFolder(f.id);
      toast.success(`Folder “${f.name}” created`);
    } catch {
      toast.error("Couldn't create folder.");
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await renameFolder(id, trimmed);
      await refresh();
      toast.success("Folder renamed");
    } catch {
      toast.error("Couldn't rename folder.");
    }
  };

  const handleDeleteFolder = (f: Folder) => {
    setPendingDeleteFolder(f);
  };

  const confirmDeleteFolder = async () => {
    if (!pendingDeleteFolder) return;
    try {
      await deleteFolder(pendingDeleteFolder.id);
      if (activeFolder === pendingDeleteFolder.id) setActiveFolder(ALL);
      await refresh();
      toast.success("Folder deleted");
    } catch {
      toast.error("Couldn't delete folder.");
    }
    setPendingDeleteFolder(null);
  };

  const handleRenameProfile = async (profile: StoredProfile, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Profile name is required.");
      return;
    }
    if (trimmed === profile.profileName) return;

    try {
      await saveProfile(profile.id, { ...profile, profileName: trimmed }, profile.slug);
      await refresh();
      toast.success("Profile renamed");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? JSON.stringify(err));
      toast.error(`Couldn't rename profile: ${msg}`, { duration: 8000 });
      throw err;
    }
  };

  const handleMoveToFolder = async (profileId: string, folderId: string | null) => {
    try {
      await moveProfileToFolder(profileId, folderId);
      await refresh();
      const folderName =
        folderId === null
          ? "Uncategorized"
          : (folders.find((f) => f.id === folderId)?.name ?? "folder");
      toast.success(`Moved to ${folderName}`);
    } catch {
      toast.error("Couldn't move profile.");
    }
  };

  const handleBulkMoveToFolder = async (folderId: string | null) => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    try {
      await moveProfilesToFolder(ids, folderId);
      await refresh();
      clearSelection();
      const folderName =
        folderId === null
          ? "Uncategorized"
          : (folders.find((f) => f.id === folderId)?.name ?? "folder");
      toast.success(`Moved ${ids.length} profile${ids.length === 1 ? "" : "s"} to ${folderName}`);
    } catch {
      toast.error("Couldn't move the selected profiles.");
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someVisibleSelected = !allVisibleSelected && filtered.some((p) => selected.has(p.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const selectedIds = useMemo(
    () => filtered.filter((p) => selected.has(p.id)).map((p) => p.id),
    [filtered, selected],
  );

  const allSelectedPaused =
    selectedIds.length > 0 && selectedIds.every((id) => profiles.find((p) => p.id === id)?.paused);

  const handleBulkPauseToggle = async () => {
    const newPaused = !allSelectedPaused;
    try {
      await setProfilesPaused(selectedIds, newPaused);
      await refresh();
      toast.success(
        `${selectedIds.length} profile${selectedIds.length === 1 ? "" : "s"} ${newPaused ? "paused" : "resumed"}`,
      );
    } catch {
      toast.error("Couldn't update profiles.");
    }
  };

  const confirmBulkDelete = async () => {
    const count = selectedIds.length;
    try {
      await deleteProfiles(selectedIds);
      clearSelection();
      await refresh();
      toast.success(`Deleted ${count} profile${count === 1 ? "" : "s"}`);
    } catch {
      toast.error("Couldn't delete profiles.");
    }
    setPendingBulkDelete(false);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas">
      <Toaster richColors position="bottom-center" />

      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-6">
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
              <p className="text-xs text-muted-foreground">Manage all your bio profiles</p>
            </div>
          </div>
          {configured && (
            <Button
              variant="outline"
              size="sm"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await signOut();
                } catch {
                  // Sign-out errors are non-fatal — clear local state and
                  // redirect regardless so the user is never stuck.
                  toast.error("Sign-out issue — you've been logged out locally.");
                } finally {
                  setSigningOut(false);
                }
                navigate({ to: "/login" });
              }}
            >
              {signingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Folders sidebar — below the profiles on mobile, beside them on desktop */}
        <aside className="order-2 space-y-4 lg:order-1 lg:sticky lg:top-6 lg:self-start">
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
              {folders.length > 0 && <div className="my-2 border-t border-border" />}
              {folders.map((f) => (
                <FolderItem
                  key={f.id}
                  active={activeFolder === f.id}
                  onClick={() => setActiveFolder(f.id)}
                  color={f.color}
                  label={f.name}
                  count={countFor(f.id)}
                  onDelete={() => handleDeleteFolder(f)}
                  onRename={(name) => handleRenameFolder(f.id, name)}
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
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {FOLDER_COLORS.map((c) => {
                const selected = newFolderColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewFolderColor(c)}
                    aria-label={`Use ${c} for this folder`}
                    aria-pressed={selected}
                    className="grid h-4 w-4 place-items-center rounded-full transition hover:scale-110"
                    style={{
                      background: c,
                      boxShadow: selected ? `0 0 0 1.5px var(--card), 0 0 0 3px ${c}` : undefined,
                    }}
                  >
                    {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="order-1 min-w-0 lg:order-2">
          {/* Import local profiles */}
          {configured && !importDismissed && localCount > 0 && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <DownloadCloud className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {localCount} profile{localCount === 1 ? "" : "s"} saved on this device
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Import them into your account so they sync across every device.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismissImport}
                  disabled={importing}
                >
                  Dismiss
                </Button>
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  <DownloadCloud className="mr-1.5 h-3.5 w-3.5" />
                  {importing ? "Importing…" : "Import"}
                </Button>
              </div>
            </div>
          )}

          {/* Create profile */}
          <section
            className="overflow-hidden rounded-2xl p-6 shadow-elegant"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Create a new profile</h2>
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
                  disabled={creating}
                  className="h-11 bg-white px-6 font-semibold text-foreground shadow-md transition hover:bg-white/90 active:scale-95"
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {creating ? "Creating…" : "Create profile"}
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
                      : (folders.find((f) => f.id === activeFolder)?.name ?? "Profiles")}
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
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={
                        allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                      }
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all profiles"
                    />
                    Select all
                    {selectedIds.length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        ({selectedIds.length} selected)
                      </span>
                    )}
                  </label>
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            <FolderInput className="mr-1.5 h-3.5 w-3.5" /> Move to folder
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuLabel>
                            Move {selectedIds.length} selected to
                          </DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleBulkMoveToFolder(null)}>
                            <Inbox className="mr-2 h-4 w-4" /> Uncategorized
                          </DropdownMenuItem>
                          {folders.map((f) => (
                            <DropdownMenuItem
                              key={f.id}
                              onClick={() => handleBulkMoveToFolder(f.id)}
                            >
                              <span
                                className="mr-2 h-3 w-3 rounded-sm"
                                style={{ background: f.color }}
                              />
                              {f.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="sm" variant="outline" onClick={handleBulkPauseToggle}>
                        {allSelectedPaused ? (
                          <>
                            <Play className="mr-1.5 h-3.5 w-3.5" /> Resume
                          </>
                        ) : (
                          <>
                            <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                          </>
                        )}
                      </Button>
                      {!allVisibleSelected && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setPendingBulkDelete(true)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearSelection}
                        title="Clear selection"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {filtered.map((p) => (
                  <ProfileCard
                    key={p.id}
                    profile={p}
                    folders={folders}
                    selected={selected.has(p.id)}
                    onToggleSelect={() => toggleSelected(p.id)}
                    onDelete={() => handleDelete(p)}
                    onDuplicate={() => handleDuplicate(p)}
                    onCopyUrl={() => handleCopyUrl(p)}
                    onMoveToFolder={(folderId) => handleMoveToFolder(p.id, folderId)}
                    onRename={(name) => handleRenameProfile(p, name)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">“{pendingDelete?.profileName}”</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProfile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDeleteFolder}
        onOpenChange={(o) => !o && setPendingDeleteFolder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete folder{" "}
              <span className="font-medium text-foreground">“{pendingDeleteFolder?.name}”</span>?
              Profiles inside will move to Uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBulkDelete} onOpenChange={(o) => !o && setPendingBulkDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {selectedIds.length} profile{selectedIds.length === 1 ? "" : "s"}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  onRename,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon?: React.ReactNode;
  label: string;
  count: number;
  onDelete?: () => void;
  onRename?: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const startEditing = () => {
    setDraft(label);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (onRename && next && next !== label) onRename(next);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-white"
          style={{ background: color }}
        >
          {icon ?? <FolderIcon className="h-3 w-3" />}
        </span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commit}
          className="h-6 flex-1 rounded border border-border bg-background px-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={commit}
          title="Save"
          className="text-muted-foreground hover:text-foreground"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <button onClick={onClick} className="flex flex-1 items-center gap-2 truncate text-left">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-white"
          style={{ background: color }}
        >
          {icon ?? <FolderIcon className="h-3 w-3" />}
        </span>
        <span className="flex-1 truncate">{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>
      {onRename && (
        <button
          onClick={startEditing}
          className="opacity-0 transition group-hover:opacity-100"
          title="Rename folder"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
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
  selected,
  onToggleSelect,
  onDelete,
  onDuplicate,
  onCopyUrl,
  onMoveToFolder,
  onRename,
}: {
  profile: StoredProfile;
  folders: Folder[];
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopyUrl: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onRename: (name: string) => Promise<void>;
}) {
  const slug = profile.slug ?? slugify(profile.profileName);
  const updated = new Date(profile.updatedAt).toLocaleDateString();
  const currentFolder = folders.find((f) => f.id === profile.folderId);
  const [qrOpen, setQrOpen] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.profileName);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (!editingName) setNameDraft(profile.profileName);
  }, [editingName, profile.profileName]);

  const qrTarget = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${slug}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=${encodeURIComponent(qrTarget)}`;
  const qrLarge = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=8&data=${encodeURIComponent(qrTarget)}`;
  const qrDownload = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&margin=12&format=png&data=${encodeURIComponent(qrTarget)}`;

  const handleDownloadQr = async () => {
    try {
      const res = await fetch(qrDownload);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("QR code downloaded");
    } catch {
      toast.error("Couldn't download QR. Try again.");
    }
  };

  const handleCopyQrImage = async () => {
    try {
      const res = await fetch(qrDownload);
      const blob = await res.blob();
      // @ts-ignore ClipboardItem may not be typed in all envs
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopiedImage(true);
      toast.success("QR image copied to clipboard");
      setTimeout(() => setCopiedImage(false), 1500);
    } catch {
      toast.error("Image copy not supported. Use Download instead.");
    }
  };

  const cancelRename = () => {
    setNameDraft(profile.profileName);
    setEditingName(false);
  };

  const submitRename = async () => {
    const next = nameDraft.trim();
    if (!next) {
      toast.error("Profile name is required.");
      return;
    }
    if (next === profile.profileName) {
      setEditingName(false);
      return;
    }

    setRenaming(true);
    try {
      await onRename(next);
      setEditingName(false);
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div
      className={`group flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:gap-4 sm:pr-4 ${
        selected ? "border-primary ring-1 ring-primary/40" : "border-border"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          title="View QR code"
          className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1 transition hover:ring-2 hover:ring-primary/40 ${
            profile.paused ? "opacity-40 grayscale" : ""
          }`}
        >
          <img
            src={qrSrc}
            alt={`QR code for ${profile.profileName}`}
            className="h-full w-full object-contain"
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {editingName ? (
              <form
                className="flex min-w-[220px] flex-1 items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitRename();
                }}
              >
                <Input
                  value={nameDraft}
                  autoFocus
                  disabled={renaming}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelRename();
                  }}
                  className="h-8 text-sm"
                  aria-label="Profile name"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  disabled={renaming}
                  className="h-8 w-8 p-0"
                  title="Save profile name"
                >
                  {renaming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={renaming}
                  onClick={cancelRename}
                  className="h-8 w-8 p-0"
                  title="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </form>
            ) : (
              <div className="flex min-w-0 items-center gap-1">
                <Link
                  to="/edit/$id"
                  params={{ id: profile.id }}
                  className="truncate text-sm font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  {profile.profileName}
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title="Rename profile"
                  aria-label={`Rename ${profile.profileName}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <span className="truncate text-xs text-muted-foreground">
              · {profile.businessName || "—"}
            </span>
            {profile.paused && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Paused
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Updated {updated}</span>
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1" title="Total views">
              <Eye className="h-3.5 w-3.5" />
              {(profile.scanCount ?? 0).toLocaleString()} view
              {(profile.scanCount ?? 0) === 1 ? "" : "s"}
            </span>
            {currentFolder && (
              <>
                <span className="hidden sm:inline">•</span>
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
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
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
          title="Open customer view"
          onClick={() => window.open(`/p/${slug}`, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
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
            <Button size="sm" variant="outline" className="px-2" title="More options">
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
                <span className="mr-2 h-3 w-3 rounded-sm" style={{ background: f.color }} />
                {f.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.open(`/p/${slug}`, "_blank")}>
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
        <label
          className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          title="Select profile"
        >
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${profile.profileName}`}
          />
          Select
        </label>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate">{profile.profileName}</DialogTitle>
            <DialogDescription>Scan, copy, or download this QR code.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border border-border bg-white p-4">
              <img
                src={qrLarge}
                alt={`Large QR code for ${profile.profileName}`}
                className="h-64 w-64 object-contain"
              />
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button onClick={handleCopyQrImage} variant="outline" className="flex-1">
                <Copy className="mr-2 h-4 w-4" />
                {copiedImage ? "Copied!" : "Copy QR image"}
              </Button>
              <Button onClick={handleDownloadQr} className="flex-1">
                <Download className="mr-2 h-4 w-4" /> Save QR code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
