// Foliate M0 spike — Path A: pandoc --to typst
// Extract frontmatter, run pandoc for the body, assemble main.typ, compile.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", ".."); // project root (foliate/)
const PANDOC = "C:\\Users\\langk\\AppData\\Local\\Pandoc\\pandoc.exe";

const mdPath = resolve(ROOT, "compile-service", "samples", "manuscript.md");
const raw = readFileSync(mdPath, "utf8");

// --- extract YAML frontmatter (simple: key: value pairs) ---
function frontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  let body = src;
  if (m) {
    body = src.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return { meta, body };
}

const { meta, body } = frontmatter(raw);

// --- pandoc: markdown body -> typst markup (strip frontmatter first) ---
const typstBody = execFileSync(
  PANDOC,
  ["--from", "markdown", "--to", "typst", "--wrap=preserve"],
  { input: body, encoding: "utf8" }
).replace(
  // rewrite relative image refs -> root-absolute typst path under /samples
  /image\("(?!\/|https?:)([^"]+)"/g,
  'image("/samples/$1"'
);

// --- escape for typst string literal ---
const esc = (s) => (s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const opt = (v) => (v ? `"${esc(v)}"` : "none");

const main = `#import "../../templates/literary.typ": book, horizontalrule
#show: book.with(
  title: "${esc(meta.title) || "Untitled"}",
  subtitle: ${opt(meta.subtitle)},
  author: "${esc(meta.author) || "Anonymous"}",
  trim: "5x8",
)

${typstBody}`;

const outMain = resolve(__dir, "main.typ");
writeFileSync(outMain, main, "utf8");
console.log("Wrote", outMain, `(${main.length} bytes)`);
console.log("Title:", meta.title, "| Author:", meta.author);
