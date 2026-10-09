"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
// Per-icon imports: the barrel is thousands of modules and slows dev compiles.
import { BookOpenIcon } from "@phosphor-icons/react/dist/csr/BookOpen";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
import { cacheThumbnail } from "@/components/library/thumbnail";
import { COPY } from "@/lib/brand";
import { trimAspect } from "@/lib/compile";
import type { CompileStatus, PagePreviewProps, PreviewLayout } from "@/lib/editor-session";
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
 * recessed field — or as facing pages, the way it will be bound. Chrome is one
 * page pill and the one-page/spread toggle; there is deliberately no zoom,
 * rotate, print, fit-width, search, or thumbnail rail (UI-REFERENCE).
 */
export function PagePreview({
  status,
  projectId,
  trim,
  onPageCount,
  layout = "stack",
  onLayoutChange,
  onOutline,
  ref,
}: PagePreviewProps) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const pagesRef = useRef(0);
  /** The page (or facing pair) under the reading line. */
  const [current, setCurrent] = useState<[number, number]>([1, 1]);
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
      pagesRef.current = n;
      setPages(n);
      onPageCount(n);
      showPill();
    },
    [onPageCount, showPill],
  );

  useEffect(() => {
    if (!url) {
      pagesRef.current = 0;
      setPages(0);
    }
  }, [url]);

  // The library card is this project's first page, and this canvas is the only
  // place it ever gets rendered. Deferred a task so the downscale and the webp
  // encode land after the frame that reveals the page — the render is what the
  // user is waiting on, the cache is not. The page count rides along.
  // Writes are serialised in the local driver, so a cache landing on top of an
  // autosave no longer drops either patch (lib/storage `update`).
  const onFirstPage = useCallback(
    (canvas: HTMLCanvasElement) => {
      setTimeout(() => void cacheThumbnail(projectId, canvas, pagesRef.current || undefined), 0);
    },
    [projectId],
  );

  // Sheets (or spread rows) are uniform, so the page under the reading line is
  // arithmetic rather than a walk over 128 elements on every scroll event.
  const locate = useCallback(() => {
    const kids = stackRef.current?.children;
    if (!scroller || !kids?.length) return;
    const first = kids[0] as HTMLElement;
    const pitch =
      kids.length > 1 ? (kids[1] as HTMLElement).offsetTop - first.offsetTop : first.offsetHeight + GUTTER;
    if (pitch <= 0) return;
    const line = scroller.scrollTop + scroller.clientHeight / 2 - first.offsetTop;
    const idx = Math.min(kids.length - 1, Math.max(0, Math.floor(line / pitch)));
    const total = pagesRef.current;
    // Row 0 of a spread is page 1 alone; row i is the pair (2i, 2i+1).
    const [a, b] =
      layout === "spread"
        ? idx === 0
          ? [1, 1]
          : [Math.min(total, 2 * idx), Math.min(total, 2 * idx + 1)]
        : [Math.min(total, idx + 1), Math.min(total, idx + 1)];
    setCurrent((prev) => (prev[0] === a && prev[1] === b ? prev : [a, b]));
  }, [scroller, layout]);

  const onScroll = useCallback(() => {
    showPill();
    locate();
  }, [showPill, locate]);

  // A layout switch rebuilds the stack under the same scroll position.
  useEffect(() => {
    const id = requestAnimationFrame(locate);
    return () => cancelAnimationFrame(id);
  }, [layout, pages, locate]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToPage(page: number) {
        const el = scroller?.querySelector<HTMLElement>(`[data-page="${page}"]`);
        if (!el || !scroller) return;
        scroller.scrollTo({ top: Math.max(0, el.offsetTop - GUTTER), behavior: "smooth" });
        showPill();
      },
    }),
    [scroller, showPill],
  );

  const pill =
    current[1] > current[0]
      ? `hal. ${current[0]}–${current[1]} dari ${pages}`
      : `hal. ${current[0]} dari ${pages}`;

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
        {/* pt-14: room for the layout toggle above the first sheet, so it never
            sits on the page it is about. */}
        <div ref={stackRef} className="flex flex-col items-center gap-6 pb-6 pt-14">
          {status.kind === "failed" ? null : url ? (
            <PdfStack
              url={url}
              root={scroller}
              trimAspect={aspect}
              layout={layout}
              onPages={onPages}
              onFirstPage={onFirstPage}
              onOutline={onOutline}
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

      {/* One page under the other, or facing pages. The only control on the
          stage besides the page pill, and it does not fade: a mode is not
          transient information. */}
      {onLayoutChange && url && (
        <div
          role="group"
          aria-label="Tata letak pratinjau"
          className="absolute right-3 top-3 flex rounded-md border border-hairline bg-paper/90 p-0.5 backdrop-blur-[2px]"
        >
          <LayoutButton
            active={layout === "stack"}
            label="Satu halaman"
            onClick={() => onLayoutChange("stack")}
          >
            <FileIcon size={15} weight="regular" aria-hidden />
          </LayoutButton>
          <LayoutButton
            active={layout === "spread"}
            label="Spread dua halaman"
            onClick={() => onLayoutChange("spread")}
          >
            <BookOpenIcon size={15} weight="regular" aria-hidden />
          </LayoutButton>
        </div>
      )}

      {pages > 0 && (
        <p
          className={`pointer-events-none absolute left-1/2 bottom-[max(1.25rem,var(--safe-bottom))] -translate-x-1/2 whitespace-nowrap rounded-md border border-hairline bg-paper/90 px-2.5 py-1 text-2xs tabular-nums text-muted backdrop-blur-[2px] transition-opacity duration-500 ease-[var(--ease-enter)] ${
            pillOn ? "opacity-100" : "opacity-0"
          }`}
        >
          {pill}
        </p>
      )}
    </div>
  );
}

function LayoutButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`tap grid size-8 place-items-center rounded-[calc(var(--radius-md)-2px)] transition-[color,background-color,scale] duration-150 ease-[var(--ease-enter)] active:scale-[0.96] ${
        active ? "bg-field text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export type { PreviewLayout };
