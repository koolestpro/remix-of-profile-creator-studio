import type { IconKey } from "@/lib/icon-registry";
export type { IconKey };

export interface LinkItem {
  id: string;
  icon: IconKey;
  iconUrl?: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface ProfileData {
  profileName: string;
  headerImage?: string;
  secondaryImage?: string;
  businessName: string;
  businessDescription: string;
  bgColor: string;
  buttonColor: string;
  mainButtonText: string;
  mainButtonUrl: string;
  mainButtonPdf?: string;
  mainButtonPdfName?: string;
  /** Readable, unique code used in the public PDF URL, e.g. "JUICES4LIFE2343"
   *  → /pdf/JUICES4LIFE2343. Generated automatically when a PDF is uploaded. */
  pdfCode?: string;
  links: LinkItem[];
  showPoweredBy?: boolean;
  showMenuButton?: boolean;
}
