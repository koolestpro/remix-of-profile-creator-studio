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
  | "whatsapp";

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
];

export function renderIcon(key: IconKey, className?: string) {
  const Comp = map[key] ?? WebsiteIcon;
  return <Comp className={className} />;
}
