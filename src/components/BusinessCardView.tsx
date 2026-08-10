import { Mail, Phone, Globe, MapPin, Download, Share2, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ProfileData, CardData, SocialItem } from "@/lib/profile-types";
import { createDefaultCardData } from "@/lib/profile-types";
import { renderIcon } from "@/lib/icon-registry";
import { isVideoSrc } from "@/lib/utils";

/* ============================================================
 * Helpers shared by the public card and the editor preview
 * ============================================================ */

/** Reads cardData off a profile, filling in defaults for anything missing. */
export function cardOf(profile: ProfileData): CardData {
  return { ...createDefaultCardData(), ...(profile.cardData ?? {}) };
}

/** Strips formatting so "+1 (415) 555-0132" dials correctly on tap. */
export function telHref(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : undefined;
}

/** Accepts "northlight.studio" or "https://northlight.studio" alike. */
export function websiteHref(site: string) {
  const trimmed = site.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Escapes the characters that would otherwise break a vCard line. */
function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/**
 * Folds a long vCard line to 75 characters, per RFC 2426. Continuation lines
 * start with a single space. Without this the embedded photo is one enormous
 * line and stricter parsers (iOS Contacts among them) reject the whole card.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) out.push(` ${line.slice(i, i + 74)}`);
  return out.join("\r\n");
}

/**
 * Loads the round profile picture and re-encodes it as a small square JPEG for
 * embedding in the vCard.
 *
 * Deliberately only the round picture — the banner is decoration for the web
 * page, not the person, and contacts apps show a single round avatar.
 *
 * Downscaled to 400px because some phones silently drop contacts carrying
 * multi-megabyte photos. Returns null on any failure (CORS, decode error, a
 * browser without canvas) so Save contact still works, just without a picture.
 */
async function loadPhotoBase64(
  src: string,
  zoomPercent = 100,
): Promise<{ base64: string; type: string } | null> {
  try {
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const SIZE = 400;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Centre-crop to a square, then apply the same zoom the card displays, so
    // the saved contact photo matches what the visitor actually saw.
    const zoom = Math.max(1, zoomPercent / 100);
    const side = Math.min(bitmap.width, bitmap.height) / zoom;
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    // JPEG has no alpha, so fill white first or transparent logos go black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
    bitmap.close?.();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    return { base64, type: "JPEG" };
  } catch {
    return null;
  }
}

/**
 * Builds a VCARD 3.0 payload from the card fields.
 *
 * The full name is split on the last space so "Maya Okonkwo" yields
 * N:Okonkwo;Maya — single-word names land entirely in the given-name slot,
 * which every contacts app handles gracefully.
 */
export function buildVCard(
  profile: ProfileData,
  photo?: { base64: string; type: string } | null,
): string {
  const c = cardOf(profile);
  const name = c.fullName.trim() || profile.businessName || "Contact";
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const first = parts.join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(name)}`,
  ];
  if (profile.businessName) lines.push(`ORG:${esc(profile.businessName)}`);
  if (c.jobTitle) lines.push(`TITLE:${esc(c.jobTitle)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${esc(c.phone)}`);
  if (c.email) lines.push(`EMAIL;TYPE=WORK:${esc(c.email)}`);
  const site = websiteHref(c.website);
  if (site) lines.push(`URL:${esc(site)}`);
  if (c.location) lines.push(`ADR;TYPE=WORK:;;${esc(c.location)};;;;`);
  if (c.aboutText) lines.push(`NOTE:${esc(c.aboutText)}`);
  if (photo) lines.push(fold(`PHOTO;ENCODING=b;TYPE=${photo.type}:${photo.base64}`));
  lines.push("END:VCARD");
  // vCard requires CRLF line endings; some Android contact apps reject LF.
  return lines.join("\r\n");
}

/**
 * Triggers the .vcf download that saves the card to the visitor's phone,
 * embedding the round profile picture when one is set.
 */
export async function downloadVCard(profile: ProfileData) {
  const c = cardOf(profile);
  const photo = profile.secondaryImage
    ? await loadPhotoBase64(profile.secondaryImage, profile.secondaryImageZoom ?? 100)
    : null;

  const blob = new Blob([buildVCard(profile, photo)], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(c.fullName || profile.businessName || "contact")
    .trim()
    .replace(/\s+/g, "-")}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ============================================================
 * Card
 * ============================================================ */

interface BusinessCardViewProps {
  profile: ProfileData;
  /** Called when a social icon or contact row is tapped, for analytics. */
  onLinkClick?: (id: string) => void;
  /** Called when "Save contact" is tapped. */
  onSaveContact?: () => void;
  /** Rendered inside the "Powered by" footer. */
  onPoweredByClick?: () => void;
  /** Disables navigation + downloads. Used by the editor's phone preview. */
  interactive?: boolean;
  /** Scales the whole card down for the editor's phone frame. */
  compact?: boolean;
}

export function BusinessCardView({
  profile,
  onLinkClick,
  onSaveContact,
  onPoweredByClick,
  interactive = true,
  compact = false,
}: BusinessCardViewProps) {
  const c = cardOf(profile);
  const textColor = profile.textColor ?? "#111111";
  const actionTextColor = profile.actionTextColor ?? "#FFFFFF";
  const buttonColor = profile.buttonColor ?? "#8b5cf6";
  // Encoding the photo takes a beat on a slow connection — show progress
  // rather than letting the button feel dead.
  const [savingContact, setSavingContact] = useState(false);

  const handleShare = async () => {
    if (!interactive || typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: c.fullName || profile.businessName,
          text: [c.jobTitle, profile.businessName].filter(Boolean).join(" · "),
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user dismissed the share sheet — nothing to recover from */
    }
  };

  const handleSave = async () => {
    if (!interactive || savingContact) return;
    setSavingContact(true);
    onSaveContact?.();
    try {
      await downloadVCard(profile);
    } finally {
      setSavingContact(false);
    }
  };

  // Banner height, clip shape and avatar sizing deliberately mirror the landing
  // page (p.$slug.tsx) so a profile switched between formats keeps the same
  // header proportions and the same amount of image crop.
  const s = compact
    ? {
        header: "h-44",
        avatar: "h-24 w-24",
        avatarPull: "-mt-14",
        name: "text-lg",
        title: "text-[10px]",
        pad: "px-4",
        body: "text-[11px]",
        row: "text-[11px]",
        social: "h-10 w-10",
        saveBtn: "py-2.5 text-xs",
      }
    : {
        header: "h-80",
        avatar: "h-44 w-44",
        avatarPull: "-mt-24",
        name: "text-2xl",
        title: "text-sm",
        pad: "px-6",
        body: "text-[0.85rem]",
        row: "text-[0.85rem]",
        social: "h-14 w-14",
        saveBtn: "py-3.5 text-sm",
      };

  // Same V-notch as the landing page header.
  const CLIP = "polygon(0 0, 100% 0, 100% 86%, 50% 100%, 0 86%)";

  // The banner and avatar reuse the landing page's images, per spec.
  const banner = profile.headerImage;
  const avatar = profile.secondaryImage;

  const contactRows: Array<{
    key: string;
    icon: React.ReactNode;
    value: string;
    href?: string;
  }> = [];
  if (c.phone)
    contactRows.push({
      key: "phone",
      icon: <Phone className={compact ? "h-3 w-3" : "h-4 w-4"} />,
      value: c.phone,
      href: telHref(c.phone),
    });
  if (c.email)
    contactRows.push({
      key: "email",
      icon: <Mail className={compact ? "h-3 w-3" : "h-4 w-4"} />,
      value: c.email,
      href: `mailto:${c.email}`,
    });
  if (c.location)
    contactRows.push({
      key: "location",
      icon: <MapPin className={compact ? "h-3 w-3" : "h-4 w-4"} />,
      value: c.location,
      // Location is a free text field — deliberately not hyperlinked.
    });
  if (c.website)
    contactRows.push({
      key: "website",
      icon: <Globe className={compact ? "h-3 w-3" : "h-4 w-4"} />,
      value: c.website.replace(/^https?:\/\//i, ""),
      href: websiteHref(c.website),
    });

  return (
    <div className="w-full" style={{ backgroundColor: profile.bgColor }}>
      {/* Banner — same image/video as the landing page, V-clipped */}
      <header className="relative">
        {banner ? (
          isVideoSrc(banner) ? (
            <video
              src={banner}
              className={`w-full object-cover object-center ${s.header}`}
              style={{ clipPath: CLIP }}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={banner}
              alt=""
              className={`w-full object-cover object-center ${s.header}`}
              style={{ clipPath: CLIP }}
            />
          )
        ) : (
          <div
            className={`w-full bg-gradient-to-br from-muted to-muted-foreground/20 ${s.header}`}
            style={{ clipPath: CLIP }}
          />
        )}

        <div className="absolute inset-x-0 top-0 flex justify-end px-4 pt-4">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share card"
            className={`inline-flex items-center gap-2 rounded-full font-semibold shadow-md transition active:scale-[0.97] ${
              compact ? "px-3 py-1.5 text-[10px]" : "px-5 py-2.5 text-xs"
            }`}
            style={{ backgroundColor: buttonColor, color: actionTextColor }}
          >
            <Share2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            Share
          </button>
        </div>
      </header>

      {/* Avatar — same secondary image as the landing page */}
      <div className={`relative flex justify-center ${s.avatarPull}`}>
        {/* White ring, matching the landing page's logo treatment. */}
        <div
          className={`overflow-hidden rounded-full border-4 border-background bg-black shadow-lg ${s.avatar}`}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={c.fullName || profile.businessName}
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ transform: `scale(${(profile.secondaryImageZoom ?? 100) / 100})` }}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-medium text-white/70">
              Photo
            </span>
          )}
        </div>
      </div>

      {/* Name, title and the Save contact action */}
      <section className={`${s.pad} pt-4 text-center`}>
        <h1
          className={`font-extrabold uppercase tracking-tight ${s.name}`}
          style={{ color: textColor }}
        >
          {c.fullName || "Full Name"}
        </h1>
        {c.jobTitle && (
          <p
            className={`mt-1 font-semibold uppercase tracking-[0.14em] ${s.title}`}
            style={{ color: textColor, opacity: 0.65 }}
          >
            {c.jobTitle}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={savingContact}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold shadow-md transition active:scale-[0.98] ${s.saveBtn}`}
          style={{ backgroundColor: buttonColor, color: actionTextColor }}
        >
          {savingContact ? (
            <Loader2
              className={
                compact ? "h-3 w-3 shrink-0 animate-spin" : "h-4 w-4 shrink-0 animate-spin"
              }
            />
          ) : (
            <Download className={compact ? "h-3 w-3 shrink-0" : "h-4 w-4 shrink-0"} />
          )}
          {c.saveContactText || "Save contact"}
        </button>
      </section>

      {/* About me */}
      {(c.aboutHeading || c.aboutText) && (
        <section className={`${s.pad} pt-6`}>
          {c.aboutHeading && (
            <span
              className={`inline-block rounded-full font-semibold ${
                compact ? "px-3 py-1 text-[9px]" : "px-4 py-1.5 text-xs"
              }`}
              style={{ backgroundColor: buttonColor, color: actionTextColor }}
            >
              {c.aboutHeading}
            </span>
          )}
          {c.aboutText && (
            <p
              className={`mt-3 leading-relaxed ${s.body}`}
              style={{ color: textColor, opacity: 0.75 }}
            >
              {c.aboutText}
            </p>
          )}
        </section>
      )}

      {/* Contact me */}
      {(c.contactHeading || contactRows.length > 0) && (
        <section className={`${s.pad} pt-6`}>
          {c.contactHeading && (
            <span
              className={`inline-block rounded-full font-semibold ${
                compact ? "px-3 py-1 text-[9px]" : "px-4 py-1.5 text-xs"
              }`}
              style={{ backgroundColor: buttonColor, color: actionTextColor }}
            >
              {c.contactHeading}
            </span>
          )}
        </section>
      )}

      {contactRows.length > 0 && (
        <section className={`mt-3 space-y-1 ${compact ? "px-3" : "px-4"}`}>
          {contactRows.map((r) => {
            const inner = (
              <div
                className={`grid grid-cols-[auto_minmax(0,1fr)] items-center rounded-2xl py-2.5 ${
                  compact ? "gap-2 px-1.5" : "gap-3 px-2"
                }`}
              >
                <span
                  className={`grid shrink-0 place-items-center rounded-full ${
                    compact ? "h-6 w-6" : "h-8 w-8"
                  }`}
                  style={{ backgroundColor: buttonColor, color: actionTextColor }}
                >
                  {r.icon}
                </span>
                <span className={`min-w-0 break-words ${s.row}`} style={{ color: textColor }}>
                  {r.value}
                </span>
              </div>
            );
            return r.href && interactive ? (
              <a
                key={r.key}
                href={r.href}
                target={r.key === "website" ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={() => onLinkClick?.(r.key)}
                className="block rounded-2xl transition-colors hover:bg-black/[0.04]"
              >
                {inner}
              </a>
            ) : (
              <div key={r.key}>{inner}</div>
            );
          })}
        </section>
      )}

      {/* Find me on + powered by */}
      {/* No tint here — the footer sits on the profile background so the
       *  "Find me on" block doesn't read as a different colour band. */}
      <footer className={`mt-7 ${s.pad} py-6`}>
        {c.socials.length > 0 && (
          <>
            <h2
              className={`mb-4 text-center font-semibold uppercase tracking-[0.18em] ${
                compact ? "text-[9px]" : "text-xs"
              }`}
              style={{ color: textColor, opacity: 0.6 }}
            >
              Find me on
            </h2>
            <div className="grid grid-cols-2 place-items-center gap-3">
              {c.socials.map((social) => (
                <SocialIcon
                  key={social.id}
                  social={social}
                  sizeClass={s.social}
                  interactive={interactive}
                  onClick={() => onLinkClick?.(social.id)}
                />
              ))}
            </div>
          </>
        )}

        {profile.showPoweredBy !== false && (
          <div className="mt-6 flex flex-col items-center gap-1">
            <span
              className={`font-medium uppercase tracking-widest ${
                compact ? "text-[8px]" : "text-[11px]"
              }`}
              style={{ color: textColor, opacity: 0.6 }}
            >
              Powered by
            </span>
            <button
              type="button"
              onClick={() => interactive && onPoweredByClick?.()}
              aria-label="Contact us"
              className="transition active:scale-95"
            >
              <img
                src={
                  profile.poweredByLogo === "white"
                    ? "/tapandrate-logo-white.png"
                    : "/tap-and-rate-transparent.png"
                }
                alt="Tapandrate"
                className={compact ? "h-16 w-auto object-contain" : "h-24 w-auto object-contain"}
              />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

function SocialIcon({
  social,
  sizeClass,
  interactive,
  onClick,
}: {
  social: SocialItem;
  sizeClass: string;
  interactive: boolean;
  onClick: () => void;
}) {
  const img = (
    <span className={`grid place-items-center overflow-hidden rounded-xl ${sizeClass}`}>
      {social.iconUrl ? (
        <img src={social.iconUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        renderIcon(social.icon, "h-full w-full object-contain")
      )}
    </span>
  );
  if (!interactive || !social.url) return img;
  return (
    <a
      href={social.url}
      target="_blank"
      rel="noreferrer"
      aria-label={social.icon}
      onClick={onClick}
      className="transition-transform active:scale-[0.94]"
    >
      {img}
    </a>
  );
}
