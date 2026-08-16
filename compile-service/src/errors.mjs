// Foliate compile service — structured errors (handoff §3, §6.6).
// Turn raw typst/pandoc stderr into {stage, line, message} the app can show
// inline ("Gagal compile di halaman 3 — ..."), never a raw stack trace.

export class CompileError extends Error {
  constructor({ stage, message, line = null, detail = null, hint = null }) {
    super(message);
    this.name = "CompileError";
    this.stage = stage; // "sanitize" | "pandoc" | "assemble" | "typst" | "timeout"
    this.line = line;
    this.detail = detail;
    this.hint = hint;
  }
  toJSON() {
    return {
      error: true,
      stage: this.stage,
      message: this.message,
      line: this.line,
      hint: this.hint,
    };
  }
}

// Typst emits: "error: <msg>\n  ┌─ <file>:<line>:<col>".
// We surface the first error and its source line, dropping warnings/noise.
export function parseTypstError(stderr) {
  const text = String(stderr || "");
  const errBlock = text.split(/\n(?=error:|warning:)/).find((b) => b.startsWith("error:"));
  if (!errBlock) {
    return new CompileError({ stage: "typst", message: "Compile gagal tanpa pesan error yang jelas.", detail: text.slice(0, 500) });
  }
  const msg = errBlock.replace(/^error:\s*/, "").split("\n")[0].trim();
  const loc = errBlock.match(/:(\d+):(\d+)/);
  const line = loc ? Number(loc[1]) : null;
  let hint = null;
  if (/unknown font|font family/i.test(msg)) hint = "Font template tidak tersedia di server.";
  else if (/file not found|failed to (load|decode)/i.test(msg)) hint = "Aset/gambar yang dirujuk tidak ditemukan.";
  else if (/unexpected|unclosed|expected/i.test(msg)) hint = "Kemungkinan markup tidak didukung pada baris itu.";
  return new CompileError({ stage: "typst", message: msg, line, hint, detail: errBlock.slice(0, 600) });
}

export function parsePandocError(stderr) {
  const text = String(stderr || "").trim();
  const first = text.split("\n").find((l) => l.trim()) || "Konversi Markdown gagal.";
  return new CompileError({ stage: "pandoc", message: first.trim(), detail: text.slice(0, 500) });
}

// Warnings are non-fatal: the compile still produced a file. The editor shows
// them next to the page count (GET-style /metadata), so they must be as small
// and as deduped as the errors above — typst repeats the same warning per page.
// Engine bookkeeping the author cannot act on (cover export turns off PDF tags).
const NOISE = /implies --no-pdf-tags/;

export function parseTypstWarnings(stderr) {
  const blocks = String(stderr || "")
    .split(/\n(?=error:|warning:)/)
    .filter((b) => b.startsWith("warning:") && !NOISE.test(b));
  return dedupe(blocks.map((b) => {
    const loc = b.match(/:(\d+):(\d+)/);
    return {
      stage: "typst",
      message: b.replace(/^warning:\s*/, "").split("\n")[0].trim(),
      line: loc ? Number(loc[1]) : null,
    };
  }));
}

// pandoc marks its own with "[WARNING] ..." on stderr.
export function parsePandocWarnings(stderr) {
  return dedupe(String(stderr || "")
    .split("\n")
    .filter((l) => l.startsWith("[WARNING]"))
    .map((l) => ({ stage: "pandoc", message: l.replace(/^\[WARNING\]\s*/, "").trim(), line: null })));
}

function dedupe(list) {
  const seen = new Map();
  for (const w of list) seen.set(`${w.message}@${w.line}`, w);
  return [...seen.values()].slice(0, 20);
}
