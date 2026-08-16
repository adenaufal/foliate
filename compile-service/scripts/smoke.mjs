// Smoke test: exercise the pipeline directly (no HTTP) against the sample.
// Covers the original markdown -> PDF contract plus the phase-2 paths:
// every registered template, docx in, epub out, cover, uploaded font, warnings.
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compile } from "../src/pipeline.mjs";
import { SERVICE_ROOT, PANDOC_BIN } from "../src/config.mjs";
import { TEMPLATES, resolveTemplate } from "../src/registry.mjs";

const OUT = resolve(SERVICE_ROOT, "out");
const SAMPLES = resolve(SERVICE_ROOT, "samples");
const md = await readFile(resolve(SAMPLES, "manuscript.md"), "utf8");
// reference the real jpg asset and inline its bytes as a base64 asset
const imgB64 = (await readFile(resolve(SAMPLES, "placeholder-desk.jpg"))).toString("base64");
const asset = { name: "placeholder-desk.jpg", data: imgB64 };

let failed = 0;
async function step(label, fn) {
  const t0 = Date.now();
  try {
    const note = (await fn()) ?? "";
    console.log(`OK    ${label.padEnd(26)} ${String(Date.now() - t0).padStart(5)}ms  ${note}`);
  } catch (e) {
    failed++;
    const j = e.toJSON ? e.toJSON() : { message: e.message };
    console.error(`FAIL  ${label}\n      ${JSON.stringify(j)}`);
  }
}
const isPdf = (b) => b.subarray(0, 5).toString("latin1") === "%PDF-";
const warnNote = (m) => (m.warnings.length ? `warn=${m.warnings.length} ${JSON.stringify(m.warnings[0].message)}` : "warn=0");

// --- 1. every registered template, markdown -> PDF (the original contract) ---
for (const id of Object.keys(TEMPLATES)) {
  if (!resolveTemplate(id).exists) {
    console.log(`SKIP  ${id.padEnd(26)}        templates/${TEMPLATES[id].file} belum ada`);
    continue;
  }
  await step(`pdf ${id}`, async () => {
    const { output, meta } = await compile({ markdown: md, template: id, trim: "5x8", assets: [asset] });
    assert.ok(isPdf(output), "bukan PDF");
    assert.ok(meta.pages > 1, `page count mencurigakan: ${meta.pages}`);
    await writeFile(resolve(OUT, `smoke-${id}.pdf`), output);
    return `${output.length}B ${meta.pages}p  ${warnNote(meta)}`;
  });
}

// --- 1b. the toc toggle, both states, every template ---
// A suppressed TOC must remove exactly its own pages and nothing else: the two
// recto-breaking templates drop the TOC leaf plus its blank verso, contemporary
// (which breaks to the next page, not to a recto) drops the leaf only. Any other
// delta means a stray break or a lost blank was left behind.
const TOC_PAGES = { literary: 2, manuscript: 2, contemporary: 1 };
for (const id of Object.keys(TEMPLATES)) {
  if (!resolveTemplate(id).exists) continue;
  await step(`toc toggle ${id}`, async () => {
    const req = { markdown: md, template: id, trim: "5x8", assets: [asset] };
    const on = await compile({ ...req, toc: true });
    const off = await compile({ ...req, toc: false });
    assert.equal(
      on.meta.pages - off.meta.pages, TOC_PAGES[id],
      `delta halaman ${on.meta.pages}->${off.meta.pages} bukan ${TOC_PAGES[id]}`,
    );
    // default must stay "with TOC" so callers predating the flag are unaffected
    const dflt = await compile(req);
    assert.equal(dflt.meta.pages, on.meta.pages, "default bukan toc: true");
    await writeFile(resolve(OUT, `smoke-${id}-tanpa-toc.pdf`), off.output);
    return `${on.meta.pages}p -> ${off.meta.pages}p`;
  });
}
await step("toc toggle epub", async () => {
  const req = { markdown: md, format: "epub" };
  const on = await compile({ ...req, toc: true });
  const off = await compile({ ...req, toc: false });
  // --toc adds nav.xhtml to the spine; the nav document itself is mandatory
  // either way, so the container differing is the observable signal here.
  assert.ok(!on.output.equals(off.output), "epub identik: --toc tidak sampai ke pandoc");
  return `${on.output.length}B vs ${off.output.length}B`;
});

// --- 2. docx in (fixture built by pandoc itself, image included) ---
const docxPath = resolve(OUT, "smoke-import.docx");
await step("build docx fixture", () => {
  const src = `---\ntitle: Impor Docx\nauthor: Penguji\n---\n\n# Bab Impor\n\nParagraf dari Word, dengan *miring* dan **tebal**.\n\n![Meja kerja](placeholder-desk.jpg)\n\n# Bab Kedua\n\nCukup pendek.\n`;
  const r = spawnSync(PANDOC_BIN, [
    "-s", "--from", "markdown", "--to", "docx", `--resource-path=${SAMPLES}`, "-o", docxPath,
  ], { input: src });
  assert.equal(r.status, 0, String(r.stderr));
  return docxPath;
});
await step("docx -> pdf", async () => {
  const { output, meta } = await compile({
    docx: (await readFile(docxPath)).toString("base64"),
    template: "literary", trim: "5x8",
  });
  assert.ok(isPdf(output), "bukan PDF");
  // the embedded image must have landed in the asset dir; typst would have
  // failed with "file not found" otherwise
  assert.equal(meta.title, "Impor Docx", `metadata docx hilang: ${meta.title}`);
  await writeFile(resolve(OUT, "smoke-docx.pdf"), output);
  return `${output.length}B ${meta.pages}p  title=${meta.title}`;
});

// --- 3. epub out ---
await step("epub", async () => {
  const { output, contentType, filename, meta } = await compile({
    markdown: md, format: "epub", assets: [asset],
  });
  assert.equal(contentType, "application/epub+zip");
  assert.equal(output.subarray(0, 2).toString("latin1"), "PK", "bukan zip");
  assert.ok(output.subarray(0, 60).toString("latin1").includes("application/epub+zip"), "mimetype epub hilang");
  assert.ok(filename.endsWith(".epub"));
  await writeFile(resolve(OUT, "smoke.epub"), output);
  return `${output.length}B  ${filename}`;
});

// --- 4. cover (title page only) ---
await step("cover", async () => {
  const { output, meta } = await compile({ markdown: md, format: "cover" });
  assert.ok(isPdf(output), "bukan PDF");
  assert.equal(meta.pages, 1, `sampul harus 1 halaman, dapat ${meta.pages}`);
  await writeFile(resolve(OUT, "smoke-cover.pdf"), output);
  return `${output.length}B ${meta.pages}p`;
});

// --- 5. uploaded font reachable by the template ---
await step("uploaded font", async () => {
  const ttf = await readFile(resolve(SERVICE_ROOT, "fonts", "SpectralSC-Regular.ttf"));
  const { output, meta } = await compile({
    markdown: md, format: "cover", bodyFont: "Spectral SC",
    fonts: [{ name: "Diunggah-Regular.ttf", data: ttf.toString("base64") }],
  });
  assert.ok(isPdf(output));
  assert.equal(meta.warnings.length, 0, `font terunggah tidak terpakai: ${JSON.stringify(meta.warnings)}`);
  return `${output.length}B  ${warnNote(meta)}`;
});

// --- 6. an unknown family degrades to a warning, not a crash ---
await step("warning plumbing", async () => {
  const { meta } = await compile({ markdown: md, format: "cover", bodyFont: "Font Yang Tidak Ada" });
  assert.ok(meta.warnings.length > 0, "typst tidak memberi warning untuk font tak dikenal");
  return warnNote(meta);
});

// --- 7. bad font upload is rejected before typst runs ---
await step("reject non-font upload", async () => {
  await assert.rejects(
    () => compile({ markdown: md, format: "cover", fonts: [{ name: "evil.exe", data: "AAAA" }] }),
    (e) => e.stage === "assemble" && /tidak didukung/.test(e.message),
  );
  return "ditolak";
});

process.exit(failed ? 1 : 0);
