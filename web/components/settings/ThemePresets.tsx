"use client";

// Per-template theme customization (Phase 2). The only knob the engine exposes
// is `body-font:` — compile-service/src/pipeline.mjs passes `bodyFont` straight
// into `book.with(...)` and nothing else about the page is parameterised — so
// the presets are body faces, shown as specimens rather than named in a list.
// A curated finite set, deliberately: a free picker (hex field, font dropdown of
// every installed face) produces books that undermine the typographic claim.
//
// Selection is native radios in one group: arrow keys, roving tab stop, and
// `:checked` styling for free. Nothing here calls setState to move focus.
//
// Self-check: open /dev/theme-presets, or from the console —
//   import("@/components/settings/ThemePresets").then(m => m.selfCheckThemePresets())

import { useEffect, useId, useRef, useState } from "react";
// Per-icon import: the barrel is thousands of modules and slows dev compiles.
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { Barlow, Libre_Baskerville, Source_Serif_4, Spectral } from "next/font/google";
import type { TemplateId } from "@/lib/compile";
import type { ThemePresetsProps, UploadedFont } from "@/lib/editor-session";

// The four faces on the service's font path (compile-service/fonts). Loaded as
// webfonts so a row can be set in the face it names — a specimen the user can
// only judge by seeing it. Latin + the weights used below, nothing more.
const spectral = Spectral({ subsets: ["latin"], weight: ["400", "600"], display: "swap" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap" });
const baskerville = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const barlow = Barlow({ subsets: ["latin"], weight: ["600"], display: "swap" });

interface Face {
  /** Exactly the family name Typst matches on. Do not prettify. */
  family: string;
  css: string;
  trait: string;
}

const FACES: Record<string, Face> = {
  Spectral: { family: "Spectral", css: spectral.style.fontFamily, trait: "serif hangat" },
  "Source Serif 4": { family: "Source Serif 4", css: sourceSerif.style.fontFamily, trait: "angka old-style" },
  "Libre Baskerville": { family: "Libre Baskerville", css: baskerville.style.fontFamily, trait: "x-height tinggi" },
};

const ORDER = ["Spectral", "Source Serif 4", "Libre Baskerville"] as const;

/** Mirrors compile-service/src/registry.mjs. `bodyFont: null` means the
 *  template keeps its own face, so this only labels the default row. */
const TEMPLATE_BODY: Record<TemplateId, string> = {
  literary: "Spectral",
  manuscript: "Source Serif 4",
  contemporary: "Libre Baskerville",
};

/** The pipeline forwards `bodyFont` and nothing else, so a template's
 *  `display-font:` default is fixed no matter which preset is picked — the
 *  specimen's head line must show that face, not the row's. manuscript.typ
 *  declares no display-font (its heads ride on body-font's smcp), so it is the
 *  one template where the head follows the row. */
const TEMPLATE_DISPLAY: Record<TemplateId, Pick<Face, "family" | "css"> | null> = {
  literary: { family: "Spectral", css: spectral.style.fontFamily },
  manuscript: null,
  contemporary: { family: "Barlow", css: barlow.style.fontFamily },
};

// Ascenders, descenders, a comma and figures — enough to tell two serifs apart.
const SPECIMEN_HEAD = "Bab Satu";
const SPECIMEN_BODY = "Hujan turun pelan di jendela, dan ia membaca sampai halaman 128.";

const COPY = {
  legend: "Huruf isi buku",
  help: "Tiap baris diset dengan hurufnya sendiri.",
  default: "Bawaan",
  customTitle: "Font kustom",
  customHelp: "Unggah .otf atau .ttf. Typst mencocokkan nama family, bukan nama berkas.",
  upload: "Unggah font",
  uploading: "Mengunggah…",
  uploadFailed: "Font gagal dibaca. Coba berkas lain.",
  noCustom: "Belum ada font kustom.",
  familyLabel: "Nama family",
  familyHelp: "Ubah kalau hasil compile masih memakai huruf bawaan.",
} as const;

// --- family name from filename ----------------------------------------------
// Typst matches on the family name inside the font's name table, which a
// filename only approximates. This is the seed for the confirm field, not the
// answer. ponytail: filename heuristic — parse the OTF name table if a font
// ever ships a filename this cannot reach.

const STYLE_WORD =
  /^(variable(font)?|wght.*|opsz.*|regular|normal|book|roman|italic|oblique|thin|extralight|ultralight|light|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|it|bolditalic|boldit|semibolditalic|mediumitalic|lightitalic)$/i;

export function familyFromFilename(filename: string): string {
  const stem = (filename.split(/[\\/]/).pop() ?? filename).replace(/\.[^.]+$/, "");
  const parts = stem.split(/[-_]/).filter(Boolean);
  while (parts.length > 1 && STYLE_WORD.test(parts[parts.length - 1])) parts.pop();
  return parts
    .join(" ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

// --- rows --------------------------------------------------------------------

interface PresetRow {
  key: string;
  /** null = the template's own face; anything else is a `bodyFont` value. */
  value: string | null;
  face: Face;
  isDefault: boolean;
}

export function presetRows(template: TemplateId): PresetRow[] {
  const own = TEMPLATE_BODY[template];
  return [
    { key: "default", value: null, face: FACES[own], isDefault: true },
    ...ORDER.filter((f) => f !== own).map((f) => ({ key: f, value: f, face: FACES[f], isDefault: false })),
  ];
}

// --- component ---------------------------------------------------------------

export function ThemePresets({
  template,
  bodyFont,
  onBodyFontChange,
  fonts,
  onFontUpload,
}: ThemePresetsProps) {
  const group = useId();
  const helpId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  // Filename -> confirmed family. Seeded from the heuristic on first read, so
  // an untouched upload needs no entry here.
  const [families, setFamilies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const display = TEMPLATE_DISPLAY[template];
  const rows = presetRows(template);
  const familyOf = (f: UploadedFont) => families[f.name] ?? familyFromFilename(f.name);
  const activeCustom = fonts.find((f) => familyOf(f) === bodyFont) ?? null;
  const uploadedCss = useUploadedFaces(fonts);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const message = await onFontUpload(file);
      if (message) {
        setError(message);
        return;
      }
      // An upload is a request to use it — apply immediately so the next
      // compile shows the face rather than making the user hunt for a row.
      onBodyFontChange(familyFromFilename(file.name));
    } catch {
      setError(COPY.uploadFailed);
    } finally {
      setBusy(false);
      // Let the same file be picked again after a rejection.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function renameFamily(file: string, next: string) {
    const family = next.trim();
    if (!family) return;
    setFamilies((m) => ({ ...m, [file]: family }));
    onBodyFontChange(family);
  }

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm text-ink">{COPY.legend}</legend>
      <p className="text-2xs text-muted">{COPY.help}</p>

      <div className="space-y-2">
        {rows.map((row) => (
          <SpecimenRow
            key={row.key}
            group={group}
            face={row.face}
            display={display}
            badge={row.isDefault ? COPY.default : null}
            checked={row.value === null ? bodyFont === null : bodyFont === row.value}
            onSelect={() => onBodyFontChange(row.value)}
          />
        ))}
      </div>

      {/* Upload is its own labelled block, never a swatch in the list above. */}
      <div className="space-y-2 border-t border-hairline pt-3">
        <p className="text-sm text-ink">{COPY.customTitle}</p>
        <p id={helpId} className="text-2xs text-muted">
          {COPY.customHelp}
        </p>

        <label className="btn btn-ghost cursor-pointer gap-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <UploadSimpleIcon size={15} weight="regular" className="text-muted" aria-hidden />
          {busy ? COPY.uploading : COPY.upload}
          <input
            ref={fileInput}
            type="file"
            accept=".otf,.ttf,.otc,.ttc"
            aria-describedby={helpId}
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>

        {error && (
          <p role="alert" className="text-2xs text-accent-ink">
            {error}
          </p>
        )}

        {fonts.length === 0 ? (
          <p className="text-2xs text-muted">{COPY.noCustom}</p>
        ) : (
          <div className="space-y-2">
            {fonts.map((f) => (
              <SpecimenRow
                key={f.name}
                group={group}
                // The filename is the trait line here: it is the only thing
                // separating two uploads whose guessed families collide.
                face={{ family: familyOf(f), css: uploadedCss[f.name] ?? "inherit", trait: f.name }}
                display={display}
                badge={null}
                checked={familyOf(f) === bodyFont}
                onSelect={() => onBodyFontChange(familyOf(f))}
              />
            ))}
          </div>
        )}

        {activeCustom && (
          <div className="space-y-1 pt-1">
            {/* Label above the input, error/help below — HANDOFF §6.6. */}
            <label htmlFor={`${group}-family`} className="block text-2xs text-muted">
              {COPY.familyLabel}
            </label>
            <input
              id={`${group}-family`}
              // Uncontrolled and committed on blur/Enter: a controlled field
              // would fire a compile per keystroke, each with a family that
              // does not resolve yet.
              key={activeCustom.name}
              defaultValue={familyOf(activeCustom)}
              spellCheck={false}
              className="w-full rounded-md border border-hairline bg-paper px-2 py-1 font-mono text-2xs text-ink"
              onBlur={(e) => renameFamily(activeCustom.name, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
            <p className="text-2xs text-muted">{COPY.familyHelp}</p>
          </div>
        )}
      </div>
    </fieldset>
  );
}

/**
 * Register uploaded faces with the document so their row is a real specimen and
 * not the chrome sans wearing the family's name. The bytes are already in
 * memory as base64 — the alternative is the one row that most needs looking at
 * being the one row you cannot judge by looking.
 *
 * A rejected load stays silent: browsers refuse the .ttc/.otc collections Typst
 * reads fine, so a failure here is not evidence the upload is bad. The row falls
 * back to `inherit` and the compile has the last word.
 * ponytail: faces stay registered for the session, like the uploads themselves.
 */
function useUploadedFaces(fonts: UploadedFont[]): Record<string, string> {
  const [css, setCss] = useState<Record<string, string>>({});
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    for (const f of fonts) {
      if (seen.current.has(f.name)) continue;
      seen.current.add(f.name);
      const family = `foliate-upload-${seen.current.size}`;
      const face = new FontFace(family, `url(data:font/ttf;base64,${f.data})`);
      face
        .load()
        .then(() => {
          if (!live) return;
          document.fonts.add(face);
          setCss((m) => ({ ...m, [f.name]: family }));
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [fonts]);

  return css;
}

/**
 * One radio-semantic specimen. The whole tile is the target; the state is the
 * native `:checked`, so arrow keys walk the group without a keydown handler.
 */
function SpecimenRow({
  group,
  face,
  display,
  badge,
  checked,
  onSelect,
}: {
  group: string;
  face: Face;
  display: Pick<Face, "family" | "css"> | null;
  badge: string | null;
  checked: boolean;
  onSelect: () => void;
}) {
  const head = display ?? face;
  const pairing =
    display && display.family !== face.family
      ? `${face.family} / ${display.family}`
      : `${face.family} · ${face.trait}`;

  return (
    <label className="group block cursor-pointer rounded-lg border border-hairline bg-paper px-3 py-2.5 transition-[border-color,box-shadow] duration-150 ease-[var(--ease-enter)] hover:border-muted has-[:checked]:border-accent has-[:checked]:ring-[1.5px] has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      <input
        type="radio"
        name={group}
        value={face.family}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />

      <span
        aria-hidden
        style={{ fontFamily: head.css }}
        className="block text-2xs uppercase tracking-[0.18em] text-muted"
      >
        {SPECIMEN_HEAD}
      </span>
      <span
        aria-hidden
        style={{ fontFamily: face.css }}
        className="mt-1 block text-base leading-snug text-ink"
      >
        {SPECIMEN_BODY}
      </span>

      <span className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-ink group-has-[:checked]:text-accent-ink">
          {face.family}
        </span>
        {badge && <span className="shrink-0 font-mono text-2xs text-muted">{badge}</span>}
      </span>
      <span className="block truncate font-mono text-2xs text-muted">{pairing}</span>
    </label>
  );
}

// --- self-check --------------------------------------------------------------
// next/font makes this module browser-shaped, so it runs from the harness page
// (/dev/theme-presets) rather than under node — same arrangement as lib/storage.

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`theme-presets self-check: ${msg}`);
}

export function selfCheckThemePresets(): string {
  const f = familyFromFilename;
  ok(f("SourceSerif4-Regular.ttf") === "Source Serif 4", "style suffix and camel/digit split");
  ok(f("LibreBaskerville-Italic.ttf") === "Libre Baskerville", "italic is a style, not a family");
  ok(f("Spectral-SemiBoldItalic.ttf") === "Spectral", "compound style suffix");
  ok(f("SpectralSC-Medium.ttf") === "Spectral SC", "trailing initialism survives");
  ok(f("Barlow-Bold.ttf") === "Barlow", "single-word family");
  ok(f("my-font.otf") === "my font", "a non-style segment is kept");
  ok(f("Regular.ttf") === "Regular", "never strips the only segment");
  ok(f("C:\\fonts\\Inter-VariableFont_wght.ttf") === "Inter", "path and variable-axis suffix");

  for (const t of ["literary", "manuscript", "contemporary"] as const) {
    const rows = presetRows(t);
    ok(rows.length === 3, `${t}: three preset rows`);
    ok(rows[0].value === null, `${t}: the default row means "template's own"`);
    ok(rows[0].face.family === TEMPLATE_BODY[t], `${t}: the default row shows the template's face`);
    ok(new Set(rows.map((r) => r.face.family)).size === 3, `${t}: no face listed twice`);
    ok(
      rows.slice(1).every((r) => r.value === r.face.family),
      `${t}: a non-default row sends the family Typst matches on`,
    );
  }

  ok(TEMPLATE_DISPLAY.contemporary?.family === "Barlow", "contemporary pairs its body face with Barlow");
  ok(TEMPLATE_DISPLAY.literary?.family === "Spectral", "literary keeps Spectral for display whatever the body face");
  ok(TEMPLATE_DISPLAY.manuscript === null, "manuscript's heads follow the chosen body face");

  return "theme-presets self-check: ok";
}
