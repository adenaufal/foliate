// Foliate M0 spike — Path B: custom MD -> Typst mapper (no pandoc dependency).
// Line-based block parser + inline formatter. Predictable, auditable output.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", ".."); // project root (foliate/)

// --- frontmatter (simple key: value) ---
export function frontmatter(src) {
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

// --- escape text that is NOT markup we control (Typst special chars) ---
function escapeText(s) {
  return s.replace(/([#*_`$\\<>@\[\]])/g, "\\$1");
}

// relative image paths resolve to /samples in the spike sandbox
function normPath(p) {
  if (/^(\/|https?:)/.test(p)) return p;
  return "/samples/" + p;
}

// --- inline: tokenize MD spans, emit Typst, escaping only plain text ---
// Precedence: code > image > link > bold > italic.
export function inline(s) {
  const out = [];
  const re = /(`[^`]+`)|(!\[[^\]]*\]\([^)]+\))|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\n]+\*|(?<!\w)_[^_\n]+_(?!\w))/;
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const m = rest.match(re);
    if (!m) { out.push(escapeText(rest)); break; }
    if (m.index > 0) out.push(escapeText(rest.slice(0, m.index)));
    const tok = m[0];
    if (m[1]) out.push("`" + tok.slice(1, -1) + "`");
    else if (m[2]) {
      const im = tok.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      out.push(`#box(image("${normPath(im[2])}", alt: "${im[1].replace(/"/g, "")}"))`);
    } else if (m[3]) {
      const lk = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      out.push(`#link("${lk[2]}")[${escapeText(lk[1])}]`);
    } else if (m[4]) out.push(`#strong[${escapeText(tok.replace(/^(\*\*|__)|(\*\*|__)$/g, ""))}]`);
    else if (m[5]) out.push(`#emph[${escapeText(tok.replace(/^[*_]|[*_]$/g, ""))}]`);
    i += m.index + tok.length;
  }
  return out.join("");
}

// --- block parser: MD lines -> Typst block markup ---
export function mdToTypst(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const flushPara = (buf) => {
    if (buf.length) out.push(inline(buf.join(" ").trim()) + "\n");
  };
  while (i < lines.length) {
    let line = lines[i];

    // fenced code block
    if (/^```/.test(line)) {
      const fence = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { fence.push(lines[i]); i++; }
      i++; // closing fence
      out.push("#raw-block(```\n" + fence.join("\n") + "\n```)\n");
      continue;
    }
    // ATX heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push("=".repeat(h[1].length) + " " + inline(h[2].trim()) + "\n");
      i++;
      continue;
    }
    // thematic break / scene break
    if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line.trim())) {
      out.push("#horizontalrule\n");
      i++;
      continue;
    }
    // blockquote (collect consecutive > lines)
    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^>\s?/, "")); i++;
      }
      out.push('#quote(block: true)[' + inline(q.join(" ").trim()) + "]\n");
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*\d+\.\s+/, "").trim())); i++;
      }
      out.push(items.map((t) => "+ " + t).join("\n") + "\n");
      continue;
    }
    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*[-*+]\s+/, "").trim())); i++;
      }
      out.push(items.map((t) => "- " + t).join("\n") + "\n");
      continue;
    }
    // blank line
    if (line.trim() === "") { i++; continue; }
    // paragraph (collect until blank / block start)
    const para = [];
    while (
      i < lines.length && lines[i].trim() !== "" &&
      !/^(#{1,6}\s|>\s?|```|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i]) &&
      !/^(\*\s*){3,}$|^(-\s*){3,}$/.test(lines[i].trim())
    ) { para.push(lines[i]); i++; }
    flushPara(para);
  }
  return out.join("\n");
}

// --- CLI: read sample, build main.typ ---
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("mapper.mjs")) {
  const raw = readFileSync(resolve(ROOT, "compile-service", "samples", "manuscript.md"), "utf8");
  const { meta, body } = frontmatter(raw);
  const typstBody = mdToTypst(body);
  const esc = (s) => (s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const opt = (v) => (v ? `"${esc(v)}"` : "none");
  const main = `#import "../../templates/literary.typ": book, horizontalrule
#let raw-block(c) = c
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
}

