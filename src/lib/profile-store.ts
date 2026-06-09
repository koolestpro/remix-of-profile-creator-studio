import type { ProfileData } from "@/lib/profile-types";

export interface StoredProfile extends ProfileData {
  id: string;
  updatedAt: number;
  createdAt: number;
}

const KEY = "lps:profiles";

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
  const base = createDefaultProfile("Juices4Life Profile");
  return [
    {
      ...base,
      id: crypto.randomUUID(),
      profileName: "Juices4Life Profile",
      businessName: "Juices4Life Harlesden",
      businessDescription: "Fuel your Life",
      mainButtonText: "View Menu",
      mainButtonUrl: "https://example.com/menu",
      links: [
        { id: crypto.randomUUID(), icon: "google", title: "Leave us a Google review", subtitle: "Share your experience", url: "https://google.com" },
        { id: crypto.randomUUID(), icon: "instagram", title: "Instagram", subtitle: "Follow us", url: "https://instagram.com" },
        { id: crypto.randomUUID(), icon: "tiktok", title: "TikTok", subtitle: "Follow us", url: "https://tiktok.com" },
        { id: crypto.randomUUID(), icon: "loyalty", title: "Join our Loyalty Programme", subtitle: "Earn rewards on every visit", url: "https://example.com" },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
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
