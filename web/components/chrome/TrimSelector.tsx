"use client";

import { useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { Popover } from "./Popover";
import { TRIM_SIZES, trimAspect, type Trim, type TrimPreset } from "@/lib/compile";

/**
 * Rows, not a dropdown: each is prefixed by a rectangle at that trim's own
 * aspect ratio, so the shapes differ on sight (UI-REFERENCE). `Kustom…` is the
 * last row and expands two number inputs in place.
 */
export function TrimSelector({
  trim,
  onTrimChange,
}: {
  trim: Trim;
  onTrimChange: (trim: Trim) => void;
}) {
  const custom = typeof trim !== "string";
  const [expanded, setExpanded] = useState(custom);
  // Seeded from wherever the project is now, so `Kustom…` starts from the
  // current page rather than from nothing.
  const seed = custom ? [trim.width, trim.height] : [TRIM_SIZES[trim].w, TRIM_SIZES[trim].h];
  const [w, setW] = useState(() => round(seed[0]));
  const [h, setH] = useState(() => round(seed[1]));

  function commit(width: string, height: string) {
    const wn = Number(width.replace(",", "."));
    const hn = Number(height.replace(",", "."));
    // Half-typed values simply do not commit; the service clamps the rest to
    // sane book bounds (registry.mjs resolveTrim).
    if (wn > 0 && hn > 0) onTrimChange({ width: wn, height: hn, unit: "in" });
  }

  return (
    <Popover
      label="Ukuran halaman"
      triggerLabel={`Ukuran halaman: ${trimLabel(trim)}`}
      trigger={
        <>
          <span className="tabular-nums">{trimLabel(trim)}</span>
          <CaretDownIcon size={13} weight="bold" className="translate-y-px" aria-hidden />
        </>
      }
      panelClassName="w-64 max-w-[calc(100vw-1.5rem)]"
    >
      {({ close }) => (
        <div className="p-1">
          {(Object.keys(TRIM_SIZES) as TrimPreset[]).map((id) => (
            <Row
              key={id}
              trim={id}
              name={PRESET_NAMES[id]}
              detail={TRIM_SIZES[id].label}
              active={trim === id}
              onClick={() => {
                onTrimChange(id);
                close();
              }}
            />
          ))}

          <Row
            trim={custom ? trim : { width: 5.5, height: 8.5 }}
            name="Kustom…"
            detail={custom ? trimLabel(trim) : ""}
            active={custom}
            expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          />

          {expanded ? (
            <div className="grid grid-cols-2 gap-2 px-2.5 pb-2 pt-1">
              <Field
                label="Lebar (in)"
                value={w}
                onChange={(v) => {
                  setW(v);
                  commit(v, h);
                }}
              />
              <Field
                label="Tinggi (in)"
                value={h}
                onChange={(v) => {
                  setH(v);
                  commit(w, v);
                }}
              />
            </div>
          ) : null}
        </div>
      )}
    </Popover>
  );
}

/** The presets are trims first and names second; the name is what a writer
 *  recognises, the dimensions are what they verify. */
const PRESET_NAMES: Record<TrimPreset, string> = {
  "5x8": "Novel",
  "6x9": "Trade",
  a5: "A5",
};

function Row({
  trim,
  name,
  detail,
  active,
  expanded,
  onClick,
}: {
  trim: Trim;
  name: string;
  detail: string;
  active: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-expanded={expanded}
      className="tap flex w-full items-center gap-2.5 rounded-[calc(var(--radius-xl)-0.25rem)] px-2.5 py-2 text-left transition-[background-color,scale] duration-150 ease-[var(--ease-enter)] hover:bg-field active:scale-[0.96]"
    >
      {/* Square, like the sheets in the preview stack. The swatch is ~15px wide
          at 5×8, and the smallest radius on the scale — 4px — rounds away more
          than half of that edge; it stops reading as a page. */}
      <span
        aria-hidden
        style={{ aspectRatio: trimAspect(trim) }}
        className={`h-6 shrink-0 border ${active ? "border-accent" : "border-hairline"}`}
      />
      <span className={`flex-1 text-sm ${active ? "text-accent-ink" : "text-ink"}`}>{name}</span>
      <span className="shrink-0 font-mono text-2xs tabular-nums text-muted">{detail}</span>
    </button>
  );
}

/** Label above the input, per HANDOFF §6.6. */
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-2xs text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.25"
        min="3"
        max="12"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-hairline bg-paper px-2 text-sm tabular-nums text-ink"
      />
    </label>
  );
}

/** Two decimals at most; A5 in inches is otherwise 5.826771653543307. */
const round = (v: number) => String(Math.round(v * 100) / 100);

/** "5 × 8 in" for a preset, "5,5 × 8,5 in" for a custom one — decimal comma. */
function trimLabel(trim: Trim): string {
  if (typeof trim === "string") return TRIM_SIZES[trim]?.label ?? trim;
  return `${round(trim.width).replace(".", ",")} × ${round(trim.height).replace(".", ",")} ${trim.unit ?? "in"}`;
}
