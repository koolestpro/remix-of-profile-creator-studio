import type { ProfileData } from "@/lib/profile-types";

export interface StoredProfile extends ProfileData {
  id: string;
  updatedAt: number;
  createdAt: number;
}

const KEY = "lps:profiles:v2";

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

function seed(): StoredProfile[] {
  const now = Date.now();
  const samples: Array<{ name: string; business: string; tagline: string; bg: string; btn: string }> = [
    { name: "Juices4Life Profile", business: "Juices4Life Harlesden", tagline: "Fuel your Life", bg: "#f4ead5", btn: "#111111" },
    { name: "Bloom Coffee — Soho", business: "Bloom Coffee", tagline: "Slow brews, fast smiles", bg: "#fde8d4", btn: "#3b2417" },
    { name: "Pixel Barbers", business: "Pixel Barbers Camden", tagline: "Sharp fades since 2014", bg: "#1f2937", btn: "#fbbf24" },
    { name: "Nori Sushi Bar", business: "Nori Sushi", tagline: "Fresh from the sea", bg: "#e0f2fe", btn: "#0c4a6e" },
    { name: "GreenLeaf Yoga", business: "GreenLeaf Studio", tagline: "Breathe. Move. Glow.", bg: "#dcfce7", btn: "#166534" },
    { name: "Vinyl & Vines", business: "Vinyl & Vines Wine Bar", tagline: "Records, wine, repeat", bg: "#fce7f3", btn: "#831843" },
    { name: "Forge Fitness", business: "Forge Strength Co.", tagline: "Train hard, live strong", bg: "#0f172a", btn: "#ef4444" },
    { name: "Petal & Stem", business: "Petal & Stem Florist", tagline: "Hand-tied with love", bg: "#fef3c7", btn: "#b45309" },
    { name: "Crust Pizza Co.", business: "Crust Pizza — Shoreditch", tagline: "Wood-fired, always", bg: "#fee2e2", btn: "#991b1b" },
    { name: "Stride Sneakers", business: "Stride", tagline: "Step into something new", bg: "#ede9fe", btn: "#5b21b6" },
  ];
  const iconPool: Array<"google" | "instagram" | "tiktok" | "facebook" | "whatsapp" | "website" | "loyalty"> = [
    "google", "instagram", "tiktok", "facebook", "whatsapp", "website", "loyalty",
  ];
  return samples.map((s, idx) => ({
    ...createDefaultProfile(s.name),
    id: crypto.randomUUID(),
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
