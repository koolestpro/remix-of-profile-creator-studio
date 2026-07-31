import { createFileRoute } from "@tanstack/react-router";
import { getProfilePdf } from "@/lib/profile-store";

/**
 * Public menu-PDF short link (e.g. /pdf/JUICES4LIFE2343).
 *
 * History:
 * 1. This used to render a page that embedded the PDF in an <object>/
 *    <iframe>. Mobile browsers and in-app webviews (Instagram, WhatsApp —
 *    how most people actually open a QR-code menu link) won't render an
 *    *embedded* PDF that way and prompt a download instead.
 * 2. That was fixed by 302-redirecting straight to the Supabase Storage
 *    file, which fixed mobile rendering but sent the visitor's browser to
 *    tsmfvpfjazmacjoeaavk.supabase.co instead of staying on our own domain.
 *
 * This version proxies the file instead: the GET handler below fetches the
 * bytes from Supabase Storage server-side and streams them back as THIS
 * route's own response. The browser never leaves tapandrateai.co.uk, and
 * because it's still a genuine top-level document response (not an embed),
 * mobile browsers still hand it to their native PDF viewer.
 */
export const Route = createFileRoute("/pdf/$id")({
  server: {
    handlers: {
      GET: async ({ params, next }) => {
        const result = await getProfilePdf(params.id).catch(() => undefined);
        if (!result?.pdf) return next();

        let upstream: Response;
        try {
          upstream = await fetch(result.pdf);
        } catch {
          return next();
        }
        if (!upstream.ok || !upstream.body) return next();

        const headers = new Headers();
        headers.set("Content-Type", "application/pdf");
        headers.set("Cache-Control", "public, max-age=3600");
        // Inline (not attachment) so browsers try to display rather than
        // force a download; the filename only affects "Save as" defaults.
        const safeName = (result.businessName || "menu").replace(/[^\w\- ]/g, "").trim() || "menu";
        headers.set("Content-Disposition", `inline; filename="${safeName}.pdf"`);
        const contentLength = upstream.headers.get("content-length");
        if (contentLength) headers.set("Content-Length", contentLength);

        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
  // Only reached when the GET handler above calls next() — i.e. no PDF is
  // on record for this code, or the proxy fetch itself failed. Distinguish
  // the two so a real (if transient) fetch failure doesn't get mislabeled
  // as "nothing was ever uploaded here".
  loader: async ({ params }) => {
    const result = await getProfilePdf(params.id).catch(() => undefined);
    return { businessName: result?.businessName, exists: Boolean(result?.pdf) };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.businessName || "Menu" }],
  }),
  component: PdfFallback,
});

function PdfFallback() {
  const { exists } = Route.useLoaderData();
  return (
    <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white">
      <p className="text-sm opacity-70">
        {exists
          ? "We're having trouble loading this menu right now — please try refreshing."
          : "No PDF uploaded for this profile."}
      </p>
    </div>
  );
}
