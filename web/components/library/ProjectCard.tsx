"use client";

import { useRef, useState } from "react";
import Link from "next/link";
// Per-icon import: the barrel is thousands of modules (see ThemeToggle).
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { changedAgo } from "@/lib/brand";
import { trimAspect, type TemplateId } from "@/lib/compile";
import type { LibraryProject } from "./thumbnail";

/** The book face each template sets its body in — the placeholder is a stand-in
 *  for a rendered page, so serif here is book territory, not chrome. Variables
 *  are declared on the route wrapper in app/page.tsx. */
const FACES: Record<TemplateId, { font: string; label: string }> = {
  literary: { font: "var(--font-spectral), serif", label: "Spectral" },
  manuscript: { font: "var(--font-source-serif), serif", label: "Source Serif 4" },
  contemporary: { font: "var(--font-baskerville), serif", label: "Libre Baskerville" },
};

export interface ProjectCardProps {
  project: LibraryProject;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onRename, onDuplicate, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const href = `/project/${project.id}`;

  function commit() {
    const next = draft?.trim();
    setDraft(null);
    if (next && next !== project.title) onRename(next);
  }

  function startRename() {
    setMenuOpen(false);
    setDraft(project.title);
  }

  return (
    // z-10 while the menu is open so it is not clipped by the next card.
    <li className={menuOpen ? "relative z-10" : "relative"}>
      <div className="group">
        <Link href={href} aria-label={project.title} className="block rounded-sm">
          <Sheet project={project} />
        </Link>

        {/* Hover on pointer devices, focus-within for the keyboard, and always
            visible below md where there is no hover at all. */}
        <div
          className="absolute right-1.5 top-1.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            setMenuOpen(false);
            triggerRef.current?.focus();
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Aksi untuk ${project.title}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-8 place-items-center rounded-md border border-hairline bg-paper/90 text-muted backdrop-blur-sm transition-[color,transform] duration-150 hover:text-ink active:scale-[0.94]"
          >
            <DotsThreeIcon size={17} weight="bold" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 overflow-hidden rounded-lg border border-hairline bg-paper py-1 shadow-page">
              <Link href={href} autoFocus className="block px-3 py-1.5 text-sm hover:bg-field">
                Buka
              </Link>
              <MenuItem onClick={startRename}>Ganti nama</MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate();
                }}
              >
                Duplikat
              </MenuItem>
              <div className="my-1 border-t border-hairline" />
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="text-accent-ink"
              >
                Hapus
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {draft === null ? (
        <p
          onDoubleClick={startRename}
          title={project.title}
          className="mt-2.5 truncate text-sm text-ink"
        >
          {project.title}
        </p>
      ) : (
        <input
          autoFocus
          value={draft}
          aria-label="Ganti nama proyek"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            // Unmounting the input is the revert: React fires no blur on it.
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(null);
            }
          }}
          className="mt-2.5 w-full rounded-sm border border-hairline bg-paper px-1.5 py-px text-sm text-ink"
        />
      )}

      <p className="mt-0.5 text-xs tabular-nums text-muted">{changedAgo(project.updatedAt)}</p>
    </li>
  );
}

function MenuItem({ className = "", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-field ${className}`}
    />
  );
}

/** The card art: the cached first page, or a typographic stand-in set in the
 *  template's own face. Never a compile (UI-REFERENCE, project library). */
function Sheet({ project }: { project: LibraryProject }) {
  const face = FACES[project.template] ?? FACES.literary;
  return (
    <div
      className="w-full overflow-hidden rounded-sm border border-hairline bg-paper shadow-page transition-transform duration-200 ease-out group-hover:-translate-y-0.5"
      style={{ aspectRatio: trimAspect(project.trim), containerType: "inline-size" }}
    >
      {project.thumbnail ? (
        /* A data: URL out of IndexedDB — next/image has nothing to optimise
           and no loader that can fetch it. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={project.thumbnail} alt="" className="size-full object-cover object-top" />
      ) : (
        // cqw so the specimen scales with the card, not with a breakpoint.
        <div className="flex h-full flex-col justify-between p-[10cqw]">
          <p
            /* pr-6 keeps the title clear of the ... trigger, which sits over
               the sheet and is always visible below md. */
            className="line-clamp-4 text-pretty pr-6 text-ink"
            style={{ fontFamily: face.font, fontSize: "clamp(0.6875rem, 9cqw, 1.5rem)", lineHeight: 1.28 }}
          >
            {project.title}
          </p>
          <p
            className="font-mono uppercase tracking-wide text-muted"
            style={{ fontSize: "clamp(0.5rem, 3.2cqw, 0.6875rem)" }}
          >
            {face.label}
          </p>
        </div>
      )}
    </div>
  );
}
