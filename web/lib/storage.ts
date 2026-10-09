// Storage adapter. One interface, two drivers: IndexedDB locally (v0), Supabase
// later. BUILD-PLAN §1 — the app is local-first and multi-user-ready, but no
// multi-user code ships. Nothing outside this file touches idb-keyval.
import { createStore, del, entries, get, set } from "idb-keyval";
import { COPY } from "./brand";
import { DEFAULT_TEMPLATE, DEFAULT_TRIM, type TemplateId, type Trim } from "./compile";
// Type-only, so the cycle back to editor-session is erased at build time.
import type { UploadedFont } from "./editor-session";

export interface Project {
  id: string;
  title: string;
  markdown: string;
  template: TemplateId;
  trim: Trim;
  /** Family name for the template's `body-font:`; null or absent = the
   *  template's own. Optional: projects written before theming lack it. */
  bodyFont?: string | null;
  /** Faces uploaded for this project, base64. Capped where they are added
   *  (lib/editor-session `withFont`) — the whole record is rewritten on save. */
  fonts?: UploadedFont[];
  /** Card art for the library: page 1 of the last successful compile as a
   *  webp data URL. A cache, written without touching `updatedAt`. */
  thumbnail?: string;
  /** Pages in the last successful compile. Same cache write as `thumbnail`. */
  pageCount?: number;
  createdAt: number;
  updatedAt: number;
}

/** Everything a caller may change. id/createdAt are owned by the driver, and
 *  `updatedAt` is stamped on every write unless the patch carries one — a cache
 *  write (library card art) is not an edit and must not float the project to
 *  the top of the list. */
export type ProjectPatch = Partial<Omit<Project, "id" | "createdAt">>;

export interface StorageDriver {
  readonly name: string;
  /** Newest first. */
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(seed?: ProjectPatch): Promise<Project>;
  /** Returns the merged project. Throws if the id is unknown. */
  update(id: string, patch: ProjectPatch): Promise<Project>;
  remove(id: string): Promise<void>;
  /** Writes an export to disk. Returns the filename actually written, or null
   *  if the user cancelled the save dialog. */
  saveExport(blob: Blob, filename: string): Promise<string | null>;
}

function newProject(seed: ProjectPatch = {}): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: COPY.untitled,
    markdown: "",
    template: DEFAULT_TEMPLATE,
    trim: DEFAULT_TRIM,
    ...seed,
    createdAt: now,
    updatedAt: now,
  };
}

// --- local driver (IndexedDB) ------------------------------------------------
// One object store keyed by project id. Manuscripts run to megabytes, so
// localStorage (~5 MB, synchronous) is not an option.

const store = createStore("foliate", "projects");

/** Serialises the driver's read-modify-write updates. See `update` below. */
let writes: Promise<unknown> = Promise.resolve();

export const localDriver: StorageDriver = {
  name: "local",

  async list() {
    const rows = await entries<string, Project>(store);
    return rows.map(([, p]) => p).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id) {
    return (await get<Project>(id, store)) ?? null;
  },

  async create(seed) {
    const p = newProject(seed);
    await set(p.id, p, store);
    return p;
  },

  async update(id, patch) {
    // Queued: every update is read-modify-write, so an autosave and a card-art
    // cache landing in the same tick would each write over the other's patch.
    // One tab, one queue — a cross-tab race would need a real transaction.
    const run = writes.then(async () => {
      const current = await get<Project>(id, store);
      if (!current) throw new Error(`${COPY.loadFailed} (id: ${id})`);
      const next: Project = { ...current, ...patch, updatedAt: patch.updatedAt ?? Date.now() };
      await set(id, next, store);
      return next;
    });
    writes = run.catch(() => {});
    return run;
  },

  async remove(id) {
    await del(id, store);
  },

  async saveExport(blob, filename) {
    // File System Access where available (the user picks the folder — that is
    // the local-first promise); anchor download everywhere else.
    const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker })
      .showSaveFilePicker;
    if (picker) {
      // The type filter follows the file, not the format the app happened to
      // ship first: a .epub offered as "PDF (*.pdf)" is saved with the wrong
      // extension by the picker itself.
      const type: FilePickerType = filename.toLowerCase().endsWith(".epub")
        ? { description: "EPUB", accept: { "application/epub+zip": [".epub"] } }
        : { description: "PDF", accept: { "application/pdf": [".pdf"] } };
      try {
        const handle = await picker({ suggestedName: filename, types: [type] });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        return handle.name;
      } catch (e) {
        // AbortError = the user closed the dialog; respect it, save nothing.
        if ((e as DOMException)?.name === "AbortError") return null;
        // Anything else — most often the transient user activation expiring
        // while the export compiled (a multi-second round-trip to the compile
        // service spends the gesture, and showSaveFilePicker then throws a
        // SecurityError) — falls through to the anchor download so the file
        // still lands, just in the default folder.
      }
    }
    return anchorDownload(blob, filename);
  },
};

/** Programmatic download — the fallback when the File System Access picker is
 *  absent (Firefox/Safari) or unusable (activation spent during compile). The
 *  anchor is appended before clicking (Firefox ignores a detached one) and the
 *  object URL is revoked on a delay so the download has time to start. */
function anchorDownload(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}

type FilePickerType = { description?: string; accept: Record<string, string[]> };

type ShowSaveFilePicker = (opts: {
  suggestedName?: string;
  types?: FilePickerType[];
}) => Promise<{ name: string; createWritable(): Promise<WritableStream<Blob> & { write(b: Blob): Promise<void>; close(): Promise<void> }> }>;

// --- supabase driver (stub) --------------------------------------------------
// Same interface, so swapping is a one-line change in `storage` below. Fails
// loudly rather than silently falling back to local — a silent fallback would
// look like data loss to a signed-in user.

const notConfigured = (): never => {
  throw new Error(`${COPY.notConfigured} (supabase: set NEXT_PUBLIC_SUPABASE_URL dan anon key)`);
};

export const supabaseDriver: StorageDriver = {
  name: "supabase",
  list: notConfigured,
  get: notConfigured,
  create: notConfigured,
  update: notConfigured,
  remove: notConfigured,
  saveExport: notConfigured,
};

export const storage: StorageDriver =
  process.env.NEXT_PUBLIC_STORAGE_DRIVER === "supabase" ? supabaseDriver : localDriver;

// --- self-check --------------------------------------------------------------
// IndexedDB is browser-only, so this cannot run under node. Call it from the
// devtools console: `import("@/lib/storage").then(m => m.selfCheckLocal())`.

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`storage self-check: ${msg}`);
}

export async function selfCheckLocal(): Promise<string> {
  const before = await localDriver.list();
  const p = await localDriver.create({ title: "self-check", markdown: "# hai" });
  try {
    ok(p.id && p.createdAt === p.updatedAt, "create returns an id and equal timestamps");
    ok(p.template === DEFAULT_TEMPLATE && p.trim === DEFAULT_TRIM, "create applies defaults");

    const got = await localDriver.get(p.id);
    ok(got?.markdown === "# hai", "get round-trips markdown");

    await new Promise((r) => setTimeout(r, 2));
    const up = await localDriver.update(p.id, {
      markdown: "# halo",
      title: "diubah",
      bodyFont: "Spectral",
      fonts: [{ name: "a.otf", data: "AA" }],
    });
    ok(up.markdown === "# halo" && up.title === "diubah", "update merges the patch");
    const reread = await localDriver.get(p.id);
    ok(reread?.bodyFont === "Spectral" && reread?.fonts?.length === 1, "theme choices survive a read");
    ok(up.createdAt === p.createdAt, "update preserves createdAt");
    ok(up.updatedAt > p.updatedAt, "update bumps updatedAt");

    const cached = await localDriver.update(p.id, { updatedAt: up.updatedAt });
    ok(cached.updatedAt === up.updatedAt, "a patch carrying updatedAt is not an edit");

    // Interleaved read-modify-writes: without the queue the loser's field is
    // lost, which is how an autosave and a card-art cache drop each other.
    await Promise.all([
      localDriver.update(p.id, { title: "balapan" }),
      localDriver.update(p.id, { markdown: "# balapan" }),
    ]);
    const both = await localDriver.get(p.id);
    ok(both?.title === "balapan" && both?.markdown === "# balapan", "concurrent updates both land");

    const list = await localDriver.list();
    ok(list.length === before.length + 1, "list includes the new project");
    ok(list[0].id === p.id, "list is newest first");

    await localDriver.remove(p.id);
    ok((await localDriver.get(p.id)) === null, "remove deletes");
    ok((await localDriver.list()).length === before.length, "list is back to its original size");

    let threw = false;
    await localDriver.update(p.id, { title: "x" }).catch(() => (threw = true));
    ok(threw, "update on an unknown id throws");

    return "storage self-check: ok";
  } finally {
    await localDriver.remove(p.id);
  }
}
