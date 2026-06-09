export type IconKey =
  | "google"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "apple"
  | "play"
  | "gift"
  | "link"
  | "youtube"
  | "twitter"
  | "mail"
  | "phone";

export interface LinkItem {
  id: string;
  icon: IconKey;
  iconUrl?: string; // custom uploaded icon
  title: string;
  subtitle: string;
  url: string;
}

export interface ProfileData {
  headerImage?: string;
  secondaryImage?: string;
  businessName: string;
  businessDescription: string;
  bgColor: string;
  buttonColor: string;
  links: LinkItem[];
}
