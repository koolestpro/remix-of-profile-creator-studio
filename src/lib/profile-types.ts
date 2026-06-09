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
  headerImage?: string;
  secondaryImage?: string;
  businessName: string;
  businessDescription: string;
  bgColor: string;
  buttonColor: string;
  links: LinkItem[];
}
