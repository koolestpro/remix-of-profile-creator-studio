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

export interface ProfileData {
  profileName: string;
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
