import type { ProfileData, LinkItem } from "@/lib/profile-types";
import { supabase } from "@/lib/supabase";

export interface StoredProfile extends ProfileData {
  id: string;
  slug?: string;
  folderId?: string | null;
  paused?: boolean;
  scanCount?: number;
  updatedAt: number;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

const KEY = "lps:profiles:v4";
const FOLDERS_KEY = "lps:folders:v2";

export function createDefaultProfile(name = "Untitled Profile"): ProfileData {
  return {
    profileName: name,
    headerImage: undefined,
    secondaryImage: undefined,
    businessName: name,
    businessDescription: "",
    bgColor: "#f4ead5",
    buttonColor: "#111111",
    mainButtonText: "View Menu",
    mainButtonUrl: "",
    links: [],
  };
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}

export const FOLDER_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#10b981",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#64748b",
];

/* ============================================================
 * Supabase row <-> StoredProfile mapping
 * ============================================================ */

interface ProfileRow {
  id: string;
  slug: string;
  profile_name: string;
  folder_id: string | null;
  header_image: string | null;
  secondary_image: string | null;
  business_name: string;
  business_description: string;
  bg_color: string;
  button_color: string;
  main_button_text: string;
  main_button_url: string;
  links: LinkItem[] | null;
  paused: boolean;
  scan_count: number;
  created_at: string;
  updated_at: string;
}

interface FolderRow {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

function rowToProfile(r: ProfileRow): StoredProfile {
  return {
    id: r.id,
    slug: r.slug,
    folderId: r.folder_id,
    paused: r.paused,
    scanCount: r.scan_count,
    profileName: r.profile_name,
    headerImage: r.header_image ?? undefined,
    secondaryImage: r.secondary_image ?? undefined,
    businessName: r.business_name,
    businessDescription: r.business_description,
    bgColor: r.bg_color,
    buttonColor: r.button_color,
    mainButtonText: r.main_button_text,
    mainButtonUrl: r.main_button_url,
    links: Array.isArray(r.links) ? r.links : [],
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

/** Build a DB row payload from profile data (omits id/timestamps). */
function profileDataToRow(data: ProfileData) {
  return {
    profile_name: data.profileName,
    header_image: data.headerImage ?? null,
    secondary_image: data.secondaryImage ?? null,
    business_name: data.businessName,
    business_description: data.businessDescription,
    bg_color: data.bgColor,
    button_color: data.buttonColor,
    main_button_text: data.mainButtonText,
    main_button_url: data.mainButtonUrl,
    links: data.links,
  };
}

function rowToFolder(r: FolderRow): Folder {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    createdAt: new Date(r.created_at).getTime(),
  };
}

/** Find a slug not already taken by another profile (Supabase only). */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  if (!supabase) return base || "untitled";
  const root = base || "untitled";
  let candidate = root;
  let n = 1;
  // Bounded loop — realistically resolves in 1-2 iterations.
  for (let i = 0; i < 1000; i++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    if (error) throw error;
    const hit = data?.[0] as { id: string } | undefined;
    if (!hit || hit.id === excludeId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

/* ============================================================
 * localStorage implementation (fallback when Supabase is off)
 * ============================================================ */

function seedFolders(): Folder[] {
  const now = Date.now();
  return [
    { id: "folder-younis", name: "Younis", color: "#ef4444", createdAt: now },
    { id: "folder-adnan", name: "Adnan", color: "#3b82f6", createdAt: now },
    { id: "folder-talah", name: "Talah", color: "#10b981", createdAt: now },
    { id: "folder-juices4life", name: "Juices4Life", color: "#f59e0b", createdAt: now },
  ];
}

function seed(): StoredProfile[] {
  const now = Date.now();
  const samples: Array<{ name: string; business: string; tagline: string; bg: string; btn: string; folderId: string | null }> = [
    { name: "Juices4Life Profile", business: "Juices4Life Harlesden", tagline: "Fuel your Life", bg: "#f4ead5", btn: "#111111", folderId: "folder-juices4life" },
    { name: "Bloom Coffee — Soho", business: "Bloom Coffee", tagline: "Slow brews, fast smiles", bg: "#fde8d4", btn: "#3b2417", folderId: "folder-younis" },
    { name: "Pixel Barbers", business: "Pixel Barbers Camden", tagline: "Sharp fades since 2014", bg: "#1f2937", btn: "#fbbf24", folderId: "folder-adnan" },
    { name: "Nori Sushi Bar", business: "Nori Sushi", tagline: "Fresh from the sea", bg: "#e0f2fe", btn: "#0c4a6e", folderId: "folder-talah" },
    { name: "GreenLeaf Yoga", business: "GreenLeaf Studio", tagline: "Breathe. Move. Glow.", bg: "#dcfce7", btn: "#166534", folderId: "folder-younis" },
    { name: "Vinyl & Vines", business: "Vinyl & Vines Wine Bar", tagline: "Records, wine, repeat", bg: "#fce7f3", btn: "#831843", folderId: "folder-adnan" },
    { name: "Forge Fitness", business: "Forge Strength Co.", tagline: "Train hard, live strong", bg: "#0f172a", btn: "#ef4444", folderId: "folder-talah" },
    { name: "Petal & Stem", business: "Petal & Stem Florist", tagline: "Hand-tied with love", bg: "#fef3c7", btn: "#b45309", folderId: null },
    { name: "Crust Pizza Co.", business: "Crust Pizza — Shoreditch", tagline: "Wood-fired, always", bg: "#fee2e2", btn: "#991b1b", folderId: "folder-juices4life" },
    { name: "Stride Sneakers", business: "Stride", tagline: "Step into something new", bg: "#ede9fe", btn: "#5b21b6", folderId: "folder-adnan" },
  ];
  const iconPool: Array<"google" | "instagram" | "tiktok" | "facebook" | "whatsapp" | "website" | "loyalty"> = [
    "google", "instagram", "tiktok", "facebook", "whatsapp", "website", "loyalty",
  ];
  return samples.map((s, idx) => ({
    ...createDefaultProfile(s.name),
    id: crypto.randomUUID(),
    folderId: s.folderId,
    profileName: s.name,
    businessName: s.business,
    businessDescription: s.tagline,
    bgColor: s.bg,
    buttonColor: s.btn,
    mainButtonText: "View Menu",
    mainButtonUrl: "https://example.com",
    links: Array.from({ length: 3 + (idx % 3) }, (_, i) => ({
      id: crypto.randomUUID(),
      icon: iconPool[(idx + i) % iconPool.length],
      title: `Link ${i + 1}`,
      subtitle: "Tap to open",
      url: "https://example.com",
    })),
    scanCount: (idx * 37 + 12) % 540,
    createdAt: now - idx * 86_400_000,
    updatedAt: now - idx * 3_600_000,
  }));
}

function localListFolders(): Folder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) {
      const seeded = seedFolders();
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as Folder[];
  } catch {
    return [];
  }
}

function localWriteFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

function localListProfiles(): StoredProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seeded = seed();
      localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as StoredProfile[];
  } catch {
    return [];
  }
}

function localWriteProfiles(profiles: StoredProfile[]) {
  localStorage.setItem(KEY, JSON.stringify(profiles));
}

/* ============================================================
 * Public API — async, Supabase-backed with localStorage fallback
 * ============================================================ */

export async function listFolders(): Promise<Folder[]> {
  if (!supabase) return localListFolders();
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as FolderRow[]).map(rowToFolder);
}

export async function createFolder(name: string, color?: string): Promise<Folder> {
  const cleanName = name.trim() || "Untitled folder";
  if (!supabase) {
    const all = localListFolders();
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: cleanName,
      color: color ?? FOLDER_COLORS[all.length % FOLDER_COLORS.length],
      createdAt: Date.now(),
    };
    all.push(folder);
    localWriteFolders(all);
    return folder;
  }
  const { data, error } = await supabase
    .from("folders")
    .insert({ name: cleanName, color: color ?? FOLDER_COLORS[0] })
    .select()
    .single();
  if (error) throw error;
  return rowToFolder(data as FolderRow);
}

export async function deleteFolder(id: string): Promise<void> {
  if (!supabase) {
    localWriteFolders(localListFolders().filter((f) => f.id !== id));
    const profiles = localListProfiles().map((p) =>
      p.folderId === id ? { ...p, folderId: null } : p,
    );
    localWriteProfiles(profiles);
    return;
  }
  // profiles.folder_id is ON DELETE SET NULL, so the DB reassigns them.
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw error;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  if (!supabase) {
    const all = localListFolders();
    const idx = all.findIndex((f) => f.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], name };
    localWriteFolders(all);
    return;
  }
  const { error } = await supabase.from("folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function moveProfileToFolder(
  profileId: string,
  folderId: string | null,
): Promise<void> {
  if (!supabase) {
    const all = localListProfiles();
    const idx = all.findIndex((p) => p.id === profileId);
    if (idx === -1) return;
    all[idx] = { ...all[idx], folderId, updatedAt: Date.now() };
    localWriteProfiles(all);
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ folder_id: folderId })
    .eq("id", profileId);
  if (error) throw error;
}

export async function listProfiles(): Promise<StoredProfile[]> {
  if (!supabase) return localListProfiles();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ProfileRow[]).map(rowToProfile);
}

export async function getProfile(id: string): Promise<StoredProfile | undefined> {
  if (!supabase) return localListProfiles().find((p) => p.id === id);
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : undefined;
}

export async function getProfileBySlug(
  slug: string,
): Promise<StoredProfile | undefined> {
  if (!supabase) {
    return localListProfiles().find((p) => slugify(p.profileName) === slug);
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : undefined;
}

export async function createProfile(name: string): Promise<StoredProfile> {
  if (!supabase) {
    const now = Date.now();
    const profile: StoredProfile = {
      ...createDefaultProfile(name),
      id: crypto.randomUUID(),
      scanCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const all = localListProfiles();
    all.push(profile);
    localWriteProfiles(all);
    return profile;
  }
  const data = createDefaultProfile(name);
  const slug = await uniqueSlug(slugify(name));
  const { data: row, error } = await supabase
    .from("profiles")
    .insert({ ...profileDataToRow(data), slug })
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(row as ProfileRow);
}

export async function saveProfile(
  id: string,
  data: ProfileData,
): Promise<StoredProfile | undefined> {
  if (!supabase) {
    const all = localListProfiles();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...data, updatedAt: Date.now() };
    localWriteProfiles(all);
    return all[idx];
  }
  const slug = await uniqueSlug(slugify(data.profileName), id);
  const { data: row, error } = await supabase
    .from("profiles")
    .update({ ...profileDataToRow(data), slug, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return row ? rowToProfile(row as ProfileRow) : undefined;
}

export async function deleteProfile(id: string): Promise<void> {
  if (!supabase) {
    localWriteProfiles(localListProfiles().filter((p) => p.id !== id));
    return;
  }
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteProfiles(ids: string[]): Promise<void> {
  if (!supabase) {
    const set = new Set(ids);
    localWriteProfiles(localListProfiles().filter((p) => !set.has(p.id)));
    return;
  }
  const { error } = await supabase.from("profiles").delete().in("id", ids);
  if (error) throw error;
}

export async function setProfilesPaused(
  ids: string[],
  paused: boolean,
): Promise<void> {
  if (!supabase) {
    const set = new Set(ids);
    const now = Date.now();
    localWriteProfiles(
      localListProfiles().map((p) =>
        set.has(p.id) ? { ...p, paused, updatedAt: now } : p,
      ),
    );
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ paused })
    .in("id", ids);
  if (error) throw error;
}

export async function duplicateProfile(
  id: string,
): Promise<StoredProfile | undefined> {
  if (!supabase) {
    const all = localListProfiles();
    const src = all.find((p) => p.id === id);
    if (!src) return undefined;
    const now = Date.now();
    const copy: StoredProfile = {
      ...src,
      id: crypto.randomUUID(),
      profileName: `${src.profileName} (Copy)`,
      links: src.links.map((l) => ({ ...l, id: crypto.randomUUID() })),
      createdAt: now,
      updatedAt: now,
    };
    all.push(copy);
    localWriteProfiles(all);
    return copy;
  }
  const src = await getProfile(id);
  if (!src) return undefined;
  const name = `${src.profileName} (Copy)`;
  const slug = await uniqueSlug(slugify(name));
  const data: ProfileData = {
    profileName: name,
    headerImage: src.headerImage,
    secondaryImage: src.secondaryImage,
    businessName: src.businessName,
    businessDescription: src.businessDescription,
    bgColor: src.bgColor,
    buttonColor: src.buttonColor,
    mainButtonText: src.mainButtonText,
    mainButtonUrl: src.mainButtonUrl,
    links: src.links.map((l) => ({ ...l, id: crypto.randomUUID() })),
  };
  const { data: row, error } = await supabase
    .from("profiles")
    .insert({ ...profileDataToRow(data), slug, folder_id: src.folderId ?? null })
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(row as ProfileRow);
}

export async function renameProfile(id: string, name: string): Promise<void> {
  if (!supabase) {
    const all = localListProfiles();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], profileName: name, updatedAt: Date.now() };
    localWriteProfiles(all);
    return;
  }
  const slug = await uniqueSlug(slugify(name), id);
  const { error } = await supabase
    .from("profiles")
    .update({ profile_name: name, slug, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Bump a profile's view counter by one. */
export async function incrementScan(profile: {
  id: string;
  slug?: string;
  profileName: string;
}): Promise<void> {
  if (!supabase) {
    const all = localListProfiles();
    const idx = all.findIndex((p) => p.id === profile.id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], scanCount: (all[idx].scanCount ?? 0) + 1 };
    localWriteProfiles(all);
    return;
  }
  const slug = profile.slug ?? slugify(profile.profileName);
  const { error } = await supabase.rpc("increment_scan", { p_slug: slug });
  if (error) throw error;
}

/* ============================================================
 * One-time import: localStorage → Supabase
 * ============================================================ */

const IMPORT_FLAG = "lps:imported:v1";

/** Number of profiles sitting in this browser's localStorage (no seeding). */
export function countLocalProfiles(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    return (JSON.parse(raw) as StoredProfile[]).length;
  } catch {
    return 0;
  }
}

/** Whether the import banner has already been actioned/dismissed. */
export function localImportDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(IMPORT_FLAG) === "1";
}

export function dismissLocalImport(): void {
  if (typeof window !== "undefined") localStorage.setItem(IMPORT_FLAG, "1");
}

/**
 * Copies the profiles + folders saved in this browser's localStorage into
 * Supabase, preserving folder membership and view counts. Folders get fresh
 * IDs (old → new are mapped), and slugs are de-duplicated. Sets the dismissed
 * flag when done so it only runs once.
 */
export async function importLocalData(): Promise<{
  profiles: number;
  folders: number;
}> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const rawProfiles =
    typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  const rawFolders =
    typeof window !== "undefined" ? localStorage.getItem(FOLDERS_KEY) : null;
  const localProfiles: StoredProfile[] = rawProfiles
    ? JSON.parse(rawProfiles)
    : [];
  const localFolders: Folder[] = rawFolders ? JSON.parse(rawFolders) : [];

  // 1) Folders first — remember old → new id so profiles can re-link.
  const folderIdMap = new Map<string, string>();
  for (const f of localFolders) {
    const { data, error } = await supabase
      .from("folders")
      .insert({ name: f.name, color: f.color })
      .select()
      .single();
    if (error) throw error;
    folderIdMap.set(f.id, (data as FolderRow).id);
  }

  // 2) Profiles, with mapped folder + unique slug.
  let imported = 0;
  for (const p of localProfiles) {
    const data: ProfileData = {
      profileName: p.profileName,
      headerImage: p.headerImage,
      secondaryImage: p.secondaryImage,
      businessName: p.businessName,
      businessDescription: p.businessDescription,
      bgColor: p.bgColor,
      buttonColor: p.buttonColor,
      mainButtonText: p.mainButtonText,
      mainButtonUrl: p.mainButtonUrl,
      links: p.links,
    };
    const slug = await uniqueSlug(slugify(p.profileName));
    const folderId = p.folderId ? folderIdMap.get(p.folderId) ?? null : null;
    const { error } = await supabase.from("profiles").insert({
      ...profileDataToRow(data),
      slug,
      folder_id: folderId,
      paused: p.paused ?? false,
      scan_count: p.scanCount ?? 0,
    });
    if (error) throw error;
    imported += 1;
  }

  dismissLocalImport();
  return { profiles: imported, folders: localFolders.length };
}
