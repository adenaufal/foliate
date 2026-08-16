"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AccountMenu } from "./AccountMenu";
import { TemplateSwitcher } from "./TemplateSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { TrimSelector } from "./TrimSelector";
import { BRAND_NAME, COPY, savedAgo } from "@/lib/brand";
import type { EditorTopBarProps, SaveState } from "@/lib/editor-session";

/**
 * The editor's whole bar — this route does not use AppShell. Left to right:
 * title, save state, flex gap, template, trim, theme, account, Ekspor.
 * Ekspor is the only filled button anywhere in it (UI-REFERENCE).
 *
 * Under `sm` the controls drop to a second line rather than colliding; the
 * bar is the one piece of chrome that must never scroll sideways.
 */
export function EditorTopBar({
  title,
  onTitleChange,
  save,
  onRetrySave,
  template,
  onTemplateChange,
  trim,
  onTrimChange,
  onExport,
  themePresets,
}: EditorTopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:h-13 sm:flex-nowrap sm:gap-x-3 sm:px-6 sm:py-0">
        <Link
          href="/library"
          aria-label={COPY.backToLibrary}
          className="shrink-0 font-display text-lg leading-none tracking-tight text-ink transition-opacity duration-150 hover:opacity-70"
          style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
        >
          {BRAND_NAME}
        </Link>

        <TitleField title={title} onTitleChange={onTitleChange} />
        <SaveIndicator save={save} onRetrySave={onRetrySave} />

        <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap">
          <TemplateSwitcher
            template={template}
            onTemplateChange={onTemplateChange}
            trim={trim}
            themePresets={themePresets}
          />
          <TrimSelector trim={trim} onTrimChange={onTrimChange} />
          <ThemeToggle />
          <AccountMenu />
          <button
            type="button"
            onClick={onExport}
            // Full width on its own line below sm — the row's other controls
            // are icons and short ghosts, this is the one thing to hit.
            className="h-9 w-full rounded-md bg-accent px-4 text-sm text-on-accent transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] sm:ml-1 sm:w-auto"
          >
            {COPY.export}
          </button>
        </div>
      </div>
    </header>
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
      className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-base text-ink transition-colors duration-150 hover:bg-field focus:bg-field sm:max-w-[28rem]"
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
            className="rounded-sm underline underline-offset-2 transition-colors duration-150 hover:text-ink"
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
