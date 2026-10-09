"use client";

// The manuscript's structure, read off its headings: a chapter list with the
// page each one starts on once the PDF reports its bookmarks, and the figures
// a writer keeps an eye on. Clicking a row moves both panes to it.

import { PanelLabel } from "@/components/chrome/PanelLabel";
import { chapterNumber, formatInt, formatReadingTime, type Heading } from "@/lib/outline";

export interface OutlineStats {
  words: number;
  /** Null until a compile has reported. */
  pages: number | null;
  minutes: number;
  chapters: number;
}

export interface OutlinePanelProps {
  headings: Heading[];
  /** Page a heading starts on, or null while the PDF has not said. */
  pageOf: (heading: Heading) => number | null;
  /** Index into `headings` of the chapter under the caret; -1 before the first. */
  activeIndex: number;
  onJump: (heading: Heading) => void;
  stats: OutlineStats;
}

export function OutlinePanel({ headings, pageOf, activeIndex, onJump, stats }: OutlinePanelProps) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="flex items-center justify-between px-4 pb-1.5 pt-3.5">
        <PanelLabel>Naskah</PanelLabel>
        <span className="font-mono text-2xs tabular-nums text-muted">{stats.chapters} bab</span>
      </div>

      {headings.length === 0 ? (
        <p className="px-4 py-2 text-sm leading-relaxed text-muted">
          Belum ada bab. Awali bab dengan <code className="font-mono text-xs text-ink"># Judul</code>,
          bagian dengan <code className="font-mono text-xs text-ink">## Judul</code>.
        </p>
      ) : (
        <ol className="min-h-0 overflow-y-auto px-2 pb-2">
          {headings.map((h, i) => {
            const page = pageOf(h);
            const active = i === activeIndex;
            return (
              <li key={`${h.line}-${h.title}`}>
                {h.level === 1 ? (
                  <button
                    type="button"
                    onClick={() => onJump(h)}
                    aria-current={active ? "true" : undefined}
                    className={`tap relative grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-[background-color,scale] duration-150 ease-[var(--ease-enter)] active:scale-[0.98] ${
                      active ? "bg-field text-ink" : "text-ink hover:bg-field/70"
                    }`}
                  >
                    {active && (
                      <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-accent" />
                    )}
                    <span className={`font-mono text-2xs ${active ? "text-accent-ink" : "text-muted"}`}>
                      {String(chapterNumber(headings, i)).padStart(2, "0")}
                    </span>
                    <span className="truncate">{h.title}</span>
                    <span className={`font-mono text-2xs tabular-nums ${active ? "text-accent-ink" : "text-muted"}`}>
                      {page ?? ""}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onJump(h)}
                    className="tap grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted transition-[color,background-color,scale] duration-150 ease-[var(--ease-enter)] hover:bg-field/70 hover:text-ink active:scale-[0.98]"
                  >
                    <span />
                    <span className="truncate border-l border-hairline pl-3">{h.title}</span>
                    <span className="font-mono text-2xs tabular-nums">{page ?? ""}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <dl className="grid grid-cols-3 gap-2 border-t border-hairline px-4 py-3">
        <Stat value={formatInt(stats.words)} label="kata" />
        <Stat value={stats.pages === null ? "—" : formatInt(stats.pages)} label="halaman" />
        <Stat value={formatReadingTime(stats.minutes)} label="baca" />
      </dl>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <dd className="truncate font-mono text-sm tabular-nums text-ink">{value}</dd>
      <dt className="text-2xs text-muted">{label}</dt>
    </div>
  );
}
