"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
// Per-icon imports: the barrel is thousands of modules and slows dev compiles.
import { ListNumbersIcon } from "@phosphor-icons/react/dist/csr/ListNumbers";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { AccountMenu } from "./AccountMenu";
import { ThemeToggle } from "./ThemeToggle";
import { BRAND_NAME, COPY, savedAgo } from "@/lib/brand";
import type { EditorTopBarProps, EditorView, SaveState } from "@/lib/editor-session";

/**
 * The editor's whole bar — this route does not use AppShell. Left to right:
 * brand, title, save state, flex gap, view switch, outline and inspector
 * toggles, theme, account, Ekspor. Ekspor is the only filled button anywhere
 * in it (UI-REFERENCE). Template and trim no longer live here: they are the
 * inspector's, beside the page they shape.
 *
 * Under `sm` the controls drop to a second line rather than colliding; the
 * bar is the one piece of chrome that must never scroll sideways.
 */
export function EditorTopBar({
  title,
  onTitleChange,
  save,
  onRetrySave,
  view,
  onViewChange,
  outlineOpen,
  onToggleOutline,
  inspectorOpen,
  onToggleInspector,
  onExport,
}: EditorTopBarProps) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-hairline bg-paper/90 pt-safe backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-page py-2 sm:h-14 sm:flex-nowrap sm:gap-x-3 sm:py-0">
        <Link
          href="/library"
          aria-label={COPY.backToLibrary}
          translate="no"
          className="shrink-0 font-display text-lg leading-none tracking-tight text-ink transition-opacity duration-150 ease-[var(--ease-enter)] hover:opacity-70"
          style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
        >
          {BRAND_NAME}
        </Link>
        <span aria-hidden className="hidden text-hairline sm:inline">
          /
        </span>

        <TitleField title={title} onTitleChange={onTitleChange} />
        <SaveIndicator save={save} onRetrySave={onRetrySave} />

        <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap">
          <ViewSwitch value={view} onChange={onViewChange} />
          <PanelToggle pressed={outlineOpen} label="Kerangka naskah" onClick={onToggleOutline}>
            <ListNumbersIcon size={17} weight="regular" aria-hidden />
          </PanelToggle>
          <PanelToggle pressed={inspectorOpen} label="Inspektur penyusunan" onClick={onToggleInspector}>
            <SlidersHorizontalIcon size={17} weight="regular" aria-hidden />
          </PanelToggle>
          <ThemeToggle />
          <AccountMenu />
          <button
            type="button"
            onClick={onExport}
            className="btn btn-primary w-full sm:ml-1 sm:w-auto"
          >
            {COPY.export}
          </button>
        </div>
      </div>
    </header>
  );
}

/** Teks · Keduanya · Halaman. The middle option only exists at the split
 *  breakpoint; below it the shell shows the text for `keduanya`, so the Teks
 *  segment reads as pressed there. */
function ViewSwitch({ value, onChange }: { value: EditorView; onChange: (view: EditorView) => void }) {
  const on = "bg-field text-ink";
  const off = "text-muted hover:text-ink";
  const teks = value === "teks" ? on : value === "keduanya" ? `${on} split:bg-transparent split:text-muted split:hover:text-ink` : off;
  return (
    <div
      role="group"
      aria-label="Tampilan"
      className="grid grid-cols-2 rounded-md border border-hairline p-0.5 split:grid-cols-3"
    >
      <ViewButton pressed={value === "teks"} className={teks} onClick={() => onChange("teks")}>
        Teks
      </ViewButton>
      <ViewButton
        pressed={value === "keduanya"}
        className={`hidden split:block ${value === "keduanya" ? on : off}`}
        onClick={() => onChange("keduanya")}
      >
        Keduanya
      </ViewButton>
      <ViewButton pressed={value === "halaman"} className={value === "halaman" ? on : off} onClick={() => onChange("halaman")}>
        Halaman
      </ViewButton>
    </div>
  );
}

function ViewButton({
  pressed,
  className,
  onClick,
  children,
}: {
  pressed: boolean;
  className: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`tap rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm transition-[color,background-color,scale] duration-150 ease-[var(--ease-enter)] active:scale-[0.96] ${className}`}
    >
      {children}
    </button>
  );
}

/** An icon button with a pressed state — the two side panels. */
function PanelToggle({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`btn-icon ${pressed ? "bg-field text-ink" : ""}`}
    >
      {children}
    </button>
  );
}

/** Inline-editable: Enter commits, Escape reverts, blur commits. No dialog. */
function TitleField({
  title,
  onTitleChange,
}: Pick<EditorTopBarProps, "title" | "onTitleChange">) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(title);

  // The title also changes from outside — loading the project, or the sample
  // manuscript's front matter. Never while the writer is in the field.
  useEffect(() => {
    if (document.activeElement !== input.current) setDraft(title);
  }, [title]);

  function commit() {
    const next = draft.trim() || COPY.untitled;
    setDraft(next);
    if (next !== title) onTitleChange(next);
  }

  return (
    <input
      ref={input}
      value={draft}
      aria-label="Judul proyek"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          input.current?.blur();
        } else if (e.key === "Escape") {
          setDraft(title);
          input.current?.blur();
        }
      }}
      className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-base text-ink transition-colors duration-150 ease-[var(--ease-enter)] hover:bg-field focus:bg-field sm:max-w-[24rem]"
    />
  );
}

/**
 * Muted prose one step down, never a badge and never a toast. The width is
 * reserved so the two states that alternate — Menyimpan… and Tersimpan — do
 * not shift the bar. Failure is the exception that earns the accent.
 */
function SaveIndicator({
  save,
  onRetrySave,
}: {
  save: SaveState;
  onRetrySave: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  // "Tersimpan" becomes "Tersimpan 4 menit lalu" on its own, without an edit.
  useEffect(() => {
    if (save.status !== "saved") return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [save.status]);

  return (
    <p className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted sm:min-w-[7rem]">
      {save.status === "error" ? (
        <>
          <span className="text-accent-ink">{COPY.saveFailed}</span>{" "}
          <button
            type="button"
            onClick={onRetrySave}
            className="rounded-sm underline underline-offset-2 transition-colors duration-150 ease-[var(--ease-enter)] hover:text-ink"
          >
            {COPY.retry}
          </button>
        </>
      ) : save.status === "saving" ? (
        COPY.saving
      ) : save.status === "saved" ? (
        savedAgo(save.lastSavedAt ?? now, now)
      ) : null}
    </p>
  );
}
