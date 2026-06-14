import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getProfile } from "@/lib/profile-store";

export const Route = createFileRoute("/pdf/$id")({
  head: () => ({ meta: [{ title: "Menu" }] }),
  component: PdfView,
});

function PdfView() {
  const { id } = Route.useParams();
  const [pdf, setPdf] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProfile(id)
      .then((p) => {
        if (cancelled) return;
        if (!p || !p.mainButtonPdf) {
          setMissing(true);
          return;
        }
        setPdf(p.mainButtonPdf);
        if (p.businessName) document.title = p.businessName;
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (missing) {
    return (
      <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white">
        <p className="text-sm opacity-70">No PDF uploaded for this profile.</p>
      </div>
    );
  }

  if (!pdf) return <div className="min-h-screen bg-black" />;

  return (
    <div className="fixed inset-0 bg-black">
      <object
        data={`${pdf}#view=FitH&toolbar=0`}
        type="application/pdf"
        className="h-full w-full"
      >
        <iframe src={pdf} title="PDF" className="h-full w-full border-0" />
      </object>
    </div>
  );
}
