import {
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  Mail,
  Phone,
  Link as LinkIcon,
  Gift,
  Apple,
  Play,
  Music2,
  Chrome,
} from "lucide-react";
import type { IconKey } from "./profile-types";

const map: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  google: Chrome,
  instagram: Instagram,
  tiktok: Music2,
  facebook: Facebook,
  apple: Apple,
  play: Play,
  gift: Gift,
  link: LinkIcon,
  youtube: Youtube,
  twitter: Twitter,
  mail: Mail,
  phone: Phone,
};

export const ICON_OPTIONS: { key: IconKey; label: string }[] = [
  { key: "link", label: "Link" },
  { key: "google", label: "Google" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "Twitter / X" },
  { key: "apple", label: "App Store" },
  { key: "play", label: "Google Play" },
  { key: "gift", label: "Loyalty / Gift" },
  { key: "mail", label: "Email" },
  { key: "phone", label: "Phone" },
];

export function renderIcon(key: IconKey, className?: string) {
  const Comp = map[key] ?? LinkIcon;
  return <Comp className={className} />;
}
