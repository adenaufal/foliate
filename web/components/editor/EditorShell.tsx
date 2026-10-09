"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// Per-icon import: the barrel is thousands of modules and slows dev compiles.
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { CommandPalette, type Command } from "@/components/chrome/CommandPalette";
import { EditorTopBar } from "@/components/chrome/EditorTopBar";
import { PanelLabel } from "@/components/chrome/PanelLabel";
import { InspectorPanel } from "@/components/editor/InspectorPanel";
import { MarkdownPane } from "@/components/editor/MarkdownPane";
import { OutlinePanel } from "@/components/editor/OutlinePanel";
import { ExportDialog } from "@/components/export/ExportDialog";
import { PagePreview } from "@/components/preview/PagePreview";
import { ThemePresets } from "@/components/settings/ThemePresets";
import { BRAND_NAME, COPY } from "@/lib/brand";
import { inlineError, TRIM_PRESET_NAMES, TRIM_SIZES, trimLabel, type TrimPreset } from "@/lib/compile";
import {
  useEditorSession,
  type EditorView,
  type MarkdownPaneHandle,
  type PagePreviewHandle,
  type PdfOutlineEntry,
  type PreviewLayout,
} from "@/lib/editor-session";
import {
  chapterAt,
  chapterNumber,
  formatInt,
  normalizeTitle,
  parseOutline,
  readingMinutes,
  wordCount,
  type Heading,
} from "@/lib/outline";
import { TEMPLATES } from "@/lib/templates";
import { toggleTheme } from "@/lib/theme";

/** Remembered across sessions: which panels are folded away, and whether the
 *  preview shows spreads. The view switch is not — a fresh open shows both. */
const PREF = {
  outline: "foliate-outline-collapsed",
  inspector: "foliate-inspector-collapsed",
  layout: "foliate-preview-layout",
} as const;

/** Mirrors --breakpoint-wide in styles/tokens.css. */
const WIDE = "(min-width: 1200px)";

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode — the choice still holds for this session
  }
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

/** The palette's key hint. Decided after mount; the server cannot know the
 *  platform, and a wrong first paint would be a visible swap. */
function useCommandHint(): string {
  const [hint, setHint] = useState("Ctrl+K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setHint("⌘K");
  }, []);
  return hint;
}

// --- grid --------------------------------------------------------------------
// Grid, not flex percentages: the preview absorbs every extra pixel and the
// writing pane holds its measure. Every column set is spelled out as a literal
// class, because Tailwind only emits what it can read in the source.

const SPLIT_COLS: Record<EditorView, string> = {
  keduanya: "split:grid-cols-[minmax(380px,40fr)_60fr]",
  teks: "split:grid-cols-1",
  halaman: "split:grid-cols-1",
};

function wideCols(view: EditorView, outline: boolean, inspector: boolean): string {
  const both = view === "keduanya";
  if (outline && inspector) {
    return both
      ? "wide:grid-cols-[216px_minmax(0,1fr)_minmax(0,1.12fr)_236px]"
      : "wide:grid-cols-[216px_minmax(0,1fr)_236px]";
  }
  if (outline) {
    return both ? "wide:grid-cols-[216px_minmax(0,1fr)_minmax(0,1.12fr)]" : "wide:grid-cols-[216px_minmax(0,1fr)]";
  }
  if (inspector) {
    return both ? "wide:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)_236px]" : "wide:grid-cols-[minmax(0,1fr)_236px]";
  }
  return both ? "wide:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]" : "wide:grid-cols-[minmax(0,1fr)]";
}

// --- outline ↔ pdf -----------------------------------------------------------

/**
 * Which page each Markdown heading starts on, from the PDF's bookmarks. Typst
 * writes one bookmark per heading in order, so when the counts agree the two
 * lists zip. When they do not — a compile still in flight, a heading inside a
 * block the template dropped — match by words instead, each bookmark once.
 */
function pageResolver(headings: Heading[], outline: PdfOutlineEntry[]): (h: Heading) => number | null {
  const map = new Map<Heading, number>();
  for (const level of [1, 2] as const) {
    const hs = headings.filter((h) => h.level === level);
    const es = outline.filter((e) => e.level === level);
    if (hs.length === es.length) {
      hs.forEach((h, i) => map.set(h, es[i].page));
      continue;
    }
    const pool = [...es];
    for (const h of hs) {
      const key = normalizeTitle(h.title);
      const i = pool.findIndex((e) => normalizeTitle(e.title) === key);
      if (i >= 0) {
        map.set(h, pool[i].page);
        pool.splice(i, 1);
      }
    }
  }
  return (h) => map.get(h) ?? null;
}

/**
 * Editor route composition. Owns the columns, the drawers, the view switch,
 * the command palette and the collapse — nothing else. Every surface below is
 * a leaf that takes values and callbacks from `useEditorSession`.
 */
export function EditorShell({ projectId }: { projectId: string }) {
  const session = useEditorSession(projectId);
  const router = useRouter();
  const wide = useMediaQuery(WIDE);
  const commandHint = useCommandHint();

  const [view, setView] = useState<EditorView>("keduanya");
  const [layout, setLayoutState] = useState<PreviewLayout>("stack");
  // At the wide breakpoint the panels are columns that fold away; below it
  // they are drawers. Two states, because folding a column is a preference
  // and opening a drawer is a moment.
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [outlineDrawer, setOutlineDrawer] = useState(false);
  const [inspectorDrawer, setInspectorDrawer] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineEntry[]>([]);
  const [pageTotal, setPageTotal] = useState<number | null>(null);
  const [caretLine, setCaretLine] = useState(1);

  const markdownRef = useRef<MarkdownPaneHandle>(null);
  const previewRef = useRef<PagePreviewHandle>(null);

  const heading = session.title || COPY.untitled;

  // Preferences land after mount so the first paint matches the server.
  useEffect(() => {
    if (readPref(PREF.outline) === "true") setOutlineCollapsed(true);
    if (readPref(PREF.inspector) === "true") setInspectorCollapsed(true);
    if (readPref(PREF.layout) === "spread") setLayoutState("spread");
  }, []);

  // A drawer left open while the viewport grows into the wide range would sit
  // over its own column. The column takes over.
  useEffect(() => {
    if (!wide) return;
    setOutlineDrawer(false);
    setInspectorDrawer(false);
  }, [wide]);

  // The title lives in IndexedDB, so the server cannot render it — the route's
  // static metadata is only the placeholder until the project loads here.
  useEffect(() => {
    if (session.status === "ready") document.title = `${heading} · ${BRAND_NAME}`;
  }, [session.status, heading]);

  // ⌘K / Ctrl+K anywhere on the route, textarea included.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const headings = useMemo(() => parseOutline(session.markdown), [session.markdown]);
  const words = useMemo(() => wordCount(session.markdown), [session.markdown]);
  const activeIndex = chapterAt(headings, caretLine);
  const chapters = headings.filter((h) => h.level === 1).length;
  const pageOf = useMemo(() => pageResolver(headings, pdfOutline), [headings, pdfOutline]);

  const outlineOpen = wide ? !outlineCollapsed : outlineDrawer;
  const inspectorOpen = wide ? !inspectorCollapsed : inspectorDrawer;

  const setLayout = useCallback((next: PreviewLayout) => {
    setLayoutState(next);
    writePref(PREF.layout, next);
  }, []);

  const toggleOutline = useCallback(() => {
    if (wide) {
      setOutlineCollapsed((c) => {
        writePref(PREF.outline, String(!c));
        return !c;
      });
    } else setOutlineDrawer((o) => !o);
  }, [wide]);

  const toggleInspector = useCallback(() => {
    if (wide) {
      setInspectorCollapsed((c) => {
        writePref(PREF.inspector, String(!c));
        return !c;
      });
    } else setInspectorDrawer((o) => !o);
  }, [wide]);

  // Both panes move: the caret to the heading, the stack to its page.
  const jump = useCallback(
    (h: Heading) => {
      markdownRef.current?.focusLine(h.line);
      const page = pageOf(h);
      if (page) previewRef.current?.scrollToPage(page);
      setOutlineDrawer(false);
    },
    [pageOf],
  );

  const { reportPageCount } = session;
  const onPageCount = useCallback(
    (n: number) => {
      reportPageCount(n);
      setPageTotal(n);
    },
    [reportPageCount],
  );

  const { setTemplate, setTrim, template, trim } = session;
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    for (const t of TEMPLATES) {
      list.push({
        id: `template-${t.id}`,
        group: "Template",
        label: t.label,
        detail: t.descriptor,
        active: template === t.id,
        run: () => setTemplate(t.id),
      });
    }
    for (const id of Object.keys(TRIM_SIZES) as TrimPreset[]) {
      list.push({
        id: `trim-${id}`,
        group: "Ukuran halaman",
        label: TRIM_PRESET_NAMES[id],
        detail: trimLabel(id),
        active: trim === id,
        run: () => setTrim(id),
      });
    }
    headings.forEach((h, i) => {
      if (h.level !== 1) return;
      const page = pageOf(h);
      list.push({
        id: `chapter-${h.line}`,
        group: "Lompat ke bab",
        label: h.title,
        detail: `Bab ${chapterNumber(headings, i)}${page ? ` · hal. ${page}` : ""}`,
        keywords: "bab lompat",
        run: () => jump(h),
      });
    });
    list.push(
      { id: "view-teks", group: "Tampilan", label: "Teks saja", active: view === "teks", run: () => setView("teks") },
      {
        id: "view-keduanya",
        group: "Tampilan",
        label: "Teks dan halaman",
        active: view === "keduanya",
        run: () => setView("keduanya"),
      },
      {
        id: "view-halaman",
        group: "Tampilan",
        label: "Halaman saja",
        active: view === "halaman",
        run: () => setView("halaman"),
      },
      {
        id: "layout",
        group: "Tampilan",
        label: layout === "spread" ? "Satu halaman" : "Spread dua halaman",
        keywords: "spread pratinjau halaman",
        run: () => setLayout(layout === "spread" ? "stack" : "spread"),
      },
      {
        id: "outline",
        group: "Tampilan",
        label: "Kerangka naskah",
        detail: outlineOpen ? "sembunyikan" : "tampilkan",
        run: toggleOutline,
      },
      {
        id: "inspector",
        group: "Tampilan",
        label: "Inspektur penyusunan",
        detail: inspectorOpen ? "sembunyikan" : "tampilkan",
        keywords: "template trim huruf",
        run: toggleInspector,
      },
      { id: "theme", group: "Tampilan", label: "Ganti tema terang / gelap", run: () => void toggleTheme() },
      { id: "export", group: "Berkas", label: `${COPY.export}…`, keywords: "pdf epub", run: () => setExportOpen(true) },
      { id: "library", group: "Berkas", label: COPY.backToLibrary, run: () => router.push("/library") },
    );
    return list;
  }, [
    template,
    trim,
    setTemplate,
    setTrim,
    headings,
    pageOf,
    jump,
    view,
    layout,
    setLayout,
    outlineOpen,
    inspectorOpen,
    toggleOutline,
    toggleInspector,
    router,
  ]);

  if (session.status === "missing") return <NotFound />;

  // The dialog reuses whatever is already on screen; during a recompile that
  // is the outgoing PDF, not nothing.
  const pdfUrl =
    session.compile.kind === "ready"
      ? session.compile.url
      : session.compile.kind === "compiling"
        ? session.compile.previousUrl
        : null;

  const outlinePanel = (
    <OutlinePanel
      headings={headings}
      pageOf={pageOf}
      activeIndex={activeIndex}
      onJump={jump}
      stats={{ words, pages: pageTotal, minutes: readingMinutes(words), chapters }}
    />
  );

  const inspectorPanel = (active: boolean) => (
    <InspectorPanel
      template={session.template}
      onTemplateChange={session.setTemplate}
      trim={session.trim}
      onTrimChange={session.setTrim}
      bodyFont={session.bodyFont}
      active={active}
      themePresets={
        <ThemePresets
          template={session.template}
          bodyFont={session.bodyFont}
          onBodyFontChange={session.setBodyFont}
          fonts={session.fonts}
          onFontUpload={session.addFont}
        />
      }
    />
  );

  return (
    // Definite height, not just a floor: with `min-h` the 1fr row grows to the
    // height of the page stack, the document itself scrolls, and the top bar
    // and page pill ride away with it. dvh, so mobile browser chrome is out.
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] bg-paper">
      {/* The route's heading. Visible as the inline-editable input in the bar,
          so it is hidden here and not a grid row (sr-only is absolute). */}
      <h1 className="sr-only">{heading}</h1>

      <EditorTopBar
        title={session.title}
        onTitleChange={session.setTitle}
        save={session.save}
        onRetrySave={session.retrySave}
        view={view}
        onViewChange={setView}
        outlineOpen={outlineOpen}
        onToggleOutline={toggleOutline}
        inspectorOpen={inspectorOpen}
        onToggleInspector={toggleInspector}
        onExport={() => setExportOpen(true)}
      />

      {/* Columns: outline · text · page · inspector. The side columns exist at
          the wide breakpoint only; the middle pair follows the view switch,
          and below the split breakpoint only one of them shows. Everything
          stays mounted so the pdf.js canvases and the caret survive a toggle. */}
      <main
        id="main"
        className={`grid min-h-0 grid-cols-1 ${SPLIT_COLS[view]} ${wideCols(view, !outlineCollapsed, !inspectorCollapsed)}`}
      >
        <aside
          aria-label="Kerangka naskah"
          className={`${outlineCollapsed ? "hidden" : "hidden wide:block"} min-h-0 min-w-0 border-r border-hairline`}
        >
          {outlinePanel}
        </aside>

        <div
          className={`${view === "halaman" ? "hidden" : "block"} min-h-0 min-w-0 ${
            view === "keduanya" ? "split:border-r split:border-hairline" : ""
          }`}
        >
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
            <EditorHeader
              headings={headings}
              activeIndex={activeIndex}
              caretLine={caretLine}
              words={words}
              commandHint={commandHint}
              onPalette={() => setPaletteOpen(true)}
            />
            <MarkdownPane
              ref={markdownRef}
              value={session.markdown}
              onChange={session.setMarkdown}
              onImportFile={session.importFile}
              onLoadSample={() => void session.loadSample()}
              onCaretLine={setCaretLine}
            />
            {/* The preview pane points here for the detail, so it has to be
                here. Inline, in the service's voice, never a toast (§6.6). */}
            {session.compile.kind === "failed" && (
              <p
                role="alert"
                className="flex items-start gap-2 border-t border-hairline px-page py-3 text-sm leading-relaxed text-accent-ink"
              >
                <WarningCircleIcon size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden />
                {inlineError(session.compile.error)}
              </p>
            )}
          </div>
        </div>

        <div
          className={`${
            view === "teks" ? "hidden" : view === "halaman" ? "block" : "hidden split:block"
          } min-h-0 min-w-0`}
        >
          <PagePreview
            ref={previewRef}
            status={session.compile}
            projectId={projectId}
            trim={session.trim}
            onPageCount={onPageCount}
            layout={layout}
            onLayoutChange={setLayout}
            onOutline={setPdfOutline}
          />
        </div>

        <aside
          aria-label="Inspektur penyusunan"
          className={`${inspectorCollapsed ? "hidden" : "hidden wide:block"} min-h-0 min-w-0 overflow-y-auto border-l border-hairline`}
        >
          {inspectorPanel(wide && !inspectorCollapsed)}
        </aside>
      </main>

      <SideDrawer open={outlineDrawer} onClose={() => setOutlineDrawer(false)} side="left" label="Kerangka naskah">
        {outlinePanel}
      </SideDrawer>
      <SideDrawer
        open={inspectorDrawer}
        onClose={() => setInspectorDrawer(false)}
        side="right"
        label="Inspektur penyusunan"
      >
        <div className="h-full overflow-y-auto">{inspectorPanel(inspectorDrawer)}</div>
      </SideDrawer>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={session.title}
        trim={session.trim}
        pdfUrl={pdfUrl}
        onExport={session.runExport}
      />
    </div>
  );
}

/** Where the caret is, in the book's terms: the chapter, its length, the
 *  line. The ⌘K cap at the end is the palette's one visible handle. */
function EditorHeader({
  headings,
  activeIndex,
  caretLine,
  words,
  commandHint,
  onPalette,
}: {
  headings: Heading[];
  activeIndex: number;
  caretLine: number;
  words: number;
  commandHint: string;
  onPalette: () => void;
}) {
  const chapter = activeIndex >= 0 ? headings[activeIndex] : null;
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-hairline px-page py-2 text-xs text-muted">
      <PanelLabel className="shrink-0">
        {chapter ? `Bab ${chapterNumber(headings, activeIndex)}` : "Naskah"}
      </PanelLabel>
      {chapter && (
        <>
          <span aria-hidden>·</span>
          <span className="truncate text-ink">{chapter.title}</span>
        </>
      )}
      <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums">
        {formatInt(chapter ? chapter.words : words)} kata · baris {caretLine}
      </span>
      <button
        type="button"
        onClick={onPalette}
        title="Perintah"
        aria-label="Buka perintah"
        className="kbd shrink-0 transition-colors duration-150 ease-[var(--ease-enter)] hover:text-ink"
      >
        {commandHint}
      </button>
    </div>
  );
}

/**
 * A side panel below the wide breakpoint. Native <dialog>: showModal() owns
 * the scrim, Escape, the focus trap and the inert page behind it. Content is
 * mounted only while open, so a closed drawer costs nothing.
 */
function SideDrawer({
  open,
  onClose,
  side,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className={`m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-2rem))] max-w-none rounded-none border-hairline bg-paper p-0 text-ink shadow-lift transition-transform duration-200 ease-[var(--ease-enter)] backdrop:bg-scrim/45 ${
        side === "left"
          ? "[inset:0_auto_0_0] border-r starting:-translate-x-full"
          : "[inset:0_0_0_auto] border-l starting:translate-x-full"
      }`}
    >
      {open && <div className="h-full min-h-0 overflow-hidden">{children}</div>}
    </dialog>
  );
}

function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-[1400px] px-page py-10">
      <p className="text-base">{COPY.loadFailed}</p>
      <p className="mt-1 text-sm text-muted">Proyek ini sudah dihapus atau tautannya salah.</p>
      <Link
        href="/library"
        className="mt-4 inline-block text-sm text-accent-ink underline-offset-4 hover:underline"
      >
        {COPY.backToLibrary}
      </Link>
    </main>
  );
}
