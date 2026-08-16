"use client";

import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/** Cap the backing store at 2× CSS pixels. A 3× phone would allocate 22 MB per
 *  sheet for detail nobody can see at this size. */
const MAX_DPR = 2;

/**
 * One page canvas. Renders only while `visible`, cancels the render task and
 * releases the bitmap the moment it is not — a 128-page book keeps ~4 canvases
 * alive, not 128.
 */
export function PdfPage({
  doc,
  index,
  visible,
  /** Bumped by the stack when the pane width changes; forces a re-render at the
   *  new scale, which a plain CSS resize would only blur. */
  sizeTick,
  onRendered,
}: {
  doc: PDFDocumentProxy;
  index: number;
  visible: boolean;
  sizeTick: number;
  /** Handed the live canvas the moment this page is painted. Page 1 is the
   *  library's card art; deciding when that is worth keeping is the stack's
   *  job, not this canvas's. */
  onRendered?: (canvas: HTMLCanvasElement) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    if (!visible) {
      // Scrolled well away: drop the bitmap. Assigning 0 frees the backing
      // store; the sheet underneath reads as a blank page until it returns.
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.opacity = "0";
      return;
    }

    let task: RenderTask | null = null;
    let dead = false;

    void (async () => {
      const page = await doc.getPage(index + 1);
      const css = canvas.clientWidth;
      // A hidden pane (the Teks/Halaman toggle) measures 0 — nothing to draw.
      if (dead || !css) return;

      const scale = (css * Math.min(window.devicePixelRatio || 1, MAX_DPR)) / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const w = Math.round(viewport.width);
      const h = Math.round(viewport.height);

      // Draw into a detached buffer, then composite in one step. pdf.js fills
      // its target with an opaque background before painting, so rendering
      // straight into the live canvas blinks the page out for a frame — on a
      // recompile that reads as the book flashing away and back.
      const buffer = document.createElement("canvas");
      buffer.width = w;
      buffer.height = h;
      task = page.render({ canvas: buffer, viewport });
      try {
        await task.promise;
        if (dead) return;
        // Resizing clears; only pay for it when the scale actually changed.
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        canvas.getContext("2d")?.drawImage(buffer, 0, 0);
        // A page appearing for the first time fades up from the blank sheet; an
        // update lands on pixels that are already there, so it just swaps.
        canvas.style.opacity = "1";
        onRendered?.(canvas);
      } finally {
        buffer.width = 0;
        buffer.height = 0;
      }
    })().catch(() => {
      // RenderingCancelledException on scroll-away, and "worker destroyed" when
      // a newer compile replaced the document mid-render. Both are expected.
    });

    return () => {
      dead = true;
      task?.cancel();
    };
  }, [doc, index, visible, sizeTick, onRendered]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ opacity: 0 }}
      className="block h-full w-full transition-opacity duration-300"
    />
  );
}
