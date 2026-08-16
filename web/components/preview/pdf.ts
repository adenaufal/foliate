// pdf.js access point. Two things make this file exist rather than a bare
// import at the top of the preview:
//
// 1. `pdfjs-dist` evaluates `new DOMMatrix()` at module scope. A client leaf is
//    still rendered on the server for the SSR pass, so a static import throws
//    `ReferenceError: DOMMatrix is not defined` during `next build`. The dynamic
//    import below only ever runs from an effect, i.e. in the browser.
// 2. The worker has to be a real module worker served same-origin. The bundler
//    rewrites `new URL(<package path>, import.meta.url)` into an emitted
//    /_next/static asset, so the URL is correct in dev and after a build
//    without copying the worker into public/.

import type { PDFDocumentLoadingTask } from "pdfjs-dist";

type Pdfjs = typeof import("pdfjs-dist");

let lib: Promise<Pdfjs> | null = null;

function pdfjs(): Promise<Pdfjs> {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
    return m;
  });
  return lib;
}

/**
 * Open a compiled PDF. Returns the loading task, not the document: a compile
 * that lands while an older one is still parsing has to be able to tear the
 * older one down mid-flight.
 */
export async function openPdf(url: string): Promise<PDFDocumentLoadingTask> {
  const { getDocument } = await pdfjs();
  return getDocument({ url });
}
