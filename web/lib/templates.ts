// The template catalogue as the chrome knows it: labels, the one-line
// typographic descriptor each card carries, and the page geometry each .typ
// sets. Mirrored from compile-service/templates/*.typ so the inspector can
// state the specification of the page the writer is looking at without a
// round-trip — the numbers here are the template's, not a measurement of the
// compiled PDF.
//
// Self-check (pure):
//   import("@/lib/templates").then(m => console.log(m.selfCheckTemplates()))

import { trimInches, type TemplateId, type Trim } from "./compile";

export interface TemplateInfo {
  id: TemplateId;
  label: string;
  /** Face · size/leading · the opener's character, in muted mono under the name. */
  descriptor: string;
  bodyFont: string;
  /** null = the heads ride on the body face (manuscript). */
  displayFont: string | null;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "literary",
    label: "Literary",
    descriptor: "Spectral · 10,5/15 · pembuka turun",
    bodyFont: "Spectral",
    displayFont: "Spectral",
  },
  {
    id: "manuscript",
    label: "Manuscript",
    descriptor: "Source Serif 4 · 11/17,8 · bab terpusat",
    bodyFont: "Source Serif 4",
    displayFont: null,
  },
  {
    id: "contemporary",
    label: "Contemporary",
    descriptor: "Libre Baskerville · 9,5/14,7 · nomor bab besar",
    bodyFont: "Libre Baskerville",
    displayFont: "Barlow",
  },
];

export function templateInfo(id: TemplateId): TemplateInfo {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

// --- page geometry -----------------------------------------------------------

export interface PageSpec {
  /** Body size, pt. */
  sizePt: number;
  /** Baseline to baseline, pt. */
  leadingPt: number;
  linesPerPage: number;
  /** Characters per line, approximate — the measure the justification works with. */
  measure: number;
  /** Inches. `inside` is the gutter side. */
  margin: { inside: number; outside: number; top: number; bottom: number };
  /** Where the running head and folio sit, in the template's own words. */
  furniture: string;
}

type Margin = PageSpec["margin"];

interface Geometry {
  sizePt: number;
  margin: Margin;
}

/** Baseline-to-baseline over body size, read off each template's `leading`. */
const LEADING_RATIO: Record<TemplateId, number> = {
  literary: 15 / 10.5,
  manuscript: 17.8 / 11,
  contemporary: 14.7 / 9.5,
};

/** Average advance width per character in em, per body face. Libre Baskerville's
 *  figure is the one contemporary.typ sizes its measure from; the serifs are
 *  narrower. Approximate by design — the number is labelled ± in the chrome. */
const EM_PER_CHAR: Record<TemplateId, number> = {
  literary: 0.47,
  manuscript: 0.5,
  contemporary: 0.537,
};

const FURNITURE: Record<TemplateId, string> = {
  literary: "judul · bab di kepala, folio tengah bawah",
  manuscript: "satu baris atas: folio · judul/bab",
  contemporary: "kaki sans: folio luar · judul/bab",
};

/** literary.typ: one fixed recipe at every trim. */
function literaryGeometry(): Geometry {
  return { sizePt: 10.5, margin: { inside: 0.85, outside: 0.7, top: 0.85, bottom: 0.8 } };
}

/** manuscript.typ `_GEOM` / `_geom`. */
function manuscriptGeometry(trim: Trim): Geometry {
  if (typeof trim === "string") {
    switch (trim) {
      case "6x9":
        return { sizePt: 11.5, margin: { inside: 1.1, outside: 0.85, top: 1.25, bottom: 1.15 } };
      case "a5":
        return { sizePt: 11, margin: { inside: 1.0, outside: 0.82, top: 1.15, bottom: 1.1 } };
      default:
        return { sizePt: 11, margin: { inside: 0.82, outside: 0.68, top: 1.05, bottom: 1.0 } };
    }
  }
  const { w, h } = trimInches(trim);
  return { sizePt: 11, margin: { inside: w * 0.164, outside: w * 0.136, top: h * 0.131, bottom: h * 0.125 } };
}

/** contemporary.typ `_GEOM` / `_geom` — the type shrinks on a narrow custom page. */
function contemporaryGeometry(trim: Trim): Geometry {
  if (typeof trim === "string") {
    switch (trim) {
      case "6x9":
        return { sizePt: 10, margin: { inside: 1.15, outside: 0.95, top: 0.85, bottom: 0.92 } };
      case "a5":
        return { sizePt: 9.5, margin: { inside: 1.15, outside: 0.95, top: 0.78, bottom: 0.85 } };
      default:
        return { sizePt: 9.5, margin: { inside: 0.88, outside: 0.72, top: 0.7, bottom: 0.78 } };
    }
  }
  const { w, h } = trimInches(trim);
  const measurePt = w * 0.68 * 72;
  return {
    sizePt: Math.min(9.5, measurePt / 25.8),
    margin: { inside: w * 0.176, outside: w * 0.144, top: h * 0.0875, bottom: h * 0.0975 },
  };
}

function geometry(template: TemplateId, trim: Trim): Geometry {
  switch (template) {
    case "manuscript":
      return manuscriptGeometry(trim);
    case "contemporary":
      return contemporaryGeometry(trim);
    default:
      return literaryGeometry();
  }
}

/** The page as the template would set it at this trim. */
export function pageSpec(template: TemplateId, trim: Trim): PageSpec {
  const { w, h } = trimInches(trim);
  const g = geometry(template, trim);
  const leadingPt = g.sizePt * LEADING_RATIO[template];
  const textHeightPt = (h - g.margin.top - g.margin.bottom) * 72;
  const textWidthPt = (w - g.margin.inside - g.margin.outside) * 72;
  return {
    sizePt: round1(g.sizePt),
    leadingPt: round1(leadingPt),
    linesPerPage: Math.max(1, Math.floor(textHeightPt / leadingPt)),
    measure: Math.max(1, Math.round(textWidthPt / (g.sizePt * EM_PER_CHAR[template]))),
    margin: g.margin,
    furniture: FURNITURE[template],
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** "10,5 pt" — decimal comma, trailing zero dropped. */
export function pt(v: number): string {
  return `${String(round1(v)).replace(".", ",")} pt`;
}

/** "0,85 in" */
export function inches(v: number): string {
  return `${String(Math.round(v * 100) / 100).replace(".", ",")} in`;
}

// --- self-check --------------------------------------------------------------

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`templates self-check: ${msg}`);
}

export function selfCheckTemplates(): string {
  ok(TEMPLATES.length === 3 && templateInfo("manuscript").label === "Manuscript", "catalogue lists the three templates");
  ok(templateInfo("nope" as TemplateId).id === "literary", "an unknown id falls back to literary");

  const lit = pageSpec("literary", "5x8");
  ok(lit.sizePt === 10.5 && lit.leadingPt === 15, "literary: 10,5/15 at 5×8");
  ok(lit.linesPerPage >= 29 && lit.linesPerPage <= 31, `literary: ~30 lines at 5×8, got ${lit.linesPerPage}`);

  const man = pageSpec("manuscript", "5x8");
  ok(man.linesPerPage === 24, `manuscript: 24 lines at 5×8 (the .typ says so), got ${man.linesPerPage}`);
  ok(pageSpec("manuscript", "6x9").sizePt === 11.5, "manuscript steps its body size at 6×9");
  ok(man.measure >= 45 && man.measure <= 58, `manuscript: 49–56 chars/line at 5×8, got ${man.measure}`);

  const con = pageSpec("contemporary", "5x8");
  ok(con.sizePt === 9.5 && con.leadingPt === 14.7, "contemporary: 9,5/14,7 at 5×8");
  ok(con.measure >= 44 && con.measure <= 56, `contemporary: 48–53 chars/line at 5×8, got ${con.measure}`);
  ok(pageSpec("contemporary", { width: 4, height: 6.5, unit: "in" }).sizePt < 9.5, "contemporary shrinks on a narrow custom page");
  ok(pageSpec("contemporary", { width: 6, height: 9, unit: "in" }).sizePt === 9.5, "…but never grows past 9,5");

  const mm = pageSpec("manuscript", { width: 148, height: 210, unit: "mm" });
  ok(Math.abs(mm.margin.inside - 5.83 * 0.164) < 0.01, "custom margins follow the page in inches, whatever the unit");

  ok(pt(10.5) === "10,5 pt" && pt(11) === "11 pt", "pt formats with a decimal comma");
  ok(inches(0.85) === "0,85 in", "inches formats with a decimal comma");

  return "templates self-check: ok";
}
