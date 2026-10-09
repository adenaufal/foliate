"use client";

// Client-side state for one open project: load/save through the storage driver,
// and the debounced compile that turns the manuscript into the preview PDF.
// The editor surfaces below this file are dumb — they take values and
// callbacks, never a setState. Their prop types live here so the surfaces
// import the contract instead of guessing at it.
//
// Self-check (pure reducer, no IndexedDB — safe to run anywhere):
//   node .session-check.mjs
//   import("@/lib/editor-session").then(m => console.log(m.selfCheckSession()))

import { useCallback, useEffect, useReducer, useRef, type Ref } from "react";
import { COPY } from "./brand";
import {
  compile,
  CompileFailed,
  DEFAULT_TEMPLATE,
  DEFAULT_TRIM,
  type CompileErrorBody,
  type CompileMetadata,
  type CompileRequest,
  type TemplateId,
  type Trim,
} from "./compile";
import { storage, type Project } from "./storage";

/** Autosave debounce. Long enough that a burst of typing is one write. */
const SAVE_DEBOUNCE_MS = 800;
/** Compile debounce — BUILD-PLAN §1 puts the live preview at 600–800 ms. */
const COMPILE_DEBOUNCE_MS = 700;
const MAX_FONT_BYTES = 8 * 1024 * 1024;
/** Uploaded faces are stored inside the project record, which autosave rewrites
 *  whole. A body font is one file, not a library — keep the newest few.
 *  ponytail: a flat count, not a byte budget. Revisit if 8 MB faces show up. */
const MAX_FONTS = 4;
const TEXT_FILE = /\.(md|markdown|txt)$/i;
/** Typst reads TTF/OTF (and their collections); nothing else is worth uploading. */
const FONT_FILE = /\.(otf|ttf|otc|ttc)$/i;

// --- public types ------------------------------------------------------------

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SaveState {
  status: SaveStatus;
  /** Epoch ms of the last successful write; null until one lands. Drives the
   *  relative prose in the top bar (`savedAgo` in lib/brand). */
  lastSavedAt: number | null;
}

/**
 * Preview state. `compiling` carries the outgoing PDF so a recompile can
 * crossfade instead of blanking — the page-shaped skeleton is for the *first*
 * compile, when `previousUrl` is null (UI-REFERENCE, preview pane).
 */
export type CompileStatus =
  | { kind: "empty" }
  | { kind: "compiling"; previousUrl: string | null }
  | { kind: "ready"; url: string; pageCount: number | null }
  | { kind: "failed"; error: CompileErrorBody };

/** An OpenType face uploaded this session, in the shape the service wants. */
export interface UploadedFont {
  /** Original filename. Not the family name — see ThemePresetsProps. */
  name: string;
  /** base64, no data: prefix. */
  data: string;
}

export type ExportFormat = "pdf" | "epub";

export interface ExportOptions {
  format: ExportFormat;
  /** Defaults to the session trim; the dialog may override it for this export. */
  trim: Trim;
  includeToc: boolean;
  /** Without extension is fine — the format's extension is enforced. */
  filename: string;
}

export type ExportResult =
  | { status: "saved"; filename: string }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

/** Everything one open project holds. All of it persists except `metadata`,
 *  which is a per-compile override with no setter and therefore no storage. */
export interface SessionDoc {
  title: string;
  markdown: string;
  template: TemplateId;
  trim: Trim;
  metadata: CompileMetadata;
  /** Family name for the template's `body-font:`; null = the template's own. */
  bodyFont: string | null;
  fonts: UploadedFont[];
}

export interface EditorSession extends SessionDoc {
  /** `missing` covers both a deleted id and a driver that cannot read. */
  status: "loading" | "ready" | "missing";
  projectId: string;
  save: SaveState;
  compile: CompileStatus;

  setTitle: (title: string) => void;
  setMarkdown: (markdown: string) => void;
  setTemplate: (template: TemplateId) => void;
  setTrim: (trim: Trim) => void;
  setBodyFont: (family: string | null) => void;

  /** Replaces the manuscript from a dropped/picked file. Resolves null on
   *  success, or an Indonesian message to show inline. */
  importFile: (file: File) => Promise<string | null>;
  /** Loads public/samples/manuscript.md into this project. */
  loadSample: () => Promise<void>;
  /** Same contract as importFile, for an OpenType upload. */
  addFont: (file: File) => Promise<string | null>;

  /** pdf.js reports the real page count back up. */
  reportPageCount: (pages: number) => void;
  /** After `Gagal menyimpan` — writes immediately. */
  retrySave: () => void;
  runExport: (options: ExportOptions) => Promise<ExportResult>;
}

// --- leaf component props ----------------------------------------------------
// Each surface is built by a different agent. Every pane fills its grid cell
// (`h-full`) and owns its own scroll and background; the shell owns the split,
// the divider, and the collapse.

export interface MarkdownPaneHandle {
  /** Puts the caret at the start of a 1-based line and scrolls it into view —
   *  the outline's jump. */
  focusLine: (line: number) => void;
}

export interface MarkdownPaneProps {
  /** Controlled — a file drop replaces the whole document. */
  value: string;
  onChange: (markdown: string) => void;
  /**
   * Drop target and file picker. Resolves null on success, or a message to
   * render inline beside the drop zone.
   * ponytail: v0 accepts .md/.markdown/.txt only. The service converts .docx
   * on its way to a PDF but exposes no markdown-out route, so a .docx cannot
   * reach this editor as text — label the ghost button accordingly.
   */
  onImportFile: (file: File) => Promise<string | null>;
  /** Empty-state ghost action: loads the sample manuscript. */
  onLoadSample: () => void;
  /** The 1-based line the caret is on, whenever that changes. Drives the
   *  active chapter in the outline and the `baris N` readout. */
  onCaretLine?: (line: number) => void;
  ref?: Ref<MarkdownPaneHandle>;
}

/** One page under the other, or facing pages as the book will be bound. */
export type PreviewLayout = "stack" | "spread";

/** A bookmark of the compiled PDF, resolved to its 1-based physical page. */
export interface PdfOutlineEntry {
  title: string;
  page: number;
  /** 1 = chapter, 2 = section. */
  level: number;
}

export interface PagePreviewHandle {
  scrollToPage: (page: number) => void;
}

export interface PagePreviewProps {
  status: CompileStatus;
  /** The project this stack belongs to — for caching the first page as the
   *  library thumbnail. The canvas lives here and nowhere else. */
  projectId: string;
  /** Sizes the empty outline and the compile skeleton before any PDF exists,
   *  and resizes the stack the moment the trim changes — ahead of the
   *  recompile landing. `trimAspect(trim)` from lib/compile. */
  trim: Trim;
  /** pdf.js is the only thing that knows the count; report it up. */
  onPageCount: (pages: number) => void;
  /** Defaults to `stack`. The toggle only renders when `onLayoutChange` is given. */
  layout?: PreviewLayout;
  onLayoutChange?: (layout: PreviewLayout) => void;
  /** The PDF's own bookmarks, once a document lands — how the outline panel
   *  learns which page each chapter starts on. */
  onOutline?: (entries: PdfOutlineEntry[]) => void;
  ref?: Ref<PagePreviewHandle>;
}

/** Which panes the editor shows. `keduanya` only exists at the split
 *  breakpoint and above; below it the shell reads it as `teks`. */
export type EditorView = "teks" | "keduanya" | "halaman";

export interface EditorTopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  save: SaveState;
  onRetrySave: () => void;
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  /** Outline and inspector: columns at the wide breakpoint, drawers below it.
   *  `open` reflects whichever the viewport is showing. */
  outlineOpen: boolean;
  onToggleOutline: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  /** Opens the export sheet. The bar's one filled button. */
  onExport: () => void;
}

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Seeds the `Nama file` field. */
  title: string;
  trim: Trim;
  /** The PDF already in the preview stack — render page 1 from this object
   *  URL, do not re-fetch. Null until something has compiled. */
  pdfUrl: string | null;
  onExport: (options: ExportOptions) => Promise<ExportResult>;
}

export interface ThemePresetsProps {
  template: TemplateId;
  bodyFont: string | null;
  onBodyFontChange: (family: string | null) => void;
  /** Faces uploaded this session. `name` is the filename — Typst matches on
   *  the *family* name, which the filename does not reliably give, so the row
   *  must let the user confirm it via onBodyFontChange. */
  fonts: UploadedFont[];
  onFontUpload: (file: File) => Promise<string | null>;
}

// --- reducer -----------------------------------------------------------------
// One atom, pure transitions. Object-URL lifecycle stays in the hook; the
// reducer only carries the string.

interface SessionState {
  status: "loading" | "ready" | "missing";
  doc: SessionDoc;
  save: SaveState;
  compile: CompileStatus;
}

type SessionAction =
  | { type: "loaded"; project: Project }
  | { type: "missing" }
  | { type: "edit"; patch: Partial<SessionDoc> }
  | { type: "saved"; at: number }
  | { type: "saveFailed" }
  | { type: "compileStart" }
  | { type: "compile"; status: CompileStatus }
  | { type: "pages"; count: number };

const EMPTY: CompileStatus = { kind: "empty" };

const initialState: SessionState = {
  status: "loading",
  doc: {
    title: "",
    markdown: "",
    template: DEFAULT_TEMPLATE,
    trim: DEFAULT_TRIM,
    metadata: {},
    bodyFont: null,
    fonts: [],
  },
  save: { status: "idle", lastSavedAt: null },
  compile: EMPTY,
};

function previousUrlOf(c: CompileStatus): string | null {
  return c.kind === "ready" ? c.url : c.kind === "compiling" ? c.previousUrl : null;
}

function reduce(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "loaded": {
      const { title, markdown, template, trim, bodyFont, fonts } = action.project;
      return {
        ...state,
        status: "ready",
        doc: {
          ...state.doc,
          title,
          markdown,
          template,
          trim,
          // Absent on projects written before theming existed.
          bodyFont: bodyFont ?? null,
          fonts: fonts ?? [],
        },
      };
    }
    case "missing":
      return { ...state, status: "missing" };
    case "edit":
      // The write is debounced, but "Menyimpan…" is true the moment the
      // document differs from disk, so it shows now.
      return {
        ...state,
        doc: { ...state.doc, ...action.patch },
        save: { ...state.save, status: "saving" },
      };
    case "saved":
      return { ...state, save: { status: "saved", lastSavedAt: action.at } };
    case "saveFailed":
      return { ...state, save: { ...state.save, status: "error" } };
    case "compileStart":
      return { ...state, compile: { kind: "compiling", previousUrl: previousUrlOf(state.compile) } };
    case "compile":
      return state.compile === action.status ? state : { ...state, compile: action.status };
    case "pages":
      return state.compile.kind === "ready"
        ? { ...state, compile: { ...state.compile, pageCount: action.count } }
        : state;
  }
}

// --- request assembly --------------------------------------------------------

/** compile.ts's CompileRequest predates the service's format/bodyFont/fonts
 *  fields (compile-service/src/server.mjs `compileSchema` accepts all three).
 *  Widened here rather than editing a file this task does not own. */
type CompileRequestExt = CompileRequest & {
  format?: ExportFormat;
  bodyFont?: string;
  fonts?: UploadedFont[];
  toc?: boolean;
};

/** The pipeline treats request metadata as an override of the manuscript's
 *  front matter. A project still called "Tanpa judul" has nothing worth
 *  overriding with, so front matter wins there. */
function effectiveMetadata(doc: SessionDoc): CompileMetadata {
  const title = doc.metadata.title ?? (doc.title && doc.title !== COPY.untitled ? doc.title : undefined);
  return title ? { ...doc.metadata, title } : { ...doc.metadata, title: undefined };
}

/** Newest upload wins a name collision, and the set stays capped. */
function withFont(fonts: UploadedFont[], font: UploadedFont): UploadedFont[] {
  return [...fonts.filter((f) => f.name !== font.name), font].slice(-MAX_FONTS);
}

function requestFor(doc: SessionDoc, extra?: Partial<CompileRequestExt>): CompileRequestExt {
  return {
    markdown: doc.markdown,
    template: doc.template,
    trim: doc.trim,
    metadata: effectiveMetadata(doc),
    ...(doc.bodyFont ? { bodyFont: doc.bodyFont } : {}),
    ...(doc.fonts.length ? { fonts: doc.fonts } : {}),
    ...extra,
  };
}

function errorBody(e: unknown): CompileErrorBody {
  if (e instanceof CompileFailed) return e.body;
  return { error: true, stage: "network", message: COPY.compileServiceDown };
}

/** Windows-illegal characters out, one extension in. */
export function exportFilename(name: string, format: ExportFormat): string {
  const base =
    name
      .replace(/\.(pdf|epub)$/i, "")
      .replace(/[\\/:*?"<>|]+/g, "")
      .trim()
      .slice(0, 80) || "buku";
  return `${base}.${format}`;
}

// --- unsaved-edit stash ------------------------------------------------------
// BUILD-PLAN §2.8: a reload keeps the project *including unsaved edits*. The
// autosave is debounced and IndexedDB is async, so a reload fired inside that
// window destroys the document mid-write and the last keystrokes are gone.
// localStorage is the one store that writes synchronously during `pagehide`.

type Stash = Omit<SessionDoc, "metadata" | "fonts">;

const stashKey = (projectId: string) => `foliate-stash-${projectId}`;

/** ponytail: uploaded faces are left out — they are megabytes of base64 against
 *  a ~5 MB quota, and they are never the thing lost mid-sentence. */
function writeStash(projectId: string, doc: SessionDoc): void {
  const { title, markdown, template, trim, bodyFont } = doc;
  try {
    localStorage.setItem(stashKey(projectId), JSON.stringify({ title, markdown, template, trim, bodyFont }));
  } catch {
    // Quota, or a manuscript larger than it. Best effort, same as before.
  }
}

/** Reads and clears in one go: a stash is replayed exactly once. */
function takeStash(projectId: string): Stash | null {
  try {
    const raw = localStorage.getItem(stashKey(projectId));
    if (!raw) return null;
    localStorage.removeItem(stashKey(projectId));
    return JSON.parse(raw) as Stash;
  } catch {
    return null;
  }
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on a font.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// --- hook --------------------------------------------------------------------

export function useEditorSession(projectId: string): EditorSession {
  const [state, dispatch] = useReducer(reduce, initialState);
  const docRef = useRef(state.doc);
  const urlRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    docRef.current = state.doc;
  }, [state.doc]);

  useEffect(() => {
    let live = true;
    storage
      .get(projectId)
      .then((p) => {
        if (!live) return;
        if (!p) return dispatch({ type: "missing" });
        // Keystrokes the debounce had not written when the tab went away
        // (see `takeStash`). Restoring is itself unsaved, so schedule a write.
        const stash = takeStash(projectId);
        dispatch({ type: "loaded", project: stash ? { ...p, ...stash } : p });
        if (stash) edit({});
      })
      .catch(() => live && dispatch({ type: "missing" }));
    return () => {
      live = false;
    };
    // `edit` is stable for a given projectId; re-running this on it would reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const { title, markdown, template, trim, bodyFont, fonts } = docRef.current;
    try {
      const saved = await storage.update(projectId, { title, markdown, template, trim, bodyFont, fonts });
      dispatch({ type: "saved", at: saved.updatedAt });
    } catch {
      dispatch({ type: "saveFailed" });
    }
  }, [projectId]);

  /** Single mutation path. Every field of the doc that has a setter is stored,
   *  so every edit schedules the same debounced write. */
  const edit = useCallback(
    (patch: Partial<SessionDoc>) => {
      dispatch({ type: "edit", patch });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  // Navigating away inside the debounce window would drop the last keystrokes.
  // The guard also makes StrictMode's throwaway mount a no-op — no timer, no write.
  // A reload or a closed tab never runs that cleanup, hence pagehide too — but a
  // reload tears the document down before an IndexedDB write can land, so the
  // stash goes first: localStorage is synchronous and does survive.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return;
      writeStash(projectId, docRef.current);
      void flushSave();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        void flushSave();
      }
    };
  }, [flushSave, projectId]);

  // Compile. Any change to the document re-runs this, so the cleanup is also
  // the cancellation: a newer edit aborts the request the previous one started.
  useEffect(() => {
    if (state.status !== "ready") return;
    const doc = state.doc;
    if (!doc.markdown.trim()) {
      dispatch({ type: "compile", status: EMPTY });
      return;
    }

    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      dispatch({ type: "compileStart" });
      try {
        const blob = await compile(requestFor(doc), ctl.signal);
        if (ctl.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        dispatch({ type: "compile", status: { kind: "ready", url, pageCount: null } });
      } catch (e) {
        if (ctl.signal.aborted) return;
        dispatch({ type: "compile", status: { kind: "failed", error: errorBody(e) } });
      }
    }, COMPILE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [state.status, state.doc]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const importFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (!TEXT_FILE.test(file.name)) {
        return "Format berkas itu belum didukung. Tarik file .md, .markdown, atau .txt.";
      }
      edit({ markdown: await file.text() });
      return null;
    },
    [edit],
  );

  const loadSample = useCallback(async () => {
    const markdown = await fetch("/samples/manuscript.md").then((r) => r.text());
    const title = /^---[\s\S]*?\btitle:\s*(.+)$/m.exec(markdown)?.[1]?.trim();
    edit(title ? { markdown, title } : { markdown });
  }, [edit]);

  const addFont = useCallback(
    async (file: File): Promise<string | null> => {
      if (!FONT_FILE.test(file.name)) return "Hanya file .otf atau .ttf yang didukung.";
      if (file.size > MAX_FONT_BYTES) return "Ukuran font melebihi 8 MB.";
      const data = toBase64(await file.arrayBuffer());
      edit({ fonts: withFont(docRef.current.fonts, { name: file.name, data }) });
      return null;
    },
    [edit],
  );

  const runExport = useCallback(async (options: ExportOptions): Promise<ExportResult> => {
    const filename = exportFilename(options.filename || docRef.current.title, options.format);
    try {
      const blob = await compile(
        requestFor(docRef.current, {
          trim: options.trim,
          format: options.format,
          toc: options.includeToc,
        }),
      );
      const written = await storage.saveExport(blob, filename);
      return written ? { status: "saved", filename: written } : { status: "cancelled" };
    } catch (e) {
      return { status: "failed", message: e instanceof CompileFailed ? e.inline : errorBody(e).message };
    }
  }, []);

  return {
    ...state.doc,
    status: state.status,
    projectId,
    save: state.save,
    compile: state.compile,

    setTitle: useCallback((title: string) => edit({ title }), [edit]),
    setMarkdown: useCallback((markdown: string) => edit({ markdown }), [edit]),
    setTemplate: useCallback((template: TemplateId) => edit({ template }), [edit]),
    setTrim: useCallback((trim: Trim) => edit({ trim }), [edit]),
    setBodyFont: useCallback((bodyFont: string | null) => edit({ bodyFont }), [edit]),

    importFile,
    loadSample,
    addFont,

    reportPageCount: useCallback((count: number) => dispatch({ type: "pages", count }), []),
    retrySave: useCallback(() => void flushSave(), [flushSave]),
    runExport,
  };
}

// --- self-check --------------------------------------------------------------
// Pure transitions only, so this runs without a DOM or a compile service.

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`editor-session self-check: ${msg}`);
}

export function selfCheckSession(): string {
  const project: Project = {
    id: "p1",
    title: "Senja",
    markdown: "# Bab",
    template: "contemporary",
    trim: "6x9",
    bodyFont: "Spectral",
    fonts: [{ name: "a.otf", data: "AA" }],
    createdAt: 1,
    updatedAt: 2,
  };

  let s = reduce(initialState, { type: "loaded", project });
  ok(s.status === "ready" && s.doc.title === "Senja" && s.doc.trim === "6x9", "load fills the doc");
  ok(s.doc.bodyFont === "Spectral" && s.doc.fonts.length === 1, "load restores the theme choices");
  ok(s.save.status === "idle", "loading is not a save");

  const legacy = reduce(initialState, { type: "loaded", project: { ...project, bodyFont: undefined, fonts: undefined } });
  ok(legacy.doc.bodyFont === null && legacy.doc.fonts.length === 0, "a project written before theming still loads");

  s = reduce(s, { type: "edit", patch: { markdown: "# Bab satu" } });
  ok(s.doc.markdown === "# Bab satu" && s.doc.title === "Senja", "edit merges the patch");
  ok(s.save.status === "saving", "an edit shows Menyimpan…");

  s = reduce(s, { type: "saved", at: 99 });
  ok(s.save.status === "saved" && s.save.lastSavedAt === 99, "saved records the timestamp");
  s = reduce(s, { type: "saveFailed" });
  ok(s.save.status === "error" && s.save.lastSavedAt === 99, "a failure keeps the last good timestamp");

  // compile: first run has no page to crossfade from
  s = reduce(s, { type: "compileStart" });
  ok(s.compile.kind === "compiling" && s.compile.previousUrl === null, "first compile has no previous url");
  s = reduce(s, { type: "compile", status: { kind: "ready", url: "blob:a", pageCount: null } });
  s = reduce(s, { type: "pages", count: 128 });
  ok(s.compile.kind === "ready" && s.compile.pageCount === 128, "pdf.js page count lands on ready");

  // recompile: the outgoing pdf survives so the preview can crossfade
  s = reduce(s, { type: "compileStart" });
  ok(s.compile.kind === "compiling" && s.compile.previousUrl === "blob:a", "recompile keeps the outgoing url");
  s = reduce(s, { type: "compileStart" });
  ok(s.compile.kind === "compiling" && s.compile.previousUrl === "blob:a", "a second abort does not lose it");

  const failed = reduce(s, {
    type: "compile",
    status: { kind: "failed", error: { error: true, stage: "typst", message: "gagal", line: 12 } },
  });
  ok(failed.compile.kind === "failed", "failure replaces compiling");
  ok(reduce(failed, { type: "pages", count: 3 }) === failed, "page count is ignored unless ready");
  ok(reduce(failed, { type: "compile", status: failed.compile }) === failed, "an identical status is a no-op");

  ok(reduce(initialState, { type: "missing" }).status === "missing", "missing is terminal for the route");

  // request assembly
  const doc = { ...initialState.doc, title: COPY.untitled, markdown: "x" };
  ok(effectiveMetadata(doc).title === undefined, "Tanpa judul does not override front matter");
  ok(effectiveMetadata({ ...doc, title: "Senja" }).title === "Senja", "a real title does override it");
  ok(effectiveMetadata({ ...doc, metadata: { title: "Eksplisit" } }).title === "Eksplisit", "explicit wins");
  ok(requestFor(doc).bodyFont === undefined, "no bodyFont key when the template's own is used");
  ok(requestFor({ ...doc, bodyFont: "Sudo" }, { format: "epub" }).format === "epub", "extras pass through");

  // uploaded fonts ride inside the saved record, so the set has to stay bounded
  const uploads = Array.from({ length: MAX_FONTS + 2 }, (_, i) => ({ name: `f${i}.otf`, data: "AA" }));
  const capped = uploads.reduce(withFont, [] as UploadedFont[]);
  ok(capped.length === MAX_FONTS, "the stored font set is capped");
  ok(capped[capped.length - 1].name === `f${MAX_FONTS + 1}.otf`, "the newest upload survives the cap");
  ok(withFont(capped, { name: capped[0].name, data: "BB" }).filter((f) => f.name === capped[0].name).length === 1,
    "re-uploading a filename replaces it");

  ok(exportFilename("Senja/Kala: bab?", "pdf") === "SenjaKala bab.pdf", "filename strips illegal characters");
  ok(exportFilename("buku.pdf", "epub") === "buku.epub", "the format owns the extension");
  ok(exportFilename("   ", "pdf") === "buku.pdf", "an empty name still produces a file");

  // The reload stash. Browser-only, so node runs everything above and skips this.
  if (typeof localStorage !== "undefined") {
    const id = "self-check";
    writeStash(id, { ...initialState.doc, markdown: "# separuh kalimat", fonts: [{ name: "big.otf", data: "AA" }] });
    const back = takeStash(id);
    ok(back?.markdown === "# separuh kalimat", "the stash round-trips the manuscript");
    ok(back && !("fonts" in back), "uploaded faces stay out of the stash");
    ok(takeStash(id) === null, "a stash is replayed once");
  }

  return "editor-session self-check: ok";
}
