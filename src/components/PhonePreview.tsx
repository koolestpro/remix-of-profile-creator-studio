import { ChevronRight, Menu, Share2 } from "lucide-react";
import { ProfileData } from "@/lib/profile-types";
import { renderIcon } from "@/lib/icon-registry";

export function PhonePreview({ profile }: { profile: ProfileData }) {
  const textColor = profile.textColor ?? "#111111";
  const actionTextColor = profile.actionTextColor ?? "#FFFFFF";
  return (
    <div
      className="relative mx-auto w-full max-w-[320px] rounded-[3rem] border-[14px] border-foreground/90 bg-foreground/90 p-0"
      style={{ boxShadow: "var(--shadow-phone)" }}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-foreground/90" />

      <div
        className="relative h-[640px] overflow-hidden rounded-[2.2rem]"
        style={{ backgroundColor: profile.bgColor }}
      >
        {/* Scrollable inner */}
        <div className="h-full overflow-y-auto scrollbar-thin">
          {/* Header / background image (behind everything) */}
          <div className="relative z-0 h-44 w-full overflow-hidden">
            {profile.headerImage ? (
              <img
                src={profile.headerImage}
                alt=""
                className="h-full w-full object-cover object-center"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 86%, 50% 100%, 0 86%)" }}
              />
            ) : (
              <div
                className="h-full w-full bg-gradient-to-br from-muted to-muted-foreground/20"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 86%, 50% 100%, 0 86%)" }}
              />
            )}
            {profile.showMenuButton !== false && (
              <button className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/90">
                <Menu className="h-4 w-4 text-foreground" />
              </button>
            )}
            <button
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: profile.buttonColor, color: actionTextColor }}
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>

          {/* Secondary / logo (in front of the background) */}
          <div className="relative z-10 -mt-6 flex flex-col items-center px-5 pb-6">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 border-background bg-background shadow-lg">
              {profile.secondaryImage ? (
                <img
                  src={profile.secondaryImage}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ transform: `scale(${(profile.secondaryImageZoom ?? 100) / 100})` }}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Logo</span>
              )}
            </div>
            <h2 className="mt-3 text-center text-base font-bold" style={{ color: textColor }}>
              {profile.businessName || "Business Name"}
            </h2>
            <p className="text-center text-xs" style={{ color: textColor, opacity: 0.7 }}>
              {profile.businessDescription || "Business description"}
            </p>

            {/* Main button */}
            {profile.mainButtonText && (
              <button
                className="mt-5 w-full rounded-full py-3 text-sm font-semibold shadow-md"
                style={{ backgroundColor: profile.buttonColor, color: actionTextColor }}
              >
                {profile.mainButtonText}
              </button>
            )}

            {/* Links */}
            <div className="mt-3 w-full space-y-2.5">
              {profile.links.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl bg-background/95 p-2.5 shadow-sm"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg">
                    {l.iconUrl ? (
                      <img src={l.iconUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      renderIcon(l.icon, "h-full w-full object-contain text-foreground")
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {l.title || "Link title"}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {l.subtitle || "Subtitle"}
                    </p>
                  </div>
                  <div
                    className="grid h-7 w-7 place-items-center rounded-full"
                    style={{ backgroundColor: profile.buttonColor, color: actionTextColor }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              ))}
            </div>

            {/* Powered by */}
            {profile.showPoweredBy !== false && (
              <div className="mt-8 flex flex-col items-center gap-1.5 pb-2">
                <p
                  className="text-[9px] font-semibold tracking-[0.2em]"
                  style={{ color: textColor, opacity: 0.6 }}
                >
                  POWERED BY
                </p>
                <img
                  src={
                    profile.poweredByLogo === "white"
                      ? "/tapandrate-logo-white.png"
                      : "/tap-and-rate-transparent.png"
                  }
                  alt="tapandrate.co.uk"
                  className="h-6 w-auto object-contain"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
