"use client";

// ⌘K. Every setting and every jump the editor offers, reachable without
// leaving the keyboard. Built on native <dialog>: showModal() gives the focus
// trap, Escape, the inert background and focus restored to wherever the
// writer was. Filtering is a substring match over label, detail and keywords;
// results keep their group order so the list reads the same every time.

import { useEffect, useMemo, useRef, useState } from "react";
// Per-icon import: the barrel is thousands of modules and slows dev compiles.
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";

export interface Command {
  id: string;
  group: string;
  label: string;
  /** Muted mono beside the label — the current value, a page, a count. */
  detail?: string;
  /** Extra words the filter should match. */
  keywords?: string;
  /** The option in force now. Shown, not disabled: running it is a no-op. */
  active?: boolean;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setCursor(0);
      d.showModal();
      input.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  const matches = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return commands;
    return commands.filter((c) => {
      const hay = `${c.group} ${c.label} ${c.detail ?? ""} ${c.keywords ?? ""}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [commands, query]);

  // Typing past the end of a shorter list must not leave the cursor dangling.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function run(cmd: Command) {
    dialog.current?.close();
    cmd.run();
  }

  // Groups in order of first appearance, so filtering never reorders them.
  const groups: { name: string; items: { cmd: Command; index: number }[] }[] = [];
  matches.forEach((cmd, index) => {
    const g = groups.find((x) => x.name === cmd.group);
    if (g) g.items.push({ cmd, index });
    else groups.push({ name: cmd.group, items: [{ cmd, index }] });
  });

  return (
    <dialog
      ref={dialog}
      aria-label="Perintah"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto mt-[max(4rem,10dvh)] w-[min(92vw,34rem)] max-w-none rounded-xl border border-hairline bg-paper p-0 text-ink shadow-lift backdrop:bg-scrim/45"
    >
      <div className="grid max-h-[min(70dvh,34rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl">
        <div className="flex items-center gap-2.5 border-b border-hairline px-3.5 py-3">
          <MagnifyingGlassIcon size={16} weight="regular" className="shrink-0 text-muted" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(matches.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const cmd = matches[cursor];
                if (cmd) run(cmd);
              }
            }}
            placeholder="Ketik perintah, atau lompat ke bab…"
            aria-label="Cari perintah"
            aria-controls="command-list"
            aria-activedescendant={matches[cursor] ? `cmd-${matches[cursor].id}` : undefined}
            role="combobox"
            aria-expanded="true"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          />
          <kbd className="kbd">esc</kbd>
        </div>

        <ul ref={list} id="command-list" role="listbox" className="min-h-0 overflow-y-auto p-1.5">
          {groups.length === 0 && (
            <li className="px-2.5 py-6 text-center text-sm text-muted">Tidak ada perintah yang cocok.</li>
          )}
          {groups.map((g) => (
            <li key={g.name} role="presentation">
              <p className="px-2.5 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.12em] text-muted">{g.name}</p>
              <ul role="group" aria-label={g.name}>
                {g.items.map(({ cmd, index }) => {
                  const hot = index === cursor;
                  return (
                    <li
                      key={cmd.id}
                      id={`cmd-${cmd.id}`}
                      role="option"
                      aria-selected={hot}
                      data-index={index}
                      onMouseMove={() => setCursor(index)}
                      onClick={() => run(cmd)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
                        hot ? "bg-field text-ink" : "text-ink"
                      }`}
                    >
                      <span className={`truncate ${cmd.active ? "text-accent-ink" : ""}`}>{cmd.label}</span>
                      {cmd.detail && (
                        <span className="truncate font-mono text-2xs text-muted">{cmd.detail}</span>
                      )}
                      {cmd.active && <span className="ml-auto shrink-0 font-mono text-2xs text-muted">aktif</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        <div className="flex gap-4 border-t border-hairline px-3.5 py-2 font-mono text-2xs text-muted">
          <span>↑↓ pilih</span>
          <span>↵ jalankan</span>
          <span>esc tutup</span>
        </div>
      </div>
    </dialog>
  );
}
