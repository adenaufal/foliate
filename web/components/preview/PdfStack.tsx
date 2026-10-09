"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfOutlineEntry, PreviewLayout } from "@/lib/editor-session";
import { openPdf, readOutline } from "./pdf";
import { PdfPage } from "./PdfPage";
import { Sheet } from "./Sheet";

/** Render one screen beyond the viewport in each direction. Enough that a
 *  normal scroll never outruns the renderer; small enough that the live
 *  canvas count stays in single digits. */
const RENDER_MARGIN = "100% 0px";
/** Window resize fires per frame; a re-render per frame would thrash. */
const RESIZE_SETTLE_MS = 150;

const NONE: ReadonlySet<number> = new Set();

/**
 * Facing pages as the book is bound: page 1 is a recto and sits alone on the
 * right, then (2,3), (4,5)… A final even page is a verso with nothing facing it.
 */
export function spreadRows(pages: number): number[][] {
  const rows: number[][] = [];
  if (pages >= 1) rows.push([1]);
  for (let p = 2; p <= pages; p += 2) rows.push(p + 1 <= pages ? [p, p + 1] : [p]);
  return rows;
}

/**
 * The compiled PDF as a continuous page stack, or as a stack of spreads.
 * Emits sheets (or rows of sheets) only — the scroll container and the field
 * belong to PagePreview, which needs them for the empty and skeleton states
 * too.
 */
export function PdfStack({
  url,
  root,
  trimAspect,
  layout = "stack",
  onPages,
  onFirstPage,
  onOutline,
}: {
  url: string;
  /** Scroll container; the IntersectionObserver root. Null on first paint. */
  root: HTMLElement | null;
  /** Aspect from the session trim, used until the real document reports its
   *  own — the stack must resize the instant the trim changes, ahead of the
   *  recompile landing. */
  trimAspect: number;
  layout?: PreviewLayout;
  onPages: (pages: number) => void;
  /** Page 1 of a freshly compiled document, once painted — card art for the
   *  library. Fired once per compile, never on scroll or resize. */
  onFirstPage: (canvas: HTMLCanvasElement) => void;
  /** The document's bookmarks, page-resolved, once per compile. */
  onOutline?: (entries: PdfOutlineEntry[]) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [aspect, setAspect] = useState(trimAspect);
  const [visible, setVisible] = useState(NONE);
  const [sizeTick, setSizeTick] = useState(0);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  /** Armed by a document commit, spent by the first page that paints it. A
   *  re-render of the same page — scrolled back, or resized — finds it spent. */
  const fresh = useRef(false);
  // Read through a ref so a new callback identity does not reload the document.
  const outlineCb = useRef(onOutline);
  outlineCb.current = onOutline;

  // Trim changed: resize now, correct later from the document itself.
  useEffect(() => setAspect(trimAspect), [trimAspect]);

  // Load. The outgoing document stays mounted and painted until the new one is
  // ready to take its place, so a recompile never blanks the pane.
  useEffect(() => {
    let dead = false;
    let committed = false;
    let task: Awaited<ReturnType<typeof openPdf>> | null = null;

    void (async () => {
      const loading = (task = await openPdf(url));
      if (dead) return void loading.destroy();
      const next = await loading.promise;
      // Books are uniform, so page 1 sizes every sheet.
      const view = (await next.getPage(1)).getViewport({ scale: 1 });
      if (dead) return void loading.destroy();

      committed = true;
      fresh.current = true;
      const previous = docRef.current;
      docRef.current = next;
      setDoc(next);
      setAspect(view.width / view.height);
      onPages(next.numPages);
      // Only now is the old one unreachable. pdf.js 6 hangs teardown off the
      // loading task, not the document.
      void previous?.loadingTask.destroy();

      // Bookmarks are cheap to read and nobody is waiting on them; a document
      // replaced before they arrive simply does not report.
      if (outlineCb.current) {
        readOutline(next).then(
          (entries) => docRef.current === next && outlineCb.current?.(entries),
          () => {},
        );
      }
    })().catch(() => {
      // A corrupt or half-written blob. The pane keeps whatever it was already
      // showing; the compile error itself is the editor pane's to report.
    });

    return () => {
      dead = true;
      // Tear down only a document that never reached the DOM. The live one is
      // destroyed by its successor above, or by the unmount effect below.
      if (!committed) void task?.destroy();
    };
  }, [url, onPages]);

  useEffect(
    () => () => {
      void docRef.current?.loadingTask.destroy();
      docRef.current = null;
    },
    [],
  );

  // Lazy window. One observer for the whole stack; sheets are found in the DOM
  // rather than through refs, which keeps the page list a plain map. A layout
  // switch remounts every sheet, so it re-observes too.
  useEffect(() => {
    const pages = doc?.numPages ?? 0;
    if (!root || !pages) return;
    const io = new IntersectionObserver(
      (entries) =>
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const i = Number((e.target as HTMLElement).dataset.page) - 1;
            if (e.isIntersecting) next.add(i);
            else next.delete(i);
          }
          return next;
        }),
      { root, rootMargin: RENDER_MARGIN },
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-page]")) io.observe(el);
    return () => io.disconnect();
  }, [root, doc, layout]);

  // Pane width drives the render scale. ResizeObserver, not a window listener:
  // the Teks/Halaman toggle resizes this pane without resizing the window.
  useEffect(() => {
    if (!root) return;
    let width = root.clientWidth;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (root.clientWidth === width) return;
      width = root.clientWidth;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setSizeTick((t) => t + 1), RESIZE_SETTLE_MS);
    });
    ro.observe(root);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, [root]);

  const onPageOneRendered = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!fresh.current) return;
      fresh.current = false;
      onFirstPage(canvas);
    },
    [onFirstPage],
  );

  // First compile of the session: the document is still parsing, so the
  // page-shaped skeleton stands in. A recompile never reaches here — `doc` is
  // the outgoing one until the incoming is ready.
  if (!doc) return <Sheet aspect={aspect} variant="skeleton" />;

  const page = (i: number, size: "full" | "half", side?: "verso" | "recto") => (
    <Sheet key={i} aspect={aspect} page={i + 1} size={size} side={side}>
      <PdfPage
        doc={doc}
        index={i}
        visible={visible.has(i)}
        sizeTick={sizeTick}
        onRendered={i === 0 ? onPageOneRendered : undefined}
      />
    </Sheet>
  );

  if (layout === "spread") {
    return (
      <>
        {spreadRows(doc.numPages).map((pages, r) => (
          // The blank half keeps a lone page on its own side of the spine.
          <div key={r} data-row className="flex w-[92%] max-w-[1240px] shrink-0 justify-center">
            {pages.length === 1 && pages[0] % 2 === 1 && <div aria-hidden className="w-1/2 max-w-[620px]" />}
            {pages.map((p) => page(p - 1, "half", p % 2 === 0 ? "verso" : "recto"))}
            {pages.length === 1 && pages[0] % 2 === 0 && <div aria-hidden className="w-1/2 max-w-[620px]" />}
          </div>
        ))}
      </>
    );
  }

  return <>{Array.from({ length: doc.numPages }, (_, i) => page(i, "full"))}</>;
}
