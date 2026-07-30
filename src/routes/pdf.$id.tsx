import { createFileRoute, redirect } from "@tanstack/react-router";
import { getProfilePdf } from "@/lib/profile-store";

/**
 * Public menu-PDF short link (e.g. /pdf/JUICES4LIFE2343).
 *
 * This used to render a page that embedded the PDF in an <object>/<iframe>.
 * That only renders inline on desktop browsers with a native PDF plugin —
 * mobile Chrome/Safari and virtually every in-app webview (Instagram,
 * WhatsApp, Facebook, TikTok — how most people actually open a QR-code menu
 * link) can't render an *embedded* PDF that way and instead prompt a
 * download, which looked like "PDF hosting isn't working."
 *
 * The loader below resolves the code server-side and issues a real HTTP
 * redirect straight to the hosted file. That hands the request to the
 * phone's native "open PDF" flow instead of trying to embed it, which is
 * what actually works across mobile browsers and webviews.
 */
export const Route = createFileRoute("/pdf/$id")({
  loader: async ({ params }) => {
    const result = await getProfilePdf(params.id).catch(() => undefined);
    if (result?.pdf) {
      throw redirect({ href: result.pdf, statusCode: 302 });
    }
    return { businessName: result?.businessName };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.businessName || "Menu" }],
  }),
  component: PdfMissing,
});

function PdfMissing() {
  return (
    <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white">
      <p className="text-sm opacity-70">No PDF uploaded for this profile.</p>
    </div>
  );
}
