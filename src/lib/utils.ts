import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * True if a header media URL/data-URL points at a video rather than an image —
 * either a base64 data-URL with a video/* MIME type, or a file ending in a
 * common video extension (from Supabase Storage or any external host).
 */
export function isVideoSrc(src?: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:video/")) return true;
  return /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(src);
}
