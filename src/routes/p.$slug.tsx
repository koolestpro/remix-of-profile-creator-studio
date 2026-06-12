import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronRight, Share2 } from "lucide-react";
import {
  getProfileBySlug,
  incrementScan,
  type StoredProfile,
} from "@/lib/profile-store";
import { renderIcon } from "@/lib/icon-registry";

export const Route = createFileRoute("/p/$slug")({
  head: () => ({
    meta: [
      { title: "Profile — Tapandrate" },
      {
        name: "description",
        content: "One link to find everything — socials, reviews, and more.",
      },
    ],
  }),
  component: PublicProfile,
});

type LoadState =
  | { status: "loading" }
  | { status: "found"; profile: StoredProfile }
  | { status: "missing" };

function PublicProfile() {
  const { slug } = Route.useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [menuOpen, setMenuOpen] = useState(false);
  const counted = useRef(false);

  // Resolve the slug on the client (store reads run in the browser).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const match = await getProfileBySlug(slug);
        if (!active) return;
        if (!match || match.paused) {
          setState({ status: "missing" });
          return;
        }
        // Count this view once per page load (ref guards dev double-invoke).
        if (!counted.current) {
          counted.current = true;
          incrementScan(match).catch(() => {});
        }
        setState({ status: "found", profile: match });
      } catch {
        if (active) setState({ status: "missing" });
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (state.status === "loading") {
    return <main className="min-h-screen bg-background" />;
  }

  if (state.status === "missing") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            This page is no longer available
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The profile you're looking for doesn't exist or has been taken down.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const profile = state.profile;

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: profile.businessName, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user dismissed share / clipboard unavailable — ignore */
    }
  };

  return (
    <main
      className="min-h-screen text-foreground"
      style={{ backgroundColor: profile.bgColor }}
    >
      <div
        className="mx-auto min-h-screen max-w-md"
        style={{ backgroundColor: profile.bgColor }}
      >
        {/* Header image */}
        <header className="relative">
          {profile.headerImage ? (
            <img
              src={profile.headerImage}
              alt=""
              className="h-64 w-full object-cover"
            />
          ) : (
            <div className="h-64 w-full bg-gradient-to-br from-muted to-muted-foreground/20" />
          )}

          {/* Top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-full bg-background text-foreground shadow-md transition active:scale-95"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share profile"
              className="flex items-center gap-2 rounded-full px-7 py-3 text-base font-bold text-white shadow-md transition active:scale-95"
              style={{ backgroundColor: profile.buttonColor }}
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </header>

        {/* Profile card */}
        <section className="-mt-12 px-4">
          <div className="relative pt-36">
            <div className="absolute left-1/2 -top-12 grid h-44 w-44 -translate-x-1/2 place-items-center overflow-hidden rounded-full border-4 border-background bg-black shadow-lg">
              {profile.secondaryImage ? (
                <img
                  src={profile.secondaryImage}
                  alt={profile.businessName}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-white/70">Logo</span>
              )}
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {profile.businessName || "Business Name"}
              </h1>
              {profile.businessDescription && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {profile.businessDescription}
                </p>
              )}
            </div>

            {profile.mainButtonText && (
              <a
                href={profile.mainButtonUrl || "#"}
                target={profile.mainButtonUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="mt-5 block w-full rounded-full px-6 py-4 text-center text-lg font-bold text-white transition active:scale-[0.98]"
                style={{ backgroundColor: profile.buttonColor }}
              >
                {profile.mainButtonText}
              </a>
            )}
          </div>
        </section>

        {/* Links */}
        <section className="px-4 pt-8 pb-16">
          <ul className="flex flex-col gap-3.5">
            {profile.links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url || "#"}
                  target={l.url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-white px-5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_16px_32px_-12px_rgba(0,0,0,0.25)] active:scale-[0.985]"
                >
                  <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                  <span className="grid h-14 w-14 shrink-0 place-items-center">
                    {l.iconUrl ? (
                      <img
                        src={l.iconUrl}
                        alt=""
                        className="h-12 w-12 object-contain"
                      />
                    ) : (
                      renderIcon(
                        l.icon,
                        "h-12 w-12 transition-transform duration-300 group-hover:scale-105",
                      )
                    )}
                  </span>

                  <span className="flex-1 text-left">
                    <span className="block text-[17px] font-semibold leading-tight tracking-tight text-card-foreground">
                      {l.title || "Link"}
                    </span>
                    {l.subtitle && (
                      <span className="mt-1 block text-[13px] text-muted-foreground">
                        {l.subtitle}
                      </span>
                    )}
                  </span>
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full text-white opacity-90 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                    style={{ backgroundColor: profile.buttonColor }}
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {/* Powered by */}
          <div className="mt-10 flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Powered by
            </span>
            <img
              src="/tap-and-rate-transparent.png"
              alt="Tapandrate"
              className="-mt-16 h-44 w-auto object-contain"
            />
          </div>
        </section>
      </div>

      {/* Menu overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="mx-auto flex h-full max-w-md flex-col px-6 py-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-1">
              {profile.mainButtonText && (
                <a
                  href={profile.mainButtonUrl || "#"}
                  target={profile.mainButtonUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="rounded-xl px-4 py-4 text-2xl font-semibold tracking-tight text-foreground transition hover:bg-secondary"
                >
                  {profile.mainButtonText}
                </a>
              )}
              {profile.links.map((l) => (
                <a
                  key={l.id}
                  href={l.url || "#"}
                  target={l.url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="rounded-xl px-4 py-4 text-2xl font-semibold tracking-tight text-foreground transition hover:bg-secondary"
                >
                  {l.title || "Link"}
                </a>
              ))}
            </nav>
            <p className="mt-auto text-center text-xs text-muted-foreground">
              {profile.businessName}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
