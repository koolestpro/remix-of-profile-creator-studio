// Standalone Node harness that exercises the SAME algorithm as
// src/lib/pdf-compress.ts (render each page -> JPEG -> rebuild via pdf-lib),
// just using @napi-rs/canvas as the canvas backend instead of the browser's
// native Canvas, since this runs in plain Node. Used only to verify the
// rasterize+rebuild approach actually shrinks the known-bloated test PDF
// before shipping the browser version.
import fs from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const TARGET_DPI = 150;
const PDF_BASE_DPI = 72;
const JPEG_QUALITY = 0.75;
const MAX_CANVAS_DIM = 2600;

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

const PROGRESS_PATH = process.argv[3] || "/tmp/compress-progress.json";
function writeProgress(obj) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(obj, null, 2));
}

async function main() {
  const inputPath = process.argv[2];
  const originalBytes = new Uint8Array(fs.readFileSync(inputPath));
  writeProgress({ stage: "loaded", originalSize: originalBytes.byteLength });

  const canvasFactory = new NodeCanvasFactory();
  const pdf = await pdfjsLib.getDocument({ data: originalBytes, canvasFactory }).promise;
  writeProgress({ stage: "parsed", originalSize: originalBytes.byteLength, pages: pdf.numPages });

  const out = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const widthPt = baseViewport.width;
    const heightPt = baseViewport.height;

    let scale = TARGET_DPI / PDF_BASE_DPI;
    const longestSidePx = Math.max(widthPt, heightPt) * scale;
    if (longestSidePx > MAX_CANVAS_DIM) {
      scale = MAX_CANVAS_DIM / Math.max(widthPt, heightPt);
    }
    const viewport = page.getViewport({ scale });

    const canvasAndContext = canvasFactory.create(
      Math.round(viewport.width),
      Math.round(viewport.height),
    );
    canvasAndContext.context.fillStyle = "#ffffff";
    canvasAndContext.context.fillRect(0, 0, canvasAndContext.canvas.width, canvasAndContext.canvas.height);

    await page.render({
      canvasContext: canvasAndContext.context,
      viewport,
      canvas: canvasAndContext.canvas,
    }).promise;

    const jpegBuffer = canvasAndContext.canvas.toBuffer("image/jpeg", JPEG_QUALITY);
    const jpgImage = await out.embedJpg(jpegBuffer);
    const outPage = out.addPage([widthPt, heightPt]);
    outPage.drawImage(jpgImage, { x: 0, y: 0, width: widthPt, height: heightPt });

    page.cleanup();
    canvasFactory.destroy(canvasAndContext);
    writeProgress({
      stage: "page_done",
      originalSize: originalBytes.byteLength,
      pages: pdf.numPages,
      pageDone: i,
    });
  }

  await pdf.destroy();
  const compressedBytes = await out.save();

  const outPath = inputPath.replace(/\.pdf$/i, "-recompressed-test.pdf");
  fs.writeFileSync(outPath, compressedBytes);

  writeProgress({
    stage: "done",
    originalSize: originalBytes.byteLength,
    pages: pdf.numPages,
    compressedSize: compressedBytes.byteLength,
    reductionPct: 100 * (1 - compressedBytes.byteLength / originalBytes.byteLength),
    outPath,
  });
}

main().catch((err) => {
  writeProgress({ stage: "error", message: String(err && err.stack || err) });
  process.exit(1);
});
