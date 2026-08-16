// Template card thumbnails: a real page from the same Typst pipeline that
// renders the book (UI-REFERENCE — "a layout choice is only decidable by
// seeing the layout"), rasterised by pdf.js and cached per (template, trim).

import { openPdf } from "@/components/preview/pdf";
import { BRAND_NAME } from "@/lib/brand";
import { compile, type TemplateId, type Trim } from "@/lib/compile";

/**
 * One chapter, short enough to fit on the page it opens. The templates put a
 * title page and a table of contents ahead of the body, so page 1 is never the
 * layout being chosen — the chapter opener is the *last* page of this specimen
 * (measured at 5×8: literary 5 pages, manuscript 5, contemporary 3).
 *
 * ponytail: a trim small enough to overflow that page would thumbnail the
 * continuation page instead — same template, duller picture. Shorten the
 * specimen if that ever shows up.
 */
const SPECIMEN = `---
title: Spesimen
author: ${BRAND_NAME}
---

# Bab Satu

Ia menutup pintu itu pelan-pelan, seolah suara sekecil apa pun akan membangunkan seluruh rumah. Di luar, hujan turun tanpa suara, dan lampu jalan memantul di genangan seperti huruf yang belum sempat dicetak.

Yang tersisa hanya bunyi jam dinding, dan halaman yang belum selesai ia baca sejak musim lalu.
`;

/** Raster width in device pixels. The card never shows it wider than ~160 CSS px. */
const WIDTH = 320;

/**
 * The specimen is fixed, so a hit is permanent for the session. Promises, not
 * images: three cards mounting at once must share one compile per key.
 */
const cache = new Map<string, Promise<string>>();

const keyOf = (template: TemplateId, trim: Trim) =>
  `${template}|${typeof trim === "string" ? trim : `${trim.width}x${trim.height}${trim.unit ?? "in"}`}`;

/** Resolves a PNG data URL of the template's chapter opener at this trim. */
export function templateThumbnail(template: TemplateId, trim: Trim): Promise<string> {
  const key = keyOf(template, trim);
  const hit = cache.get(key);
  if (hit) return hit;
  const run = render(template, trim).catch((e) => {
    // A compile that failed because the service was down must not be cached as
    // a permanent verdict.
    cache.delete(key);
    throw e;
  });
  cache.set(key, run);
  return run;
}

// pdf.js comes from the preview pane's access point — one worker config, one
// lazily-imported copy of the library for the whole app.
async function render(template: TemplateId, trim: Trim): Promise<string> {
  const blob = await compile({ markdown: SPECIMEN, template, trim });
  const url = URL.createObjectURL(blob);
  const task = await openPdf(url);
  try {
    const doc = await task.promise;
    const page = await doc.getPage(doc.numPages);
    const scale = WIDTH / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    // A data URL rather than an object URL: nothing to revoke, and the cache
    // outlives the component that asked for it.
    return canvas.toDataURL("image/png");
  } finally {
    // pdf.js 6 hangs teardown off the loading task, not the document.
    void task.destroy();
    URL.revokeObjectURL(url);
  }
}
