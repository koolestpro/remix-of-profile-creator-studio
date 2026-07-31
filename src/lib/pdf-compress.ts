/**
 * In-browser PDF compression for uploaded menus.
 *
 * Why this exists: menu PDFs uploaded through the editor are frequently
 * design-tool exports (Canva, Photoshop, etc.) that get merged page-by-page
 * with a separate tool. That merge process often re-embeds a full copy of
 * every font for EVERY page instead of sharing one copy — we found a real
 * 16-page menu that embedded the same 3 fonts 16 times each, ballooning a
 * ~1-2MB document into 12MB. Generic recompression (Ghostscript, qpdf) can't
 * fix this because the duplicate font subsets aren't byte-identical (each
 * page subsets different glyphs), so there's nothing to deduplicate.
 *
 * The reliable fix is the same one commercial "compress PDF" tools use for
 * image/graphic-heavy documents: rasterize each page to a JPEG at a
 * reasonable print DPI and rebuild a new PDF from those images. This throws
 * away the (duplicated) font/vector data entirely, which is exactly what we
 * want for flyer-style menus that are graphic design exports rather than
 * text documents that need to stay selectable/searchable.
 *
 * Trade-off: text in the rebuilt PDF is no longer selectable or searchable
 * (it's now pixels). For a restaurant/menu flyer this is an acceptable and
 * expected trade for a file that actually loads reliably on mobile.
 */
import { PDFDocument } from "pdf-lib";

// pdfjs-dist ships its own worker bundle; point it at that via Vite's ?url
// import so the worker is bundled and fingerprinted like any other asset.
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Target rendering resolution. 150dpi matches typical print/menu-photo
 *  quality — the same ballpark the offending PDFs already used for their
 *  embedded images, so visual quality doesn't visibly drop. */
const TARGET_DPI = 150;
const PDF_BASE_DPI = 72; // PDF user-space units are defined at 72dpi.
const JPEG_QUALITY = 0.75;

/** Don't bother compressing files already under this size — the rasterize
 *  pass costs quality and CPU time for no real benefit on a small file. */
const MIN_SIZE_TO_COMPRESS = 2 * 1024 * 1024; // 2MB

/** Safety cap so a huge catalog/menu can't hang the browser tab. Files with
 *  more pages than this are uploaded as-is, uncompressed. */
const MAX_PAGES_TO_COMPRESS = 60;

/** Safety cap on the rendered canvas's largest dimension, regardless of DPI
 *  math, to bound memory use for unusually large page sizes (e.g. posters). */
const MAX_CANVAS_DIM = 2600;

async function renderPageToJpeg(
  page: pdfjsLib.PDFPageProxy,
): Promise<{ jpegBytes: Uint8Array; widthPt: number; heightPt: number }> {
  const baseViewport = page.getViewport({ scale: 1 });
  const widthPt = baseViewport.width;
  const heightPt = baseViewport.height;

  let scale = TARGET_DPI / PDF_BASE_DPI;
  const longestSidePx = Math.max(widthPt, heightPt) * scale;
  if (longestSidePx > MAX_CANVAS_DIM) {
    scale = MAX_CANVAS_DIM / Math.max(widthPt, heightPt);
  }

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Page backgrounds are frequently transparent in the PDF's own coordinate
  // space; fill white first so JPEG (no alpha channel) doesn't turn them black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Canvas toBlob failed");
  const jpegBytes = new Uint8Array(await blob.arrayBuffer());
  return { jpegBytes, widthPt, heightPt };
}

/**
 * Compress a PDF by rasterizing every page to a JPEG and rebuilding a new
 * PDF from those images. Returns the original file unchanged if the file is
 * already small, has too many pages, or anything goes wrong — this must
 * never block an upload just because compression failed.
 */
export async function compressPdf(file: File): Promise<File> {
  if (file.size < MIN_SIZE_TO_COMPRESS) return file;

  try {
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    // pdf.js detaches/transfers the buffer in some code paths — pass a copy.
    const loadingTask = pdfjsLib.getDocument({ data: originalBytes.slice() });
    const pdf = await loadingTask.promise;

    if (pdf.numPages > MAX_PAGES_TO_COMPRESS) {
      await pdf.destroy();
      return file;
    }

    const out = await PDFDocument.create();
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { jpegBytes, widthPt, heightPt } = await renderPageToJpeg(page);
      page.cleanup();

      const jpgImage = await out.embedJpg(jpegBytes);
      const outPage = out.addPage([widthPt, heightPt]);
      outPage.drawImage(jpgImage, { x: 0, y: 0, width: widthPt, height: heightPt });
    }
    await pdf.destroy();

    const compressedBytes = await out.save();

    // Only use the compressed version if it's actually smaller. Falls back
    // to the original for already-efficient, mostly-vector/text PDFs where
    // rasterizing would make the file bigger and blurrier for no gain.
    if (compressedBytes.byteLength >= file.size) return file;

    return new File([compressedBytes], file.name, { type: "application/pdf" });
  } catch (err) {
    // Never let a compression bug block the upload — ship the original.
    console.warn("PDF compression skipped (falling back to original file):", err);
    return file;
  }
}
