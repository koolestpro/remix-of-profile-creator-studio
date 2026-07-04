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
    secondaryImageZoom: 100,
    // Business name is intentionally left blank on new profiles. It must NOT
    // inherit the QR/profile name — the user fills it in themselves (or leaves
    // it blank). All display sites fall back to "Business Name"/"—" gracefully.
    businessName: "",
    businessDescription: "",
    bgColor: "#f4ead5",
    buttonColor: "#111111",
    textColor: "#111111",
    actionTextColor: "#FFFFFF",
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
  secondary_image_zoom: number | null;
  business_name: string;
  business_description: string;
  bg_color: string;
  button_color: string;
  text_color: string | null;
  action_text_color: string | null;
  main_button_text: string;
  main_button_url: string;
  main_button_pdf: string | null;
  main_button_pdf_name: string | null;
  pdf_code: string | null;
  links: LinkItem[] | null;
  paused: boolean;
  scan_count: number;
  show_powered_by: boolean | null;
  powered_by_logo: string | null;
  show_menu_button: boolean | null;
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
    secondaryImageZoom: r.secondary_image_zoom ?? 100,
    businessName: r.business_name,
    businessDescription: r.business_description,
    bgColor: r.bg_color,
    buttonColor: r.button_color,
    textColor: r.text_color ?? "#111111",
    actionTextColor: r.action_text_color ?? "#FFFFFF",
    mainButtonText: r.main_button_text,
    mainButtonUrl: r.main_button_url,
    mainButtonPdf: r.main_button_pdf ?? undefined,
    mainButtonPdfName: r.main_button_pdf_name ?? undefined,
    pdfCode: r.pdf_code ?? undefined,
    links: Array.isArray(r.links) ? r.links : [],
    showPoweredBy: r.show_powered_by ?? undefined,
    poweredByLogo: r.powered_by_logo === "white" ? "white" : "blue",
    showMenuButton: r.show_menu_button ?? undefined,
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
    secondary_image_zoom: data.secondaryImageZoom ?? 100,
    business_name: data.businessName,
    business_description: data.businessDescription,
    bg_color: data.bgColor,
    button_color: data.buttonColor,
    text_color: data.textColor ?? "#111111",
    action_text_color: data.actionTextColor ?? "#FFFFFF",
    main_button_text: data.mainButtonText,
    main_button_url: data.mainButtonUrl,
    main_button_pdf: data.mainButtonPdf ?? null,
    main_button_pdf_name: data.mainButtonPdfName ?? null,
    pdf_code: data.pdfCode ?? null,
    links: data.links,
    show_powered_by: data.showPoweredBy ?? null,
    powered_by_logo: data.poweredByLogo ?? "blue",
    show_menu_button: data.showMenuButton ?? null,
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
  const samples: Array<{
    name: string;
    business: string;
    tagline: string;
    bg: string;
    btn: string;
    folderId: string | null;
  }> = [
    {
      name: "Juices4Life Profile",
      business: "Juices4Life Harlesden",
      tagline: "Fuel your Life",
      bg: "#f4ead5",
      btn: "#111111",
      folderId: "folder-juices4life",
    },
    {
      name: "Bloom Coffee — Soho",
      business: "Bloom Coffee",
      tagline: "Slow brews, fast smiles",
      bg: "#fde8d4",
      btn: "#3b2417",
      folderId: "folder-younis",
    },
    {
      name: "Pixel Barbers",
      business: "Pixel Barbers Camden",
      tagline: "Sharp fades since 2014",
      bg: "#1f2937",
      btn: "#fbbf24",
      folderId: "folder-adnan",
    },
    {
      name: "Nori Sushi Bar",
      business: "Nori Sushi",
      tagline: "Fresh from the sea",
      bg: "#e0f2fe",
      btn: "#0c4a6e",
      folderId: "folder-talah",
    },
    {
      name: "GreenLeaf Yoga",
      business: "GreenLeaf Studio",
      tagline: "Breathe. Move. Glow.",
      bg: "#dcfce7",
      btn: "#166534",
      folderId: "folder-younis",
    },
    {
      name: "Vinyl & Vines",
      business: "Vinyl & Vines Wine Bar",
      tagline: "Records, wine, repeat",
      bg: "#fce7f3",
      btn: "#831843",
      folderId: "folder-adnan",
    },
    {
      name: "Forge Fitness",
      business: "Forge Strength Co.",
      tagline: "Train hard, live strong",
      bg: "#0f172a",
      btn: "#ef4444",
      folderId: "folder-talah",
    },
    {
      name: "Petal & Stem",
      business: "Petal & Stem Florist",
      tagline: "Hand-tied with love",
      bg: "#fef3c7",
      btn: "#b45309",
      folderId: null,
    },
    {
      name: "Crust Pizza Co.",
      business: "Crust Pizza — Shoreditch",
      tagline: "Wood-fired, always",
      bg: "#fee2e2",
      btn: "#991b1b",
      folderId: "folder-juices4life",
    },
    {
      name: "Stride Sneakers",
      business: "Stride",
      tagline: "Step into something new",
      bg: "#ede9fe",
      btn: "#5b21b6",
      folderId: "folder-adnan",
    },
  ];
  const iconPool: Array<
    "google" | "instagram" | "tiktok" | "facebook" | "whatsapp" | "website" | "loyalty"
  > = ["google", "instagram", "tiktok", "facebook", "whatsapp", "website", "loyalty"];
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

/** Move many profiles into a folder (or to Uncategorized when folderId=null)
 *  in a single operation. Used by the dashboard's bulk "Move to folder". */
export async function moveProfilesToFolder(
  profileIds: string[],
  folderId: string | null,
): Promise<void> {
  if (profileIds.length === 0) return;
  if (!supabase) {
    const ids = new Set(profileIds);
    const now = Date.now();
    localWriteProfiles(
      localListProfiles().map((p) => (ids.has(p.id) ? { ...p, folderId, updatedAt: now } : p)),
    );
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ folder_id: folderId })
    .in("id", profileIds);
  if (error) throw error;
}

// The dashboard cards only need these fields — fetching the heavy image/links
// columns for the whole list is what made loading slow. The editor and public
// page still fetch the full row by id/slug.
const LIST_COLUMNS =
  "id, slug, profile_name, folder_id, business_name, paused, scan_count, created_at, updated_at";

interface ProfileListRow {
  id: string;
  slug: string;
  profile_name: string;
  folder_id: string | null;
  business_name: string;
  paused: boolean;
  scan_count: number;
  created_at: string;
  updated_at: string;
}

function listRowToProfile(r: ProfileListRow): StoredProfile {
  return {
    ...createDefaultProfile(r.profile_name),
    id: r.id,
    slug: r.slug,
    folderId: r.folder_id,
    paused: r.paused,
    scanCount: r.scan_count,
    profileName: r.profile_name,
    businessName: r.business_name ?? "",
    links: [],
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function listProfiles(): Promise<StoredProfile[]> {
  if (!supabase) return localListProfiles();
  const { data, error } = await supabase
    .from("profiles")
    .select(LIST_COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ProfileListRow[]).map(listRowToProfile);
}

export async function getProfile(id: string): Promise<StoredProfile | undefined> {
  if (!supabase) return localListProfiles().find((p) => p.id === id);
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : undefined;
}

export async function getProfileBySlug(slug: string): Promise<StoredProfile | undefined> {
  if (!supabase) {
    // Prefer each profile's locked-in slug; fall back to a computed one only
    // for legacy local profiles saved before slugs were persisted.
    return localListProfiles().find((p) => (p.slug ?? slugify(p.profileName)) === slug);
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
    const all = localListProfiles();
    const existingSlugs = new Set(all.map((p) => p.slug ?? slugify(p.profileName)));
    let slug = slugify(name) || "profile";
    let n = 1;
    while (existingSlugs.has(slug)) {
      n += 1;
      slug = `${slugify(name) || "profile"}-${n}`;
    }
    const profile: StoredProfile = {
      ...createDefaultProfile(name),
      id: crypto.randomUUID(),
      slug,
      scanCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    all.push(profile);
    localWriteProfiles(all);
    return profile;
  }
  const data = createDefaultProfile(name);
  const id = crypto.randomUUID();
  const base = slugify(name) || "profile";

  // Optimistic single-insert: try the clean slug first without a pre-check
  // query. Only fall back to a suffixed slug on a real unique-constraint
  // violation (code 23505). This cuts the common case from 2 DB calls → 1.
  const tryInsert = async (slug: string) => {
    return supabase!
      .from("profiles")
      .insert({ ...profileDataToRow(data), id, slug })
      .select()
      .single();
  };

  let { data: row, error } = await tryInsert(base);
  if (error?.code === "23505") {
    // Slug collision — retry with a short UUID suffix (virtually unique)
    ({ data: row, error } = await tryInsert(`${base}-${id.slice(0, 6)}`));
  }
  if (error) throw error;
  return rowToProfile(row as ProfileRow);
}

export async function saveProfile(
  id: string,
  data: ProfileData,
  /** Pass the profile's current slug to skip a redundant uniqueness check
   *  when the profile name hasn't changed (saves one Supabase round-trip). */
  existingSlug?: string,
): Promise<StoredProfile | undefined> {
  if (!supabase) {
    const all = localListProfiles();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...data, updatedAt: Date.now() };
    localWriteProfiles(all);
    return all[idx];
  }

  // The public URL is locked to whatever slug was assigned the first time
  // the profile was saved (see createProfile). Renaming the profile later
  // must NOT change the slug — a changed URL breaks QR codes, shared links,
  // Google/social profiles etc. that already point at the old one. Only
  // profiles that somehow don't have a slug yet (shouldn't normally happen)
  // get one generated here.
  const slug = existingSlug || (await uniqueSlug(slugify(data.profileName), id));

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

export async function setProfilesPaused(ids: string[], paused: boolean): Promise<void> {
  if (!supabase) {
    const set = new Set(ids);
    const now = Date.now();
    localWriteProfiles(
      localListProfiles().map((p) => (set.has(p.id) ? { ...p, paused, updatedAt: now } : p)),
    );
    return;
  }
  const { error } = await supabase.from("profiles").update({ paused }).in("id", ids);
  if (error) throw error;
}

export async function duplicateProfile(id: string): Promise<StoredProfile | undefined> {
  if (!supabase) {
    const all = localListProfiles();
    const src = all.find((p) => p.id === id);
    if (!src) return undefined;
    const now = Date.now();
    // Copy the menu PDF too, but give the copy its own unique PDF code +
    // matching public URL so the two profiles don't share a code.
    let pdfCode = src.pdfCode;
    let mainButtonUrl = src.mainButtonUrl;
    if (src.mainButtonPdf) {
      pdfCode = await generateUniquePdfCode(src.businessName || `${src.profileName} Copy`);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      mainButtonUrl = `${origin}/pdf/${pdfCode}`;
    }
    const copy: StoredProfile = {
      ...src,
      id: crypto.randomUUID(),
      profileName: `${src.profileName} (Copy)`,
      pdfCode,
      mainButtonUrl,
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

  // If the source has a menu PDF, reuse the hosted file but mint a NEW unique
  // pdf_code (the DB column is unique) and repoint the redirect URL at it.
  let pdfCode = src.pdfCode;
  let mainButtonUrl = src.mainButtonUrl;
  if (src.mainButtonPdf) {
    pdfCode = await generateUniquePdfCode(src.businessName || name);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    mainButtonUrl = `${origin}/pdf/${pdfCode}`;
  }

  const data: ProfileData = {
    profileName: name,
    headerImage: src.headerImage,
    secondaryImage: src.secondaryImage,
    businessName: src.businessName,
    businessDescription: src.businessDescription,
    bgColor: src.bgColor,
    buttonColor: src.buttonColor,
    textColor: src.textColor,
    actionTextColor: src.actionTextColor,
    mainButtonText: src.mainButtonText,
    mainButtonUrl,
    mainButtonPdf: src.mainButtonPdf,
    mainButtonPdfName: src.mainButtonPdfName,
    pdfCode,
    links: src.links.map((l) => ({ ...l, id: crypto.randomUUID() })),
    showPoweredBy: src.showPoweredBy,
    showMenuButton: src.showMenuButton,
  };
  const { data: row, error } = await supabase
    .from("profiles")
    .insert({ ...profileDataToRow(data), slug, folder_id: src.folderId ?? null })
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(row as ProfileRow);
}

/**
 * Lightweight rename used by the dashboard's inline "rename" action. Updates
 * only the profile_name column — it deliberately does NOT touch the slug
 * (the public URL is locked to its first-save value, see saveProfile) and
 * does NOT touch links/images/colors/etc, so it can safely be called with
 * just an id + name, without first loading the full profile row.
 */
export async function renameProfile(id: string, name: string): Promise<void> {
  if (!supabase) {
    const all = localListProfiles();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], profileName: name, updatedAt: Date.now() };
    localWriteProfiles(all);
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ profile_name: name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Upload a PDF file to Supabase Storage and return its public URL.
 * Falls back to a base64 data-URL in localStorage-only mode.
 *
 * Requires a PUBLIC bucket named "pdfs" in your Supabase project:
 *   Supabase dashboard → Storage → New bucket → Name: pdfs → Public: YES
 */
export async function uploadPdf(profileId: string, file: File): Promise<string> {
  if (!supabase) {
    // localStorage mode: embed as base64 (small PDFs only)
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(file);
    });
  }

  const path = `${profileId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("pdfs")
    .upload(path, file, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    const rls = /row-level security|violates|not authorized|policy/i.test(uploadError.message);
    throw new Error(
      `PDF upload failed: ${uploadError.message}. ` +
        (rls
          ? "This is a Storage permission issue. Run supabase/migrations/004_storage_policies.sql in the Supabase SQL Editor, and make sure you're still logged in as an admin."
          : "Make sure a public 'pdfs' bucket exists in Supabase Storage."),
    );
  }

  const { data } = supabase.storage.from("pdfs").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Compress/resize an image in the browser before upload.
 *
 * The old flow embedded the raw image as a base64 data-URL straight into the
 * profile row, so a single 3 MB photo became ~4 MB of text saved into Postgres
 * AND re-downloaded on every public page view — the main cause of the slow
 * loads/saves. We now downscale to a sane max dimension and re-encode as JPEG,
 * typically shrinking a phone photo from megabytes to ~100-300 KB.
 */
async function compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<Blob> {
  // SVGs and tiny files: don't bother re-encoding.
  if (file.type === "image/svg+xml") return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode image"));
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // Canvas unsupported — fall back to original file.
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  // If compression somehow produced a bigger file, keep the original.
  if (!blob || blob.size >= file.size) return file;
  return blob;
}

/**
 * Upload a profile image to Supabase Storage and return its public URL.
 * Images are compressed client-side first. Falls back to a base64 data-URL in
 * localStorage-only mode (no Supabase configured).
 *
 * Requires a PUBLIC bucket named "images" in your Supabase project (created by
 * supabase/schema.sql).
 */
export async function uploadImage(profileId: string, file: File): Promise<string> {
  const compressed = await compressImage(file);

  if (!supabase) {
    // localStorage mode: embed the compressed image as base64.
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(compressed);
    });
  }

  const isSvg = file.type === "image/svg+xml";
  const ext = isSvg ? "svg" : "jpg";
  const contentType = isSvg ? "image/svg+xml" : "image/jpeg";
  const path = `${profileId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("images")
    .upload(path, compressed, { contentType, upsert: true });

  if (uploadError) {
    const rls = /row-level security|violates|not authorized|policy/i.test(uploadError.message);
    throw new Error(
      `Image upload failed: ${uploadError.message}. ` +
        (rls
          ? "This is a Storage permission issue. Run supabase/migrations/004_storage_policies.sql in the Supabase SQL Editor, and make sure you're still logged in as an admin."
          : "Make sure a public 'images' bucket exists in Supabase Storage."),
    );
  }

  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

/** Strip a name down to the uppercase A–Z0–9 root used in a PDF code.
 *  "Juices4Life Harlesden" → "JUICES4LIFEHARLESDEN". Empty → "MENU". */
function pdfCodeRoot(name: string): string {
  const root = (name || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return root || "MENU";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Build a unique, readable PDF code like "JUICES4LIFE2343" — the business name
 * (uppercased, alphanumeric only) plus a random 4-digit number. Each branch gets
 * a different number automatically, even when the names are identical. Checks the
 * store for collisions so two profiles never share a code.
 */
export async function generateUniquePdfCode(name: string): Promise<string> {
  const root = pdfCodeRoot(name);
  const exists = async (code: string): Promise<boolean> => {
    if (!supabase) {
      return localListProfiles().some((p) => p.pdfCode === code);
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("pdf_code", code)
      .limit(1);
    if (error) throw error;
    return !!data?.length;
  };
  for (let i = 0; i < 50; i++) {
    const num = Math.floor(1000 + Math.random() * 9000); // 1000–9999
    const candidate = `${root}${num}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Extremely unlikely fallback — append a longer timestamp-based suffix.
  return `${root}${Date.now().toString().slice(-6)}`;
}

/**
 * Lightweight fetch for the PDF viewer route. Resolves the URL param against the
 * readable pdf_code first (e.g. /pdf/JUICES4LIFE2343), then falls back to the
 * raw profile UUID so any older /pdf/<id> links keep working. Pulls only the two
 * columns it needs instead of the whole row.
 */
export async function getProfilePdf(
  codeOrId: string,
): Promise<{ businessName: string; pdf?: string } | undefined> {
  if (!supabase) {
    const p = localListProfiles().find((x) => x.pdfCode === codeOrId || x.id === codeOrId);
    return p ? { businessName: p.businessName, pdf: p.mainButtonPdf } : undefined;
  }

  const select = "business_name, main_button_pdf";
  type PdfRow = { business_name: string; main_button_pdf: string | null };
  const toResult = (data: PdfRow) => ({
    businessName: data.business_name,
    pdf: data.main_button_pdf ?? undefined,
  });

  // 1) Try the readable code.
  const byCode = await supabase
    .from("profiles")
    .select(select)
    .eq("pdf_code", codeOrId)
    .maybeSingle();
  if (byCode.error) throw byCode.error;
  if (byCode.data) return toResult(byCode.data as PdfRow);

  // 2) Fall back to UUID (older links) — only query if it actually looks like one.
  if (!UUID_RE.test(codeOrId)) return undefined;
  const byId = await supabase.from("profiles").select(select).eq("id", codeOrId).maybeSingle();
  if (byId.error) throw byId.error;
  if (!byId.data) return undefined;
  return toResult(byId.data as PdfRow);
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

  const rawProfiles = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  const rawFolders = typeof window !== "undefined" ? localStorage.getItem(FOLDERS_KEY) : null;
  const localProfiles: StoredProfile[] = rawProfiles ? JSON.parse(rawProfiles) : [];
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
      textColor: p.textColor ?? "#111111",
      actionTextColor: p.actionTextColor ?? "#FFFFFF",
      mainButtonText: p.mainButtonText,
      mainButtonUrl: p.mainButtonUrl,
      links: p.links,
    };
    const slug = await uniqueSlug(slugify(p.profileName));
    const folderId = p.folderId ? (folderIdMap.get(p.folderId) ?? null) : null;
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
