// Foliate compile service — HTTP server (Fastify).
import { createHash } from "node:crypto";
import Fastify from "fastify";
import { compile, FORMATS } from "./pipeline.mjs";
import { CompileError } from "./errors.mjs";
import { TEMPLATES, TRIM_PRESETS, DEFAULT_TEMPLATE, DEFAULT_TRIM } from "./registry.mjs";
import {
  BRAND_NAME, PORT, MAX_MARKDOWN_BYTES, MAX_UPLOAD_BYTES, TYPST_BIN, PANDOC_BIN,
} from "./config.mjs";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  bodyLimit: MAX_MARKDOWN_BYTES + MAX_UPLOAD_BYTES, // markdown + base64 docx/assets/fonts
});

// --- GET /health — liveness for Railway/Fly ---
app.get("/health", async () => ({
  ok: true,
  service: `${BRAND_NAME} compile`,
  typst: TYPST_BIN,
  pandoc: PANDOC_BIN,
}));

// --- GET /templates — registry for the app's template switcher ---
app.get("/templates", async () => ({
  templates: Object.values(TEMPLATES).map((t) => ({
    id: t.id, label: t.label, blurb: t.blurb, bodyFont: t.bodyFont,
  })),
  trims: Object.entries(TRIM_PRESETS).map(([id, t]) => ({ id, label: t.label })),
  formats: FORMATS,
  defaults: { template: DEFAULT_TEMPLATE, trim: DEFAULT_TRIM, format: "pdf" },
}));

// --- POST /compile — markdown or docx -> PDF | EPUB | cover ---
const base64Item = {
  type: "object",
  required: ["name", "data"],
  properties: { name: { type: "string" }, data: { type: "string" } },
};

const compileSchema = {
  body: {
    type: "object",
    anyOf: [{ required: ["markdown"] }, { required: ["docx"] }],
    properties: {
      markdown: { type: "string", minLength: 1, maxLength: MAX_MARKDOWN_BYTES },
      docx: { type: "string", minLength: 1, maxLength: MAX_UPLOAD_BYTES }, // base64
      format: { type: "string", enum: FORMATS },
      template: { type: "string" },
      trim: {}, // string preset OR {width,height,unit} — validated in registry
      bodyFont: { type: "string", maxLength: 64 },
      toc: { type: "boolean", default: true }, // default keeps pre-toggle callers unchanged
      metadata: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          subtitle: { type: "string" },
        },
      },
      assets: { type: "array", maxItems: 50, items: base64Item },
      fonts: { type: "array", maxItems: 12, items: base64Item },
    },
  },
};

// Last few compiles, so /metadata right after /compile is free rather than a
// second full run. ponytail: in-process Map, per-instance — move to a shared
// cache only if the service ever runs more than one replica.
const metaCache = new Map();
const cacheKey = (body) => createHash("sha1").update(JSON.stringify(body)).digest("hex");
function remember(key, meta) {
  metaCache.set(key, meta);
  if (metaCache.size > 8) metaCache.delete(metaCache.keys().next().value);
}

function sendCompileError(e, req, reply) {
  if (e instanceof CompileError) {
    req.log.warn({ stage: e.stage, line: e.line }, e.message);
    return reply.code(422).send(e.toJSON());
  }
  req.log.error(e);
  return reply.code(500).send({ error: true, stage: "internal", message: "Kesalahan tak terduga saat compile." });
}

app.post("/compile", { schema: compileSchema }, async (req, reply) => {
  try {
    const { output, contentType, filename, meta } = await compile(req.body);
    remember(cacheKey(req.body), meta);
    // PDF stays inline (the preview renders it); EPUB has nothing to render.
    const disposition = meta.format === "epub" ? "attachment" : "inline";
    reply
      .header("content-type", contentType)
      .header("content-disposition", `${disposition}; filename="${encodeURIComponent(filename)}"`)
      .header("x-foliate-template", meta.template)
      .header("x-foliate-warnings", String(meta.warnings.length));
    if (meta.pages) reply.header("x-foliate-pages", String(meta.pages));
    reply.send(output);
  } catch (e) {
    return sendCompileError(e, req, reply);
  }
});

// --- POST /metadata — same body as /compile, JSON only (page count + warnings) ---
app.post("/metadata", { schema: compileSchema }, async (req, reply) => {
  try {
    const key = cacheKey(req.body);
    const hit = metaCache.get(key);
    if (hit) return { ...hit, cached: true };
    const { meta } = await compile(req.body);
    remember(key, meta);
    return { ...meta, cached: false };
  } catch (e) {
    return sendCompileError(e, req, reply);
  }
});

// Surface schema-validation failures as structured 400s (not raw Ajv text).
app.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    return reply.code(400).send({
      error: true, stage: "request",
      message: "Permintaan tidak valid.",
      detail: err.message,
    });
  }
  req.log.error(err);
  reply.code(500).send({ error: true, stage: "internal", message: "Kesalahan server." });
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();

