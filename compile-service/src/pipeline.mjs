// Foliate compile service — full pipeline: sanitize → pandoc → assemble → typst → PDF.
// Also: docx in (pandoc), epub out (pandoc), cover out (typst, page 1 only).
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { sanitizeMarkdown } from "./sanitize.mjs";
import { resolveTemplate, resolveTrim } from "./registry.mjs";
import {
  CompileError, parseTypstError, parsePandocError, parseTypstWarnings, parsePandocWarnings,
} from "./errors.mjs";
import {
  SERVICE_ROOT, FONTS_DIR, TYPST_BIN, PANDOC_BIN, COMPILE_TIMEOUT_MS,
} from "./config.mjs";

const WORK_ROOT = resolve(SERVICE_ROOT, ".work");

export const FORMATS = ["pdf", "epub", "cover"];

// Typst reads these; anything else in an upload is a mistake worth naming.
const FONT_EXT = /\.(ttf|otf|ttc|otc)$/i;

// Run a binary, optionally feeding stdin. Resolves {stdout: Buffer, stderr, code}.
// Rejects with a CompileError on timeout so callers get a structured error.
function run(bin, args, { input = null, timeoutMs = COMPILE_TIMEOUT_MS, cwd } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { cwd, windowsHide: true });
    const out = [];
    let err = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => (err += d.toString("utf8")));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new CompileError({ stage: "assemble", message: `Gagal menjalankan ${bin}: ${e.message}` }));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(new CompileError({
          stage: "timeout",
          message: `Compile melebihi batas waktu ${Math.round(timeoutMs / 1000)} detik.`,
          hint: "Manuskrip mungkin terlalu besar atau ada markup yang bikin engine berputar lama.",
        }));
      }
      resolvePromise({ stdout: Buffer.concat(out), stderr: err, code });
    });
    if (input != null) {
      child.stdin.end(input);
    }
  });
}

// --- frontmatter (YAML-ish: title/author/subtitle) ---
function extractFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  let body = src;
  if (m) {
    body = src.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (kv) meta[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return { meta, body };
}

// Escape a JS string for embedding inside a Typst "..." string literal.
function typstStr(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// pandoc emits image("relative/or/abs"). Rewrite each ref so it resolves under
// the per-request asset dir (root-absolute path Typst understands via --root).
function rewriteImagePaths(typstBody, assetUrlBase) {
  return typstBody.replace(/image\(\s*"([^"]+)"/g, (full, p) => {
    if (/^(https?:|\/)/.test(p)) {
      // already absolute or remote: leave remote, re-root site-absolute to assets
      if (/^https?:/.test(p)) return full;
    }
    const base = p.split(/[\\/]/).pop();
    return `image("${assetUrlBase}/${typstStr(base)}"`;
  });
}

// Build the `trim:` argument literal for the template (preset string or dict).
function trimArg(trim) {
  if (trim.kind === "preset") return `"${trim.value}"`;
  const u = trim.unit;
  return `(width: ${trim.width}${u}, height: ${trim.height}${u})`;
}

// Page count without a second engine run: typst writes an uncompressed page
// tree at the head of the file — `/Type /Pages` then `/Count n`.
function pdfPageCount(buf) {
  const head = buf.subarray(0, 65536).toString("latin1");
  const m = head.match(/\/Type\s*\/Pages[\s\S]{0,400}?\/Count\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

// pandoc --extract-media writes to <dir>/media/*; rewriteImagePaths keys on the
// basename, so lift the files one level and drop the empty dir.
async function flattenMedia(dir) {
  const media = resolve(dir, "media");
  for (const name of await readdir(media).catch(() => [])) {
    await rename(resolve(media, name), resolve(dir, name)).catch(() => {});
  }
  await rm(media, { recursive: true, force: true }).catch(() => {});
}

// Uploaded fonts live in the request workdir and are handed to typst as a
// second --font-path (the flag is repeatable). Returns the font-path args.
async function writeFonts(fonts, workAbs) {
  const args = ["--font-path", FONTS_DIR];
  if (!fonts.length) return args;
  const fontsAbs = resolve(workAbs, "fonts");
  await mkdir(fontsAbs, { recursive: true });
  for (const f of fonts) {
    if (!f?.name || typeof f.data !== "string") continue;
    const safe = f.name.split(/[\\/]/).pop();
    if (!FONT_EXT.test(safe)) {
      throw new CompileError({
        stage: "assemble",
        message: `Format font "${safe}" tidak didukung.`,
        hint: "Unggah file .ttf, .otf, .ttc, atau .otc.",
      });
    }
    await writeFile(resolve(fontsAbs, safe), Buffer.from(f.data, "base64"));
  }
  args.push("--font-path", fontsAbs);
  return args;
}

// --- main entry: markdown or docx (+ opts) -> PDF / EPUB / cover Buffer ---
// Returns { output, pdf, contentType, filename, meta }. `pdf` is the same buffer
// as `output`, kept because the PDF path is the original contract.
export async function compile({
  markdown,
  docx = null, // base64 .docx; converted to markdown, then the normal path
  template: templateId,
  trim: trimInput,
  metadata = {},
  assets = [],
  fonts = [], // [{name, data:base64}] — added to the typst font path
  bodyFont = null, // family name for the template's `body-font:` (e.g. an upload)
  toc = true, // front-matter table of contents (PDF) / nav toc (EPUB)
  format = "pdf", // "pdf" | "epub" | "cover"
} = {}) {
  if (!FORMATS.includes(format)) {
    throw new CompileError({ stage: "assemble", message: `Format "${format}" tidak dikenal.` });
  }
  if (typeof markdown !== "string" && typeof docx !== "string") {
    throw new CompileError({ stage: "assemble", message: "Permintaan tidak berisi markdown maupun docx." });
  }
  const tpl = resolveTemplate(templateId);
  // EPUB never touches typst, so a missing .typ must not block it.
  if (format !== "epub" && !tpl.exists) {
    throw new CompileError({ stage: "assemble", message: `Template "${templateId}" tidak ditemukan.` });
  }
  const trim = resolveTrim(trimInput);

  // 1. per-request isolated workdir under SERVICE_ROOT (so --root can stay SERVICE_ROOT)
  const id = `${process.pid.toString(36)}-${(globalThis.__seq = (globalThis.__seq ?? 0) + 1).toString(36)}`;
  const workRel = `.work/${id}`;
  const workAbs = resolve(WORK_ROOT, id);
  const assetsAbs = resolve(workAbs, "assets");
  await mkdir(assetsAbs, { recursive: true });
  const warnings = [];

  try {
    // 2. write assets (base64) into the request asset dir
    for (const a of assets) {
      if (!a?.name || typeof a.data !== "string") continue;
      const safe = a.name.split(/[\\/]/).pop();
      await writeFile(resolve(assetsAbs, safe), Buffer.from(a.data, "base64"));
    }

    // 3. docx -> markdown. -s keeps the docx core properties as frontmatter, so
    //    title/author survive into the same metadata path markdown uses.
    let source = markdown;
    if (typeof docx === "string") {
      const docxPath = resolve(workAbs, "input.docx");
      await writeFile(docxPath, Buffer.from(docx, "base64"));
      const conv = await run(PANDOC_BIN, [
        "-s", "--from", "docx", "--to", "markdown", "--wrap=preserve",
        `--extract-media=${assetsAbs}`, docxPath,
      ]);
      if (conv.code !== 0) throw parsePandocError(conv.stderr);
      await flattenMedia(assetsAbs);
      warnings.push(...parsePandocWarnings(conv.stderr));
      source = conv.stdout.toString("utf8");
    }

    // 4. sanitize + frontmatter (request metadata overrides frontmatter)
    const clean = sanitizeMarkdown(source);
    const { meta, body } = extractFrontmatter(clean);
    const title = metadata.title || meta.title || "Untitled";
    const author = metadata.author || meta.author || "Anonymous";
    const subtitle = metadata.subtitle || meta.subtitle || null;
    const baseMeta = { title, author, subtitle, template: tpl.id, trim, format };

    // 5a. EPUB: pandoc writes the container itself; no typst, no template.
    if (format === "epub") {
      const outPath = resolve(workAbs, "book.epub");
      const epub = await run(PANDOC_BIN, [
        "--from", "markdown+smart", "--to", "epub3",
        // --toc puts nav.xhtml in the spine, i.e. a TOC *page* the reader turns
        // past. The nav document itself is mandatory in EPUB3 and stays either
        // way, so the depth cap is unconditional — dropping it with the flag
        // would deepen the reader's navigation when the toggle goes off.
        ...(toc ? ["--toc"] : []), "--toc-depth=2",
        `--resource-path=${assetsAbs}`,
        "--metadata", `title=${title}`,
        "--metadata", `author=${author}`,
        ...(subtitle ? ["--metadata", `subtitle=${subtitle}`] : []),
        "--metadata", "lang=id",
        "-o", outPath,
      ], { input: body });
      if (epub.code !== 0) throw parsePandocError(epub.stderr);
      warnings.push(...parsePandocWarnings(epub.stderr));
      const out = await readFile(outPath);
      return {
        output: out, pdf: out,
        contentType: "application/epub+zip",
        filename: `${title}.epub`,
        meta: { ...baseMeta, pages: null, warnings },
      };
    }

    // 5b. pandoc: markdown body -> typst markup (+smart handles quotes/dashes).
    //     A cover is the template's own title page, so it needs no body at all.
    let typstBody = "";
    if (format !== "cover") {
      const pandoc = await run(PANDOC_BIN, [
        "--from", "markdown+smart", "--to", "typst", "--wrap=preserve",
      ], { input: body });
      if (pandoc.code !== 0) throw parsePandocError(pandoc.stderr);
      warnings.push(...parsePandocWarnings(pandoc.stderr));
      typstBody = rewriteImagePaths(pandoc.stdout.toString("utf8"), `/${workRel}/assets`);
    }

    // 6. assemble main.typ
    const opt = (v) => (v ? `"${typstStr(v)}"` : "none");
    // Only passed when asked for: templates declare body-font with a default and
    // an unexpected argument is a hard typst error.
    const fontOverride = bodyFont ? `\n  body-font: "${typstStr(bodyFont)}",` : "";
    const main = `#import "/templates/${tpl.file}": book, horizontalrule
#show: book.with(
  title: "${typstStr(title)}",
  subtitle: ${opt(subtitle)},
  author: "${typstStr(author)}",
  trim: ${trimArg(trim)},
  toc: ${toc ? "true" : "false"},${fontOverride}
)

${typstBody}`;
    await writeFile(resolve(workAbs, "main.typ"), main, "utf8");

    // 7. typst compile -> PDF on stdout
    const typst = await run(TYPST_BIN, [
      "compile", resolve(workAbs, "main.typ"), "-",
      "--root", SERVICE_ROOT,
      ...(await writeFonts(fonts, workAbs)),
      "--format", "pdf",
      ...(format === "cover" ? ["--pages", "1"] : []),
    ]);
    if (typst.code !== 0) throw parseTypstError(typst.stderr);
    warnings.push(...parseTypstWarnings(typst.stderr));

    const out = typst.stdout;
    return {
      output: out, pdf: out,
      contentType: "application/pdf",
      filename: `${title}${format === "cover" ? "-sampul" : ""}.pdf`,
      meta: { ...baseMeta, pages: pdfPageCount(out), warnings },
    };
  } finally {
    // 8. cleanup workdir (best-effort)
    await rm(workAbs, { recursive: true, force: true }).catch(() => {});
  }
}


