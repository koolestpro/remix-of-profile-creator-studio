import { FileText, Link2 } from "lucide-react";
import {
  GoogleIcon,
  InstagramIcon,
  TikTokIcon,
  FacebookIcon,
  TripadvisorIcon,
  TrustpilotIcon,
  WebsiteIcon,
  AppStoreIcon,
  GooglePlayIcon,
  LoyaltyIcon,
  WhatsAppIcon,
  LinkedInIcon,
  SnapchatIcon,
} from "@/components/BrandIcons";

export type IconKey =
  | "google"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "tripadvisor"
  | "trustpilot"
  | "website"
  | "appstore"
  | "googleplay"
  | "loyalty"
  | "whatsapp"
  | "linkedin"
  | "snapchat"
  | "custom"
  | "pdf";

const CustomIcon = ({ className }: { className?: string }) => <Link2 className={className} />;
const PdfIcon = ({ className }: { className?: string }) => <FileText className={className} />;

const map: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  tripadvisor: TripadvisorIcon,
  trustpilot: TrustpilotIcon,
  website: WebsiteIcon,
  appstore: AppStoreIcon,
  googleplay: GooglePlayIcon,
  loyalty: LoyaltyIcon,
  whatsapp: WhatsAppIcon,
  linkedin: LinkedInIcon,
  snapchat: SnapchatIcon,
  custom: CustomIcon,
  pdf: PdfIcon,
};

export const ICON_OPTIONS: { key: IconKey; label: string }[] = [
  { key: "google", label: "Google Review" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "tripadvisor", label: "Tripadvisor" },
  { key: "trustpilot", label: "Trustpilot" },
  { key: "website", label: "Website" },
  { key: "appstore", label: "Apple App Store" },
  { key: "googleplay", label: "Google Play" },
  { key: "loyalty", label: "Loyalty Programme" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "snapchat", label: "Snapchat" },
  { key: "custom", label: "Custom" },
  { key: "pdf", label: "Upload PDF" },
];

/** Platforms offered in the business card's "Find me on" grid. Excludes
 *  landing-page-only entries like PDF uploads and review sites. */
export const SOCIAL_ICON_OPTIONS: { key: IconKey; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "google", label: "Google" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "snapchat", label: "Snapchat" },
  { key: "website", label: "Website" },
  { key: "custom", label: "Custom" },
];

export const ICON_COLORS: Record<IconKey, string> = {
  google: "#4285F4",
  instagram: "#E1306C",
  tiktok: "#000000",
  facebook: "#1877F2",
  tripadvisor: "#00AF87",
  trustpilot: "#00B67A",
  website: "#6B7280",
  appstore: "#0A84FF",
  googleplay: "#34A853",
  loyalty: "#F59E0B",
  whatsapp: "#25D366",
  linkedin: "#0A66C2",
  snapchat: "#FFFC00",
  custom: "#8B5CF6",
  pdf: "#DC2626",
};

/**
 * Maps icon keys to static image paths in /public/icons/.
 * When set, renderIcon() uses an <img> instead of the SVG component.
 * Keys without entries fall back to the SVG.
 */
// Normalized, uniform 512² icons (padding trimmed, glyph centered) so every
// platform fills its slot consistently — not just Google.
export const ICON_IMAGE_SRC: Partial<Record<IconKey, string>> = {
  google: "/icons/google.sq.png",
  facebook: "/icons/facebook.sq.png",
  instagram: "/icons/instagram.sq.png",
  tripadvisor: "/icons/tripadvisor.sq.png",
  trustpilot: "/icons/trustpilot.sq.png",
  appstore: "/icons/appstore.sq.png",
  googleplay: "/icons/googleplay.sq.png",
  loyalty: "/icons/loyalty.sq.png",
  website: "/icons/website.sq.png",
  whatsapp: "/icons/whatsapp.sq.png",
  tiktok: "/icons/tiktok.sq.png",
};

export const ICON_DEFAULT_TEXT: Record<IconKey, { title: string; subtitle: string }> = {
  google: { title: "Google", subtitle: "Leave us a review" },
  instagram: { title: "Instagram", subtitle: "Follow us" },
  tiktok: { title: "TikTok", subtitle: "Follow us" },
  facebook: { title: "Facebook", subtitle: "Follow us" },
  whatsapp: { title: "WhatsApp", subtitle: "Let's connect" },
  website: { title: "Website", subtitle: "Visit our site" },
  appstore: { title: "App Store", subtitle: "Download our App" },
  googleplay: { title: "Google Play", subtitle: "Download our App" },
  tripadvisor: { title: "Tripadvisor", subtitle: "Leave us a review" },
  trustpilot: { title: "Trustpilot", subtitle: "Leave us a review" },
  loyalty: { title: "Loyalty", subtitle: "Join our programme" },
  linkedin: { title: "LinkedIn", subtitle: "Let's connect" },
  snapchat: { title: "Snapchat", subtitle: "Add us" },
  custom: { title: "", subtitle: "" },
  pdf: { title: "Menu", subtitle: "View PDF" },
};

export function renderIcon(key: IconKey, className?: string) {
  const src = ICON_IMAGE_SRC[key];
  if (src) {
    // Images always fill their container — the caller must ensure overflow-hidden on the wrapper
    return <img src={src} alt={key} className="h-full w-full object-contain" />;
  }
  const Comp = map[key] ?? WebsiteIcon;
  return <Comp className={className} />;
}
