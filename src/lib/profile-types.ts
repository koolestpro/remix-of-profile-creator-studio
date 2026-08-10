import type { IconKey } from "@/lib/icon-registry";
export type { IconKey };

export interface LinkItem {
  id: string;
  icon: IconKey;
  iconUrl?: string;
  title: string;
  subtitle: string;
  url: string;
  /** Set when icon === "pdf": the uploaded PDF's public URL. */
  pdfUrl?: string;
  /** Original uploaded filename, shown in the editor. */
  pdfName?: string;
  /** Readable, unique code used in the public PDF URL for this link,
   *  e.g. "MENU4821" → /pdf/MENU4821. Generated automatically on upload. */
  pdfCode?: string;
}

/** Which layout a profile renders with.
 *  "landing" = the original link-in-bio landing page.
 *  "card"    = the digital business card layout. */
export type ProfileType = "landing" | "card";

/** A single social icon shown in the business card's "Find me on" grid.
 *  Icon-only — no title/subtitle, unlike landing page LinkItems. */
export interface SocialItem {
  id: string;
  icon: IconKey;
  /** Optional custom icon image URL (used when icon === "custom"). */
  iconUrl?: string;
  url: string;
}

/** Fields unique to the business card layout. Stored as a single jsonb
 *  column so the card can gain fields without a migration each time.
 *  Kept separate from the landing page fields so switching a profile's
 *  type back and forth never destroys the other layout's content. */
export interface CardData {
  /** Main text — the person's full name. */
  fullName: string;
  /** 2nd text — business and job title, e.g. "Founder & CEO". */
  jobTitle: string;
  /** Heading on the "About Me" pill. Editable. */
  aboutHeading: string;
  /** Free text description shown under the About pill. */
  aboutText: string;
  /** Heading on the "Contact me" pill. Editable. */
  contactHeading: string;
  /** Hyperlinks to tel: */
  phone: string;
  /** Hyperlinks to mailto: */
  email: string;
  /** Free text — not hyperlinked. */
  location: string;
  /** Hyperlinks to the site. Scheme is added automatically if missing. */
  website: string;
  /** Label on the primary action button. Downloads a vCard. */
  saveContactText: string;
  socials: SocialItem[];
}

export function createDefaultCardData(): CardData {
  return {
    fullName: "",
    jobTitle: "",
    aboutHeading: "About Me",
    aboutText: "",
    contactHeading: "Contact me",
    phone: "",
    email: "",
    location: "",
    website: "",
    saveContactText: "Save contact",
    socials: [],
  };
}

export interface ProfileData {
  profileName: string;
  /** Defaults to "landing" when unset, so every pre-existing profile keeps
   *  rendering exactly as it did before this field existed. */
  profileType?: ProfileType;
  /** Only meaningful when profileType === "card". */
  cardData?: CardData;
  headerImage?: string;
  secondaryImage?: string;
  /** Zoom level applied to the secondary image/logo, as a percentage (100 = fit,
   *  larger = zoomed in). Defaults to 100 when unset. */
  secondaryImageZoom?: number;
  businessName: string;
  businessDescription: string;
  bgColor: string;
  buttonColor: string;
  /** Color of the business name, tagline and "powered by" text. */
  textColor: string;
  /** Color of action text: View Menu button, Share button and link arrows. */
  actionTextColor: string;
  mainButtonText: string;
  mainButtonUrl: string;
  mainButtonPdf?: string;
  mainButtonPdfName?: string;
  /** Readable, unique code used in the public PDF URL, e.g. "JUICES4LIFE2343"
   *  → /pdf/JUICES4LIFE2343. Generated automatically when a PDF is uploaded. */
  pdfCode?: string;
  links: LinkItem[];
  showPoweredBy?: boolean;
  /** Which Tap and Rate logo variant to show in the "Powered by" badge.
   *  "blue" = navy logo (for light backgrounds, the previous/default look).
   *  "white" = white/yellow logo (for dark backgrounds, where the blue
   *  version disappears). Defaults to "blue" when unset. */
  poweredByLogo?: "blue" | "white";
  showMenuButton?: boolean;
}
