"use client";

// The typesetting inspector: everything that decides how the page is set, in
// one column beside it. Template, trim and body face are the three inputs the
// engine takes; the specification block underneath states what those inputs
// mean on the page — size, leading, lines, measure, margins — so the choice is
// a typographic one rather than a guess.

import { useEffect, useState, type ReactNode } from "react";
import { PanelLabel } from "@/components/chrome/PanelLabel";
import { templateThumbnail } from "@/components/chrome/template-thumbnails";
import {
  roundTrim,
  TRIM_PRESET_NAMES,
  TRIM_SIZES,
  trimAspect,
  trimLabel,
  type TemplateId,
  type Trim,
  type TrimPreset,
} from "@/lib/compile";
import { inches, pageSpec, pt, TEMPLATES, templateInfo } from "@/lib/templates";

export interface InspectorPanelProps {
  template: TemplateId;
  onTemplateChange: (template: TemplateId) => void;
  trim: Trim;
  onTrimChange: (trim: Trim) => void;
  /** The family in force, null for the template's own. Labels the font row. */
  bodyFont: string | null;
  /** The theme presets, already bound. The panel only places them. */
  themePresets: ReactNode;
  /** Thumbnails compile a specimen each; nothing compiles while the panel is
   *  not on screen. */
  active: boolean;
}

export function InspectorPanel({
  template,
  onTemplateChange,
  trim,
  onTrimChange,
  bodyFont,
  themePresets,
  active,
}: InspectorPanelProps) {
  const spec = pageSpec(template, trim);
  const info = templateInfo(template);

  return (
    <div className="text-sm">
      <Section label="Template">
        <div className="grid gap-1">
          {TEMPLATES.map((t) => {
            const selected = t.id === template;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onTemplateChange(t.id)}
                className={`tap grid grid-cols-[2.125rem_1fr] items-center gap-2.5 rounded-lg border p-1.5 text-left transition-[border-color,background-color,scale] duration-150 ease-[var(--ease-enter)] active:scale-[0.98] ${
                  selected ? "border-transparent ring-[1.5px] ring-accent" : "border-transparent hover:bg-field"
                }`}
              >
                <Thumbnail template={t.id} trim={trim} enabled={active} />
                <span className="min-w-0">
                  <span className={`block text-sm ${selected ? "text-accent-ink" : "text-ink"}`}>{t.label}</span>
                  <span className="block truncate font-mono text-2xs leading-4 text-muted">{t.descriptor}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Ukuran halaman">
        <TrimRows trim={trim} onTrimChange={onTrimChange} />
      </Section>

      <Section label="Huruf isi" flush>
        {/* The specimen rows are tall; the summary line is what the page is
            set in right now, the rest opens on demand. */}
        <details className="group">
          <summary className="tap flex cursor-pointer list-none items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-field [&::-webkit-details-marker]:hidden">
            <span className="grid w-[2.125rem] place-items-center font-display text-xl leading-none text-ink">Aa</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{bodyFont ?? info.bodyFont}</span>
              <span className="block font-mono text-2xs leading-4 text-muted">
                {bodyFont ? "kustom" : "bawaan template"}
              </span>
            </span>
            <span aria-hidden className="text-muted transition-transform duration-150 group-open:rotate-180">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </summary>
          <div className="px-1.5 pb-2 pt-2">{themePresets}</div>
        </details>
      </Section>

      <Section label="Spesifikasi" last>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-xs">
          <Spec k="Ukuran teks" v={pt(spec.sizePt)} />
          <Spec k="Leading" v={pt(spec.leadingPt)} />
          <Spec k="Baris per halaman" v={String(spec.linesPerPage)} />
          <Spec k="Ukuran baris" v={`±${spec.measure} karakter`} />
          <Spec k="Margin dalam" v={inches(spec.margin.inside)} />
          <Spec k="Margin luar" v={inches(spec.margin.outside)} />
          <Spec k="Margin atas · bawah" v={`${inches(spec.margin.top)} · ${inches(spec.margin.bottom)}`} />
        </dl>
        <p className="mt-3 font-mono text-2xs leading-4 text-muted">{spec.furniture}</p>
      </Section>
    </div>
  );
}

function Section({
  label,
  children,
  flush,
  last,
}: {
  label: string;
  children: ReactNode;
  /** No horizontal padding on the body — for a control that paints its own. */
  flush?: boolean;
  last?: boolean;
}) {
  return (
    <section className={`px-3 pb-3 pt-3 ${last ? "" : "border-b border-hairline"}`}>
      <PanelLabel className={`block ${flush ? "px-1.5" : ""} mb-2`}>{label}</PanelLabel>
      {children}
    </section>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-mono text-2xs tabular-nums text-ink">{v}</dd>
    </>
  );
}

// --- template thumbnail ------------------------------------------------------

/**
 * Page-shaped at the current trim in all three states. Shimmer means "working"
 * and only appears while compiling; a page that never arrived is a bare
 * outline, same as the preview pane's nothing-yet state.
 */
function Thumbnail({ template, trim, enabled }: { template: TemplateId; trim: Trim; enabled: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Nothing compiles until the panel is on screen. The module cache makes
  // every later look instant.
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setFailed(false);
    templateThumbnail(template, trim).then(
      (url) => live && setSrc(url),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [enabled, template, trim]);

  return (
    <span
      className="relative block overflow-hidden rounded-sm border border-hairline bg-paper"
      style={{ aspectRatio: trimAspect(trim) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a canvas data URL; next/image would only proxy it
        <img src={src} alt="" className="block h-full w-full object-cover" />
      ) : failed ? null : (
        <span className="absolute inset-0 block overflow-hidden">
          <span className="animate-shimmer block h-full w-1/2 bg-linear-to-r from-transparent via-field to-transparent" />
        </span>
      )}
    </span>
  );
}

// --- trim rows ---------------------------------------------------------------

/**
 * Rows, not a dropdown: each is prefixed by a rectangle at that trim's own
 * aspect ratio, so the shapes differ on sight (UI-REFERENCE). `Kustom…` is the
 * last row and expands two number inputs in place.
 */
function TrimRows({ trim, onTrimChange }: { trim: Trim; onTrimChange: (trim: Trim) => void }) {
  const custom = typeof trim !== "string";
  const [expanded, setExpanded] = useState(custom);
  // Seeded from wherever the project is now, so `Kustom…` starts from the
  // current page rather than from nothing.
  const seed = custom ? [trim.width, trim.height] : [TRIM_SIZES[trim].w, TRIM_SIZES[trim].h];
  const [w, setW] = useState(() => roundTrim(seed[0]));
  const [h, setH] = useState(() => roundTrim(seed[1]));

  function commit(width: string, height: string) {
    const wn = Number(width.replace(",", "."));
    const hn = Number(height.replace(",", "."));
    // Half-typed values simply do not commit; the service clamps the rest to
    // sane book bounds (registry.mjs resolveTrim).
    if (wn > 0 && hn > 0) onTrimChange({ width: wn, height: hn, unit: "in" });
  }

  return (
    <div className="grid gap-0.5">
      {(Object.keys(TRIM_SIZES) as TrimPreset[]).map((id) => (
        <TrimRow
          key={id}
          trim={id}
          name={TRIM_PRESET_NAMES[id]}
          detail={TRIM_SIZES[id].label}
          active={trim === id}
          onClick={() => onTrimChange(id)}
        />
      ))}

      <TrimRow
        trim={custom ? trim : { width: 5.5, height: 8.5 }}
        name="Kustom…"
        detail={custom ? trimLabel(trim) : ""}
        active={custom}
        expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      />

      {expanded && (
        <div className="grid grid-cols-2 gap-2 px-1.5 pb-1 pt-1">
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
      )}
    </div>
  );
}

function TrimRow({
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
      className="tap grid w-full grid-cols-[2.125rem_1fr_auto] items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-[background-color,scale] duration-150 ease-[var(--ease-enter)] hover:bg-field active:scale-[0.98]"
    >
      {/* Square, like the sheets in the preview stack: the smallest radius on
          the scale would round away more than half of a 15px edge. */}
      <span className="grid place-items-center">
        <span
          aria-hidden
          style={{ aspectRatio: trimAspect(trim) }}
          className={`block h-5 border ${active ? "border-accent" : "border-muted"} ${typeof trim === "string" ? "" : "border-dashed"}`}
        />
      </span>
      <span className={`text-sm ${active ? "text-accent-ink" : "text-ink"}`}>{name}</span>
      <span className="font-mono text-2xs tabular-nums text-muted">{detail}</span>
    </button>
  );
}

/** Label above the input, per HANDOFF §6.6. */
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
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
