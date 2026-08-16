"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openPdf } from "./pdf";
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
 * The compiled PDF as a continuous page stack. Emits sheets only — the scroll
 * container and the field belong to PagePreview, which needs them for the
 * empty and skeleton states too.
 */
export function PdfStack({
  url,
  root,
  trimAspect,
  onPages,
  onFirstPage,
}: {
  url: string;
  /** Scroll container; the IntersectionObserver root. Null on first paint. */
  root: HTMLElement | null;
  /** Aspect from the session trim, used until the real document reports its
   *  own — the stack must resize the instant the trim changes, ahead of the
   *  recompile landing. */
  trimAspect: number;
  onPages: (pages: number) => void;
  /** Page 1 of a freshly compiled document, once painted — card art for the
   *  library. Fired once per compile, never on scroll or resize. */
  onFirstPage: (canvas: HTMLCanvasElement) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [aspect, setAspect] = useState(trimAspect);
  const [visible, setVisible] = useState(NONE);
  const [sizeTick, setSizeTick] = useState(0);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  /** Armed by a document commit, spent by the first page that paints it. A
   *  re-render of the same page — scrolled back, or resized — finds it spent. */
  const fresh = useRef(false);

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
  // rather than through refs, which keeps the page list a plain map.
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
  }, [root, doc]);

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

  return (
    <>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <Sheet key={i} aspect={aspect} page={i + 1}>
          <PdfPage
            doc={doc}
            index={i}
            visible={visible.has(i)}
            sizeTick={sizeTick}
            onRendered={i === 0 ? onPageOneRendered : undefined}
          />
        </Sheet>
      ))}
    </>
  );
}
