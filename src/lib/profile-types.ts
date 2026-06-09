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
  links: LinkItem[];
}
