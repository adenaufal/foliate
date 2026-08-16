// Foliate compile service — template & trim registry (single source of truth).
// The pipeline validates requests against this; the .typ files own the actual
// layout. Keep ids stable — they are persisted on projects (Supabase).
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { TEMPLATES_DIR } from "./config.mjs";

// --- templates ---------------------------------------------------------------
// `entry` is the exported function name in the .typ file (always `book` for now).
export const TEMPLATES = {
  literary: {
    id: "literary",
    label: "Literary",
    file: "literary.typ",
    blurb: "Warm publisher serif, sunk chapter openers, asterism scene breaks.",
    bodyFont: "Spectral",
  },
  // M1: two more, genuinely different in character (built next).
  manuscript: {
    id: "manuscript",
    label: "Manuscript",
    file: "manuscript.typ",
    blurb: "Generous leading, classic old-style figures, restrained academic feel.",
    bodyFont: "Source Serif 4",
  },
  contemporary: {
    id: "contemporary",
    label: "Contemporary",
    file: "contemporary.typ",
    blurb: "Tighter measure, modern transitional serif, bold sans chapter heads.",
    bodyFont: "Libre Baskerville",
  },
};

export const DEFAULT_TEMPLATE = "literary";

export function resolveTemplate(id) {
  const t = TEMPLATES[id] ?? TEMPLATES[DEFAULT_TEMPLATE];
  const path = resolve(TEMPLATES_DIR, t.file);
  return { ...t, path, exists: existsSync(path) };
}

// --- trim sizes --------------------------------------------------------------
// Named presets pass through as strings the .typ understands; custom is given
// as explicit dimensions the template accepts via the same `trim` arg.
export const TRIM_PRESETS = {
  "5x8": { label: '5 × 8"', kind: "preset" },
  "6x9": { label: '6 × 9"', kind: "preset" },
  a5: { label: "A5 (148 × 210mm)", kind: "preset" },
};

export const DEFAULT_TRIM = "5x8";

// Accepts "5x8" | "6x9" | "a5" | {width, height, unit?} for custom.
// Returns a value safe to inject into the .typ `trim:` argument.
export function resolveTrim(trim) {
  if (typeof trim === "string" && TRIM_PRESETS[trim]) {
    return { kind: "preset", value: trim };
  }
  if (trim && typeof trim === "object") {
    const unit = ["in", "mm", "cm"].includes(trim.unit) ? trim.unit : "in";
    const w = Number(trim.width);
    const h = Number(trim.height);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      // clamp to sane book bounds (avoid pathological page sizes)
      const clamp = (v) => Math.min(Math.max(v, unit === "in" ? 3 : 76), unit === "in" ? 12 : 305);
      return { kind: "custom", width: clamp(w), height: clamp(h), unit };
    }
  }
  return { kind: "preset", value: DEFAULT_TRIM };
}
