"use client";

// Export sheet. Two columns: the choices on the left, the page already on
// screen on the right (UI-REFERENCE, export dialog).
//
// Built on native <dialog>: showModal() gives the focus trap, Escape, the
// inert background, aria-modal, and focus restored to the Ekspor trigger for
// free. No dialog library is installed and none is needed.

import { useEffect, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { COPY } from "@/lib/brand";
import { TRIM_SIZES, trimAspect, type Trim } from "@/lib/compile";
import { exportFilename, type ExportDialogProps, type ExportFormat } from "@/lib/editor-session";

const FORMATS: ExportFormat[] = ["pdf", "epub"];
const TOAST_MS = 6000;

export function ExportDialog({ open, onClose, title, trim, pdfUrl, onExport }: ExportDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [chosenTrim, setChosenTrim] = useState<Trim>(trim);
  const [includeToc, setIncludeToc] = useState(true);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ format: ExportFormat; filename: string } | null>(null);

  // Reopening is a fresh export: the sheet inherits the session trim again and
  // drops the previous run's error.
  useEffect(() => {
    if (!open) return;
    setFormat("pdf");
    setChosenTrim(trim);
    setIncludeToc(true);
    setName(title);
    setError(null);
    // `trim`/`title` are seeds, not sources of truth while the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await onExport({ format, trim: chosenTrim, includeToc, filename: name });
    setBusy(false);
    if (result.status === "failed") setError(result.message);
    if (result.status === "saved") {
      setToast({ format, filename: result.filename });
      ref.current?.close();
    }
    // "cancelled" = the save dialog was dismissed. Nothing to say about it.
  }

  const label = format.toUpperCase();

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby="export-title"
        onClose={onClose}
        // Only the backdrop can carry a click targeted at the dialog itself:
        // every pixel of the sheet belongs to the child below.
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        // `m-auto` restores the UA's centring: Tailwind's preflight zeroes the
        // `margin: auto` a modal <dialog> relies on, pinning it to the corner.
        className="m-auto w-[min(92vw,880px)] max-w-none rounded-xl border border-hairline bg-paper p-0 text-ink shadow-page backdrop:bg-scrim/45"
      >
        <div className="relative grid max-h-[88dvh] grid-rows-[auto_1fr] overflow-hidden rounded-xl">
          <h2 id="export-title" className="border-b border-hairline px-5 py-3.5 text-lg tracking-tight">
            {COPY.export}
          </h2>

          {/* Scrolls at every width. The two-column layout needs 720px for the
              420px page at 5×8 plus its padding; a 800px-tall laptop leaves
              ~654px, and the parent is `overflow-hidden`, so without this the
              sheet clips the page instead of scrolling it. */}
          <div className="grid min-h-0 grid-cols-1 overflow-y-auto md:grid-cols-[35fr_65fr]">
            {/* Left — the choices. Flows to the bottom so the CTA sits at the
                foot of the column at every width. */}
            <div className="flex flex-col gap-5 px-5 py-5">
              <Segmented
                legend="Format"
                options={FORMATS.map((f) => ({ key: f, label: f.toUpperCase(), value: f }))}
                selected={(f) => f === format}
                onSelect={setFormat}
              />

              <Row label="Trim">
                <Segmented
                  legend="Trim"
                  mono
                  options={trimOptions(trim).map((t) => ({ key: trimKey(t), label: trimLabel(t), value: t }))}
                  selected={(t) => sameTrim(t, chosenTrim)}
                  onSelect={setChosenTrim}
                />
              </Row>

              <Row label="Sertakan TOC">
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeToc}
                  aria-label="Sertakan TOC"
                  onClick={() => setIncludeToc((v) => !v)}
                  className={`h-6 w-11 shrink-0 rounded-full border border-hairline transition-colors duration-150 ${
                    includeToc ? "bg-accent" : "bg-field"
                  }`}
                >
                  <span
                    className={`block size-4.5 rounded-full bg-paper transition-transform duration-150 ${
                      includeToc ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </Row>

              {/* HANDOFF §6.6: label above the field, helper below, gap-2. */}
              <div className="flex flex-col gap-2">
                <label htmlFor="export-filename" className="text-sm text-muted">
                  Nama file
                </label>
                <input
                  id="export-filename"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  spellCheck={false}
                  className="h-10 w-full rounded-md border border-hairline bg-paper px-3 text-sm text-ink"
                />
                <p className="truncate font-mono text-2xs text-muted">
                  {exportFilename(name || title, format)}
                </p>
              </div>

              {/* Failure belongs here, in the service's own voice — never a
                  toast, never a stack trace (HANDOFF §6.6). */}
              {error && (
                <p role="alert" className="text-sm leading-relaxed text-accent-ink">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="mt-auto h-10 w-full rounded-md bg-accent px-4 text-sm font-medium text-on-accent transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? "Menyusun…" : `${COPY.export} ${label}`}
              </button>
            </div>

            {/* Right — the page already in the preview stack, re-rendered from
                the same object URL. No fetch, no recompile. */}
            <div className="grid place-items-center bg-field px-6 py-6 md:border-l md:border-hairline">
              {/* Gated on `open`: a closed <dialog> is display:none, so a render
                  keyed only on pdfUrl measures a 0-width box and paints a 0×0
                  canvas that never recovers when the sheet is opened. */}
              <FirstPage pdfUrl={open ? pdfUrl : null} trim={trim} />
            </div>
          </div>

          {/* Last in the DOM so the sheet opens with focus on the format
              control rather than on a close button. */}
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Tutup"
            title="Tutup"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-muted transition-[color,transform] duration-150 hover:text-ink active:scale-[0.96]"
          >
            <XIcon size={16} weight="regular" />
          </button>
        </div>
      </dialog>

      {/* Outside the dialog: by the time it fires the sheet has closed, and a
          toast inside a closed <dialog> would never be seen. */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border border-hairline bg-paper px-4 py-3 shadow-page"
        >
          <div className="min-w-0">
            <p className="text-sm">{toast.format.toUpperCase()} tersimpan</p>
            <p className="truncate font-mono text-2xs text-muted">{toast.filename}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup"
            className="-mr-1 grid size-6 shrink-0 place-items-center rounded-sm text-muted transition-colors duration-150 hover:text-ink"
          >
            <XIcon size={14} weight="regular" />
          </button>
        </div>
      )}
    </>
  );
}

// --- rows --------------------------------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Two or three exclusive choices, so a segmented control rather than a select.
 *  Same idiom as the editor's Teks/Halaman toggle. */
function Segmented<T>({
  legend,
  options,
  selected,
  onSelect,
  mono,
}: {
  legend: string;
  options: { key: string; label: string; value: T }[];
  selected: (value: T) => boolean;
  onSelect: (value: T) => void;
  mono?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={legend}
      className="flex min-w-0 flex-wrap gap-0.5 rounded-md border border-hairline p-0.5"
    >
      {options.map((o) => (
        // `grow shrink-0`: shares the free space like a segmented control, but
        // wraps to a second line rather than clipping `148 × 210 mm`.
        <button
          key={o.key}
          type="button"
          aria-pressed={selected(o.value)}
          onClick={() => onSelect(o.value)}
          className={`shrink-0 grow whitespace-nowrap rounded-sm px-3 py-1.5 text-sm transition-[color,background-color] duration-150 active:scale-[0.98] ${
            mono ? "font-mono text-2xs" : ""
          } ${selected(o.value) ? "bg-field text-ink" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- trim --------------------------------------------------------------------
// The three presets, plus the session's own trim when it is a custom size —
// otherwise opening the sheet would silently drop it.

function trimOptions(current: Trim): Trim[] {
  const presets = Object.keys(TRIM_SIZES) as (keyof typeof TRIM_SIZES)[];
  return typeof current === "string" ? presets : [...presets, current];
}

function trimKey(t: Trim): string {
  return typeof t === "string" ? t : `${t.width}x${t.height}${t.unit ?? "in"}`;
}

function trimLabel(t: Trim): string {
  if (typeof t === "string") return TRIM_SIZES[t]?.label ?? t;
  const n = (v: number) => v.toLocaleString("id-ID");
  return `${n(t.width)} × ${n(t.height)} ${t.unit ?? "in"}`;
}

function sameTrim(a: Trim, b: Trim): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.width === b.width && a.height === b.height && (a.unit ?? "in") === (b.unit ?? "in");
}

// --- first page --------------------------------------------------------------

/** Page 1 of the PDF the preview pane is already showing. pdf.js reads the
 *  existing object URL — nothing crosses the network. */
function FirstPage({ pdfUrl, trim }: { pdfUrl: string | null; trim: Trim }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    setPainted(false);
    const box = wrap.current;
    const cv = canvas.current;
    if (!pdfUrl || !box || !cv) return;

    let live = true;
    // Teardown lives on the loading task in pdf.js 6, not on the document.
    let task: { destroy: () => Promise<void> } | null = null;

    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc ||= new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const loading = pdfjs.getDocument({ url: pdfUrl });
      task = loading;
      const doc = await loading.promise;
      if (!live) return;

      const page = await doc.getPage(1);
      // Measured after the awaits, by which point the parent effect has run
      // showModal(). Zero still means "not laid out" — painting it would bake
      // an empty bitmap in for the life of the sheet.
      if (!live || !box.clientWidth) return;
      const base = page.getViewport({ scale: 1 });
      // Cap at 2× — a 3× phone panel triples the bitmap for no visible gain.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (box.clientWidth / base.width) * dpr });

      cv.width = Math.round(viewport.width);
      cv.height = Math.round(viewport.height);
      if (!live) return;
      await page.render({ canvas: cv, viewport }).promise;
      if (live) setPainted(true);
    })().catch(() => {
      // A page that will not render leaves the empty outline standing; the
      // export itself does not depend on it.
    });

    return () => {
      live = false;
      void task?.destroy();
    };
  }, [pdfUrl]);

  return (
    <div
      ref={wrap}
      // Trim-sized before anything paints, so the sheet never changes shape.
      style={{ aspectRatio: trimAspect(trim) }}
      className="relative w-full max-w-[420px] overflow-hidden rounded-sm border border-hairline shadow-page"
    >
      {/* Nothing yet: an empty page outline. No shimmer — shimmer means
          "working" and must not also mean "empty" (UI-REFERENCE). */}
      {!pdfUrl && (
        <p className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-muted">
          {COPY.previewEmpty}
        </p>
      )}
      <canvas
        ref={canvas}
        aria-hidden
        className={`absolute inset-0 size-full bg-paper transition-opacity duration-200 ${
          painted ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
