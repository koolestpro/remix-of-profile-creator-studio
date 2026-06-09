import type { ProfileData } from "@/lib/profile-types";

export interface StoredProfile extends ProfileData {
  id: string;
  folderId?: string | null;
  updatedAt: number;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

const KEY = "lps:profiles:v3";
const FOLDERS_KEY = "lps:folders:v1";

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

function seedFolders(): Folder[] {
  const now = Date.now();
  return [
    { id: "folder-food", name: "Food & Drink", color: "#ef4444", createdAt: now },
    { id: "folder-wellness", name: "Wellness", color: "#10b981", createdAt: now },
    { id: "folder-retail", name: "Retail", color: "#6366f1", createdAt: now },
  ];
}

function seed(): StoredProfile[] {
  const now = Date.now();
  const samples: Array<{ name: string; business: string; tagline: string; bg: string; btn: string; folderId: string | null }> = [
    { name: "Juices4Life Profile", business: "Juices4Life Harlesden", tagline: "Fuel your Life", bg: "#f4ead5", btn: "#111111", folderId: "folder-food" },
    { name: "Bloom Coffee — Soho", business: "Bloom Coffee", tagline: "Slow brews, fast smiles", bg: "#fde8d4", btn: "#3b2417", folderId: "folder-food" },
    { name: "Pixel Barbers", business: "Pixel Barbers Camden", tagline: "Sharp fades since 2014", bg: "#1f2937", btn: "#fbbf24", folderId: null },
    { name: "Nori Sushi Bar", business: "Nori Sushi", tagline: "Fresh from the sea", bg: "#e0f2fe", btn: "#0c4a6e", folderId: "folder-food" },
    { name: "GreenLeaf Yoga", business: "GreenLeaf Studio", tagline: "Breathe. Move. Glow.", bg: "#dcfce7", btn: "#166534", folderId: "folder-wellness" },
    { name: "Vinyl & Vines", business: "Vinyl & Vines Wine Bar", tagline: "Records, wine, repeat", bg: "#fce7f3", btn: "#831843", folderId: "folder-food" },
    { name: "Forge Fitness", business: "Forge Strength Co.", tagline: "Train hard, live strong", bg: "#0f172a", btn: "#ef4444", folderId: "folder-wellness" },
    { name: "Petal & Stem", business: "Petal & Stem Florist", tagline: "Hand-tied with love", bg: "#fef3c7", btn: "#b45309", folderId: "folder-retail" },
    { name: "Crust Pizza Co.", business: "Crust Pizza — Shoreditch", tagline: "Wood-fired, always", bg: "#fee2e2", btn: "#991b1b", folderId: "folder-food" },
    { name: "Stride Sneakers", business: "Stride", tagline: "Step into something new", bg: "#ede9fe", btn: "#5b21b6", folderId: "folder-retail" },
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
    createdAt: now - idx * 86_400_000,
    updatedAt: now - idx * 3_600_000,
  }));
}

export function listFolders(): Folder[] {
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

function writeFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

const FOLDER_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#6366f1", "#8b5cf6", "#ec4899"];

export function createFolder(name: string): Folder {
  const all = listFolders();
  const folder: Folder = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled folder",
    color: FOLDER_COLORS[all.length % FOLDER_COLORS.length],
    createdAt: Date.now(),
  };
  all.push(folder);
  writeFolders(all);
  return folder;
}

export function deleteFolder(id: string) {
  writeFolders(listFolders().filter((f) => f.id !== id));
  // Move profiles in deleted folder to uncategorized
  const profiles = listProfiles().map((p) =>
    p.folderId === id ? { ...p, folderId: null } : p,
  );
  writeAll(profiles);
}

export function renameFolder(id: string, name: string) {
  const all = listFolders();
  const idx = all.findIndex((f) => f.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], name };
  writeFolders(all);
}

export function moveProfileToFolder(profileId: string, folderId: string | null) {
  const all = listProfiles();
  const idx = all.findIndex((p) => p.id === profileId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], folderId, updatedAt: Date.now() };
  writeAll(all);
}

export function listProfiles(): StoredProfile[] {
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

function writeAll(profiles: StoredProfile[]) {
  localStorage.setItem(KEY, JSON.stringify(profiles));
}

export function getProfile(id: string): StoredProfile | undefined {
  return listProfiles().find((p) => p.id === id);
}

export function createProfile(name: string): StoredProfile {
  const now = Date.now();
  const profile: StoredProfile = {
    ...createDefaultProfile(name),
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const all = listProfiles();
  all.push(profile);
  writeAll(all);
  return profile;
}

export function saveProfile(id: string, data: ProfileData): StoredProfile | undefined {
  const all = listProfiles();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...data, updatedAt: Date.now() };
  writeAll(all);
  return all[idx];
}

export function deleteProfile(id: string) {
  const all = listProfiles().filter((p) => p.id !== id);
  writeAll(all);
}

export function duplicateProfile(id: string): StoredProfile | undefined {
  const all = listProfiles();
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
  writeAll(all);
  return copy;
}

export function renameProfile(id: string, name: string) {
  const all = listProfiles();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], profileName: name, updatedAt: Date.now() };
  writeAll(all);
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
