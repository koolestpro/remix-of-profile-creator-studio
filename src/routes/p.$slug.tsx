import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { X, ChevronRight, Share2, Menu } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Contact form that appears when the menu button is tapped
// ---------------------------------------------------------------------------
interface ContactFormProps {
  businessName: string;
  onClose: () => void;
}

function ContactForm({ businessName, onClose }: ContactFormProps) {
  const [fields, setFields] = useState({
    name: "",
    businessName: "",
    phone: "",
    email: "",
  });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Open mailto: pre-filled — swap this for a real API call / Supabase Edge Function as needed
    const body = encodeURIComponent(
      `Name: ${fields.name}\nBusiness: ${fields.businessName}\nPhone: ${fields.phone}\nEmail: ${fields.email}`,
    );
    const subject = encodeURIComponent(`Help request from ${fields.name} — ${fields.businessName}`);
    window.open(`mailto:info@tapandrate.co.uk?subject=${subject}&body=${body}`, "_blank");
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-background px-6 pb-10 pt-4 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />

        {/* Close */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Logo */}
        <div className="mt-2 flex justify-center">
          <img
            src="/tapandrate-logo.png"
            alt="Tapandrate"
            className="w-48 h-auto rounded-2xl object-contain"
          />
        </div>

        {sent ? (
          <div className="mt-6 text-center">
            <p className="text-lg font-semibold text-foreground">Message sent!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll be in touch with {businessName || "you"} shortly.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mt-4 text-center text-[17px] font-semibold text-foreground">
              Need help with your Google Business Profile?
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <input
                required
                placeholder="Your name"
                value={fields.name}
                onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                required
                placeholder="Business name"
                value={fields.businessName}
                onChange={(e) => setFields((f) => ({ ...f, businessName: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                required
                type="tel"
                placeholder="Contact number"
                value={fields.phone}
                onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                required
                type="email"
                placeholder="Email address"
                value={fields.email}
                onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="mt-1 w-full rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background transition active:scale-[0.98]"
              >
                Send message
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
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
      className="min-h-screen w-full overflow-x-hidden text-foreground"
      style={{ backgroundColor: profile.bgColor }}
    >
      <div
        className="mx-auto min-h-screen w-full max-w-md"
        style={{ backgroundColor: profile.bgColor }}
      >
        {/* Header image — V-bottom clip shape */}
        <header className="relative z-0">
          {profile.headerImage ? (
            <img
              src={profile.headerImage}
              alt=""
              className="h-64 w-full object-cover"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)" }}
            />
          ) : (
            <div
              className="h-64 w-full bg-gradient-to-br from-muted to-muted-foreground/20"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)" }}
            />
          )}

          {/* Top bar — menu + share */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-safe pt-4">
            {profile.showMenuButton !== false && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="grid h-10 w-10 place-items-center rounded-full bg-background text-foreground shadow-md transition active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={handleShare}
                aria-label="Share profile"
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition active:scale-95"
                style={{ backgroundColor: profile.buttonColor }}
              >
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
          </div>
        </header>

        {/* Logo + name */}
        <section className="relative z-10 -mt-16 px-4 pb-2">
          <div className="flex flex-col items-center pt-3">
            <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-black shadow-lg">
              {profile.secondaryImage ? (
                <img
                  src={profile.secondaryImage}
                  alt={profile.businessName}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-medium text-white/70">
                  Logo
                </span>
              )}
            </div>
            <h1 className="mt-3 text-center text-xl font-bold tracking-tight text-foreground">
              {profile.businessName || "Business Name"}
            </h1>
            {profile.businessDescription && (
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {profile.businessDescription}
              </p>
            )}

            {profile.mainButtonText && (
              <a
                href={
                  profile.mainButtonPdf
                    ? `/pdf/${profile.id}`
                    : (profile.mainButtonUrl || "#")
                }
                target={profile.mainButtonPdf || profile.mainButtonUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="mt-5 block w-full rounded-full px-6 py-4 text-center text-base font-bold text-white shadow-md transition active:scale-[0.98]"
                style={{ backgroundColor: profile.buttonColor }}
              >
                {profile.mainButtonText}
              </a>
            )}
          </div>
        </section>

        {/* Links */}
        <section className="px-4 pb-16 pt-4">
          <ul className="flex flex-col gap-3">
            {profile.links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url || "#"}
                  target={l.url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-white px-5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_16px_32px_-12px_rgba(0,0,0,0.25)] active:scale-[0.985]"
                >
                  <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                  <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl">
                    {l.iconUrl ? (
                      <img
                        src={l.iconUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      renderIcon(
                        l.icon,
                        "h-12 w-12 transition-transform duration-300 group-hover:scale-105",
                      )
                    )}
                  </span>

                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[17px] font-semibold leading-tight tracking-tight text-card-foreground">
                      {l.title || "Link"}
                    </span>
                    {l.subtitle && (
                      <span className="mt-1 block truncate text-[13px] text-muted-foreground">
                        {l.subtitle}
                      </span>
                    )}
                  </span>
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white opacity-90 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                    style={{ backgroundColor: profile.buttonColor }}
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {/* Powered by */}
          {profile.showPoweredBy !== false && (
            <div className="mt-10 flex flex-col items-center gap-1">
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Powered by
              </span>
              <img
                src="/tap-and-rate-transparent.png"
                alt="Tapandrate"
                className="h-48 w-auto object-contain -mt-16"
              />
            </div>
          )}
        </section>
      </div>

      {/* Contact form popup */}
      {menuOpen && (
        <ContactForm
          businessName={profile.businessName}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </main>
  );
}
