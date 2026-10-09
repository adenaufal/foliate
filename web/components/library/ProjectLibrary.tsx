"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/lib/brand";
import { DEFAULT_TRIM, trimAspect } from "@/lib/compile";
import { formatInt } from "@/lib/outline";
import { storage, type Project, type ProjectPatch } from "@/lib/storage";
import { ProjectCard } from "./ProjectCard";

const GRID = "grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5";

type Sort = "terbaru" | "judul";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: Project[] };

export function ProjectLibrary() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [sort, setSort] = useState<Sort>("terbaru");
  const [notice, setNotice] = useState<string | null>(null);
  const [doomed, setDoomed] = useState<Project | null>(null);
  const [pending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let live = true;
    load().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  // <dialog> gives the focus trap, Escape and the backdrop for free.
  useEffect(() => {
    const d = confirmRef.current;
    if (!d) return;
    if (doomed && !d.open) d.showModal();
    if (!doomed && d.open) d.close();
  }, [doomed]);

  const projects = useMemo(() => (state.status === "ready" ? state.projects : []), [state]);

  // The driver lists newest first; `Judul` is the one other order a shelf has.
  const shown = useMemo(
    () => (sort === "judul" ? [...projects].sort((a, b) => a.title.localeCompare(b.title, "id")) : projects),
    [projects, sort],
  );
  // Tagged `Lanjutkan` whatever the order: the manuscript last touched.
  const latestId = projects.reduce<Project | null>(
    (best, p) => (!best || p.updatedAt > best.updatedAt ? p : best),
    null,
  )?.id;
  const totalPages = projects.reduce((n, p) => n + (p.pageCount ?? 0), 0);

  function setProjects(next: Project[]) {
    setState({ status: "ready", projects: next });
  }

  function openNew(seed?: ProjectPatch) {
    startTransition(async () => {
      try {
        const p = await storage.create(seed ?? {});
        router.push(`/project/${p.id}`);
      } catch (e) {
        setNotice(message(e));
      }
    });
  }

  function openSample() {
    startTransition(async () => {
      try {
        const res = await fetch("/samples/manuscript.md");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const markdown = await res.text();
        const p = await storage.create({ title: frontMatterTitle(markdown), markdown });
        router.push(`/project/${p.id}`);
      } catch (e) {
        setNotice(message(e));
      }
    });
  }

  async function rename(p: Project, title: string) {
    setNotice(null);
    // Replaced in place, not re-sorted: a rename should not make the card jump.
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, title } : x)));
    try {
      await storage.update(p.id, { title });
    } catch (e) {
      setProjects(projects);
      setNotice(message(e));
    }
  }

  async function duplicate(p: Project) {
    setNotice(null);
    try {
      const copy = await storage.create({
        title: `${p.title} (salinan)`,
        markdown: p.markdown,
        template: p.template,
        trim: p.trim,
        bodyFont: p.bodyFont,
        fonts: p.fonts,
        thumbnail: p.thumbnail,
        pageCount: p.pageCount,
      });
      setProjects([copy, ...projects]);
    } catch (e) {
      setNotice(message(e));
    }
  }

  async function destroy(p: Project) {
    setNotice(null);
    setDoomed(null);
    setProjects(projects.filter((x) => x.id !== p.id));
    try {
      await storage.remove(p.id);
    } catch (e) {
      setProjects(projects);
      setNotice(message(e));
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-page py-10 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl tracking-tight">{COPY.libraryTitle}</h1>
          {projects.length > 0 && (
            <p className="font-mono text-xs tabular-nums text-muted">
              {projects.length} naskah{totalPages > 0 ? ` · ${formatInt(totalPages)} halaman` : ""}
            </p>
          )}
        </div>
        {projects.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SortSwitch value={sort} onChange={setSort} />
            <PrimaryButton onClick={() => openNew()} disabled={pending}>
              {COPY.newProject}
            </PrimaryButton>
          </div>
        )}
      </div>

      {notice && <p className="mt-4 text-sm text-accent-ink">{notice}</p>}

      {state.status === "loading" && <LoadingGrid />}

      {state.status === "error" && (
        <div className="mt-4 max-w-[46ch]">
          <p className="text-sm text-accent-ink">
            {COPY.loadFailed} {state.message}
          </p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              load().then(setState);
            }}
            className="mt-2 text-sm text-ink underline underline-offset-4 hover:text-accent-ink"
          >
            {COPY.retry}
          </button>
        </div>
      )}

      {/* Empty is a state of this page, not a centred hero: left-aligned under
          the heading, no illustration, two buttons is the ceiling. */}
      {state.status === "ready" && projects.length === 0 && (
        <div className="mt-4 max-w-[46ch]">
          <p className="text-base">{COPY.libraryEmptyTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{COPY.libraryEmptyBody}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <PrimaryButton onClick={() => openNew()} disabled={pending}>
              {COPY.newProject}
            </PrimaryButton>
            <GhostButton onClick={openSample} disabled={pending}>
              {COPY.openSample}
            </GhostButton>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        // The one surface where uniform cards are allowed — each card is a
        // distinct page render, not a repeated container.
        <ul className={`mt-8 ${GRID}`}>
          {shown.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              latest={p.id === latestId}
              onRename={(title) => rename(p, title)}
              onDuplicate={() => duplicate(p)}
              onDelete={() => setDoomed(p)}
            />
          ))}
        </ul>
      )}

      <dialog
        ref={confirmRef}
        onClose={() => setDoomed(null)}
        aria-labelledby="confirm-delete"
        // Same dim as ExportDialog: two dialogs, one backdrop language, and the
        // more consequential one does not get the weaker treatment.
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-hairline bg-paper p-5 text-ink shadow-page backdrop:bg-scrim/45"
      >
        {/* No trash, so the copy says so outright. */}
        <p id="confirm-delete" className="text-base">
          Hapus permanen?
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Proyek ini tidak bisa dikembalikan.
        </p>
        <p className="mt-3 truncate text-sm">{doomed?.title}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <GhostButton onClick={() => setDoomed(null)}>Batal</GhostButton>
          <PrimaryButton onClick={() => doomed && destroy(doomed)}>Hapus</PrimaryButton>
        </div>
      </dialog>
    </div>
  );
}

async function load(): Promise<State> {
  try {
    return { status: "ready", projects: await storage.list() };
  } catch (e) {
    return { status: "error", message: message(e) };
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Front-matter title, so the sample project is not called "Tanpa judul". */
function frontMatterTitle(markdown: string): string {
  const m = /^---\r?\n[\s\S]*?^title:\s*(.+?)\s*$/m.exec(markdown);
  return m ? m[1].replace(/^["']|["']$/g, "") : COPY.untitled;
}

/** Two orders, so a segmented control — the same idiom as the editor's view
 *  switch. */
function SortSwitch({ value, onChange }: { value: Sort; onChange: (sort: Sort) => void }) {
  return (
    <div role="group" aria-label="Urutan" className="grid grid-cols-2 rounded-md border border-hairline p-0.5">
      {(["terbaru", "judul"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={`tap rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm transition-[color,background-color,scale] duration-150 ease-[var(--ease-enter)] active:scale-[0.96] ${
            value === s ? "bg-field text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {s === "terbaru" ? "Terbaru" : "Judul"}
        </button>
      ))}
    </div>
  );
}

/** Page-shaped skeletons at the default trim — the page is the unit of loading
 *  here too, and a round spinner is a defect (HANDOFF §6.7). */
function LoadingGrid() {
  return (
    <ul className={`mt-8 ${GRID}`} aria-busy="true" aria-label={COPY.libraryLoading}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i}>
          <div
            className="relative w-full overflow-hidden rounded-sm border border-hairline bg-field"
            style={{ aspectRatio: trimAspect(DEFAULT_TRIM) }}
          >
            <div className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-paper/60 to-transparent" />
          </div>
          <div className="mt-3 h-3 w-2/3 rounded-sm bg-field" />
          <div className="mt-2 h-2.5 w-1/3 rounded-sm bg-field" />
        </li>
      ))}
    </ul>
  );
}

// The one filled style in the app; everything else is ghost or icon.
function PrimaryButton(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="btn btn-primary w-full sm:w-auto"
    />
  );
}

function GhostButton(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="btn btn-ghost w-full sm:w-auto"
    />
  );
}

// --- self-check --------------------------------------------------------------
// The regex is the one piece here that can rot silently. Devtools:
// `import("@/components/library/ProjectLibrary").then(m => m.selfCheckLibrary())`
export function selfCheckLibrary(): string {
  const ok = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`library self-check: ${msg}`);
  };
  ok(frontMatterTitle("---\ntitle: Senja\nauthor: X\n---\n# Bab") === "Senja", "reads the title");
  ok(frontMatterTitle('---\r\ntitle: "Senja"\r\n---\r\n') === "Senja", "strips quotes, handles CRLF");
  ok(frontMatterTitle("# Bab satu") === COPY.untitled, "falls back with no front matter");
  ok(frontMatterTitle("---\nauthor: X\n---") === COPY.untitled, "falls back with no title key");
  return "library self-check: ok";
}
