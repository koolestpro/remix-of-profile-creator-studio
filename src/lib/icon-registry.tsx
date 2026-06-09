import { Link2 } from "lucide-react";
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
  | "custom";

const CustomIcon = ({ className }: { className?: string }) => (
  <Link2 className={className} />
);

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
  custom: CustomIcon,
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
  custom: "#8B5CF6",
};

export function renderIcon(key: IconKey, className?: string) {
  const Comp = map[key] ?? WebsiteIcon;
  return <Comp className={className} />;
}
