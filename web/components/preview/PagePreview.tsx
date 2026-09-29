"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cacheThumbnail } from "@/components/library/thumbnail";
import { COPY } from "@/lib/brand";
import { trimAspect } from "@/lib/compile";
import type { CompileStatus, PagePreviewProps } from "@/lib/editor-session";
import { PdfStack } from "./PdfStack";
import { GUTTER, Sheet } from "./Sheet";

/** How long after the last scroll event the page pill fades out. */
const PILL_IDLE_MS = 1000;

/** The PDF the stack should be showing. A recompile keeps the outgoing one on
 *  screen; a failure drops it, because the reducer already discarded it. */
function stackUrl(status: CompileStatus): string | null {
  if (status.kind === "ready") return status.url;
  if (status.kind === "compiling") return status.previousUrl;
  return null;
}

/**
 * The product's hero: the compiled book as a continuous page stack on a warm
 * recessed field. Chrome is one page pill; there is deliberately no zoom,
 * rotate, print, fit-width, search, or thumbnail rail (UI-REFERENCE).
 */
export function PagePreview({ status, projectId, trim, onPageCount }: PagePreviewProps) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pillOn, setPillOn] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aspect = trimAspect(trim);
  const url = stackUrl(status);

  const showPill = useCallback(() => {
    setPillOn(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setPillOn(false), PILL_IDLE_MS);
  }, []);

  useEffect(() => () => void (idle.current && clearTimeout(idle.current)), []);

  const onPages = useCallback(
    (n: number) => {
      setPages(n);
      onPageCount(n);
      showPill();
    },
    [onPageCount, showPill],
  );

  useEffect(() => {
    if (!url) setPages(0);
  }, [url]);

  // The library card is this project's first page, and this canvas is the only
  // place it ever gets rendered. Deferred a task so the downscale and the webp
  // encode land after the frame that reveals the page — the render is what the
  // user is waiting on, the cache is not.
  // Writes are serialised in the local driver, so a cache landing on top of an
  // autosave no longer drops either patch (lib/storage `update`).
  const onFirstPage = useCallback(
    (canvas: HTMLCanvasElement) => {
      setTimeout(() => void cacheThumbnail(projectId, canvas), 0);
    },
    [projectId],
  );

  // Sheets are uniform, so the page under the reading line is arithmetic
  // rather than a walk over 128 elements on every scroll event.
  const onScroll = useCallback(() => {
    showPill();
    const sheets = stackRef.current?.children;
    if (!scroller || !sheets?.length) return;
    const first = sheets[0] as HTMLElement;
    const pitch =
      sheets.length > 1 ? (sheets[1] as HTMLElement).offsetTop - first.offsetTop : first.offsetHeight + GUTTER;
    if (pitch <= 0) return;
    const line = scroller.scrollTop + scroller.clientHeight / 2 - first.offsetTop;
    setCurrent(Math.min(sheets.length, Math.max(1, Math.floor(line / pitch) + 1)));
  }, [scroller, showPill]);

  return (
    <div className="relative h-full bg-field">
      <div
        ref={setScroller}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Pratinjau halaman"
        className="relative h-full overflow-y-auto overscroll-contain"
      >
        <div ref={stackRef} className="flex flex-col items-center gap-6 py-6">
          {status.kind === "failed" ? null : url ? (
            <PdfStack
              url={url}
              root={scroller}
              trimAspect={aspect}
              onPages={onPages}
              onFirstPage={onFirstPage}
            />
          ) : status.kind === "compiling" ? (
            <Sheet aspect={aspect} variant="skeleton" />
          ) : (
            <Sheet aspect={aspect} variant="outline">
              <p className="text-sm text-muted">{COPY.previewEmpty}</p>
            </Sheet>
          )}
        </div>
      </div>

      {/* Quiet on purpose: the stage, line number, and hint belong to the
          editor pane, which gets the same status object. */}
      {status.kind === "failed" && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <p className="text-sm">Pratinjau belum bisa dibuat.</p>
            <p className="mt-1 text-xs text-muted">Detail galatnya ada di panel teks.</p>
          </div>
        </div>
      )}

      {pages > 0 && (
        <p
          className={`pointer-events-none absolute left-1/2 bottom-[max(1.25rem,var(--safe-bottom))] -translate-x-1/2 rounded-md border border-hairline bg-paper/90 px-2.5 py-1 text-2xs tabular-nums text-muted backdrop-blur-[2px] transition-opacity duration-500 ease-[var(--ease-enter)] ${
            pillOn ? "opacity-100" : "opacity-0"
          }`}
        >
          hal. {current} dari {pages}
        </p>
      )}
    </div>
  );
}
