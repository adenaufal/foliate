// HTTP smoke: boots the real server on a scratch port and exercises every
// endpoint the app talks to. Complements scripts/smoke.mjs, which stops at the
// pipeline. Run with: npm run smoke:http
import { strict as assert } from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SERVICE_ROOT, PANDOC_BIN } from "../src/config.mjs";

const PORT = Number(process.env.SMOKE_PORT ?? 8724);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = resolve(SERVICE_ROOT, "out");
const SAMPLES = resolve(SERVICE_ROOT, "samples");

const md = await readFile(resolve(SAMPLES, "manuscript.md"), "utf8");
const asset = {
  name: "placeholder-desk.jpg",
  data: (await readFile(resolve(SAMPLES, "placeholder-desk.jpg"))).toString("base64"),
};

// docx fixture, built by pandoc (same one scripts/smoke.mjs writes)
const docxPath = resolve(OUT, "smoke-import.docx");
if (!existsSync(docxPath)) {
  const r = spawnSync(PANDOC_BIN, ["-s", "--from", "markdown", "--to", "docx", "-o", docxPath], {
    input: "---\ntitle: Impor Docx\nauthor: Penguji\n---\n\n# Bab Impor\n\nParagraf dari Word.\n",
  });
  assert.equal(r.status, 0, String(r.stderr));
}
const docxB64 = (await readFile(docxPath)).toString("base64");

const server = spawn(process.execPath, [resolve(SERVICE_ROOT, "src", "server.mjs")], {
  env: { ...process.env, PORT: String(PORT), LOG_LEVEL: "warn" },
  stdio: ["ignore", "inherit", "inherit"],
});

let failed = 0;
async function step(label, fn) {
  const t0 = Date.now();
  try {
    const note = (await fn()) ?? "";
    console.log(`OK    ${label.padEnd(26)} ${String(Date.now() - t0).padStart(5)}ms  ${note}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${label}\n      ${e.message}`);
  }
}
const post = (path, body) => fetch(`${BASE}${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

// wait for listen
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${BASE}/health`)).ok) break;
  } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 200));
}

const mdBody = { markdown: md, template: "literary", trim: "5x8", assets: [asset] };

await step("GET /health", async () => {
  const j = await (await fetch(`${BASE}/health`)).json();
  assert.equal(j.ok, true);
  return j.service;
});

await step("GET /templates", async () => {
  const j = await (await fetch(`${BASE}/templates`)).json();
  assert.ok(j.templates.length >= 3, "template kurang");
  assert.deepEqual(j.formats, ["pdf", "epub", "cover"]);
  return `${j.templates.map((t) => t.id).join(",")} | ${j.formats.join(",")}`;
});

await step("POST /compile md", async () => {
  const r = await post("/compile", mdBody);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.equal(r.headers.get("x-foliate-template"), "literary");
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  return `${buf.length}B pages=${r.headers.get("x-foliate-pages")} warn=${r.headers.get("x-foliate-warnings")}`;
});

await step("POST /compile docx", async () => {
  const r = await post("/compile", { docx: docxB64, template: "literary" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  return `${buf.length}B ${r.headers.get("content-disposition")}`;
});

await step("POST /compile epub", async () => {
  const r = await post("/compile", { ...mdBody, format: "epub" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/epub+zip");
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  return `${buf.length}B ${r.headers.get("content-disposition")}`;
});

await step("POST /compile cover+font", async () => {
  const ttf = (await readFile(resolve(SERVICE_ROOT, "fonts", "SpectralSC-Regular.ttf"))).toString("base64");
  const r = await post("/compile", {
    markdown: md, format: "cover", bodyFont: "Spectral SC",
    fonts: [{ name: "Diunggah-Regular.ttf", data: ttf }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-foliate-pages"), "1");
  assert.equal(r.headers.get("x-foliate-warnings"), "0");
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  return `${buf.length}B 1 halaman, tanpa warning`;
});

await step("POST /metadata (cached)", async () => {
  const j = await (await post("/metadata", mdBody)).json();
  assert.equal(j.cached, true, "harusnya kena cache dari /compile di atas");
  assert.ok(j.pages > 1);
  return `pages=${j.pages} warnings=${j.warnings.length} title=${j.title}`;
});

await step("POST /metadata (fresh)", async () => {
  const j = await (await post("/metadata", { markdown: "# Satu\n\nDua tiga.\n", template: "manuscript" })).json();
  assert.equal(j.cached, false);
  assert.ok(j.pages >= 1);
  return `pages=${j.pages} template=${j.template} format=${j.format}`;
});

await step("400 tanpa markdown/docx", async () => {
  const r = await post("/compile", { template: "literary" });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.equal(j.stage, "request");
  return JSON.stringify(j);
});

await step("422 aset hilang", async () => {
  const r = await post("/compile", { markdown: "# Bab\n\n![x](tidak-ada.jpg)\n" });
  assert.equal(r.status, 422);
  const j = await r.json();
  assert.equal(j.stage, "typst");
  assert.ok(j.hint, "hint kosong");
  return JSON.stringify(j);
});

server.kill();
process.exit(failed ? 1 : 0);
