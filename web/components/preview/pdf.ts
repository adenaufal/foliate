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

import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { PdfOutlineEntry } from "@/lib/editor-session";

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

/** The shape pdf.js hands back from `getOutline()`; it types the destination
 *  loosely, so the walk below checks it at runtime. */
interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items: OutlineNode[];
}

/**
 * The document's bookmarks, flattened, each resolved to the 1-based physical
 * page it points at. Typst writes one per heading, so for a Foliate book this
 * is the chapter list with real page numbers. Empty when the PDF has none.
 * Entries whose destination cannot be resolved are dropped, not guessed.
 */
export async function readOutline(doc: PDFDocumentProxy): Promise<PdfOutlineEntry[]> {
  const tree = (await doc.getOutline()) as OutlineNode[] | null;
  if (!tree?.length) return [];
  const out: PdfOutlineEntry[] = [];

  const walk = async (nodes: OutlineNode[], level: number) => {
    for (const node of nodes) {
      const dest = typeof node.dest === "string" ? await doc.getDestination(node.dest) : node.dest;
      const ref = Array.isArray(dest) ? dest[0] : null;
      if (ref && typeof ref === "object") {
        try {
          const index = await doc.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
          out.push({ title: node.title, page: index + 1, level });
        } catch {
          // A dangling bookmark. Leave it out rather than point at page 1.
        }
      }
      if (node.items?.length) await walk(node.items, level + 1);
    }
  };

  await walk(tree, 1);
  return out;
}
