// Typed client for the Foliate compile service.
// The browser never talks to port 8723 directly (BUILD-PLAN §5) — everything
// goes through /api/compile, which proxies and streams the PDF back.
// Contract mirrored from compile-service/src/{server,registry,errors}.mjs.

export type TemplateId = "literary" | "manuscript" | "contemporary";
export type TrimPreset = "5x8" | "6x9" | "a5";
export type TrimUnit = "in" | "mm" | "cm";
export type CustomTrim = { width: number; height: number; unit?: TrimUnit };
export type Trim = TrimPreset | CustomTrim;

export const DEFAULT_TEMPLATE: TemplateId = "literary";
export const DEFAULT_TRIM: TrimPreset = "5x8";

/** Physical size of each preset, in inches — drives the page aspect ratio in
 *  the preview and the trim selector's proportional swatch. */
export const TRIM_SIZES: Record<TrimPreset, { label: string; w: number; h: number }> = {
  "5x8": { label: "5 × 8 in", w: 5, h: 8 },
  "6x9": { label: "6 × 9 in", w: 6, h: 9 },
  a5: { label: "148 × 210 mm", w: 148 / 25.4, h: 210 / 25.4 },
};

/** `aspect-ratio` value for a page at this trim. Used for the empty page
 *  outline and the compile skeleton, both of which must be trim-sized before
 *  any PDF exists (HANDOFF §6.6). */
export function trimAspect(trim: Trim): number {
  if (typeof trim === "string") {
    const t = TRIM_SIZES[trim] ?? TRIM_SIZES[DEFAULT_TRIM];
    return t.w / t.h;
  }
  const k = trim.unit === "mm" ? 1 / 25.4 : trim.unit === "cm" ? 1 / 2.54 : 1;
  return (trim.width * k) / (trim.height * k);
}

export interface CompileMetadata {
  title?: string;
  subtitle?: string;
  author?: string;
}

export interface CompileRequest {
  markdown: string;
  template?: TemplateId;
  trim?: Trim;
  metadata?: CompileMetadata;
  /** base64 image assets referenced by the markdown; max 50 (service schema). */
  assets?: { name: string; data: string }[];
}

/** The service's structured failure body — forwarded through the proxy
 *  unchanged. `stage` comes from CompileError in errors.mjs. */
export interface CompileErrorBody {
  error: true;
  stage: "request" | "sanitize" | "pandoc" | "assemble" | "typst" | "timeout" | "internal" | "network";
  message: string;
  line?: number | null;
  hint?: string | null;
}

/** "Gagal compile di halaman 3 — tabel kompleks belum didukung". The editor
 *  renders a CompileErrorBody straight from state, so the formatting cannot
 *  live only on the exception. */
export function inlineError(body: CompileErrorBody): string {
  const where = body.line ? ` (baris ${body.line})` : "";
  const hint = body.hint ? ` — ${body.hint}` : "";
  return `${body.message}${where}${hint}`;
}

export class CompileFailed extends Error {
  readonly body: CompileErrorBody;
  readonly status: number;
  constructor(body: CompileErrorBody, status: number) {
    super(body.message);
    this.name = "CompileFailed";
    this.body = body;
    this.status = status;
  }
  get inline(): string {
    return inlineError(this.body);
  }
}

/**
 * Compile markdown to a PDF blob. Throws CompileFailed with the service's
 * structured body on 4xx/5xx so callers can render it inline.
 * Pass an AbortSignal — debounced live preview must cancel the in-flight run.
 */
export async function compile(req: CompileRequest, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch("/api/compile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as CompileErrorBody | null;
    throw new CompileFailed(
      body ?? { error: true, stage: "internal", message: "Compile gagal tanpa pesan." },
      res.status,
    );
  }
  return res.blob();
}
