// The manuscript's own structure, read off the Markdown: `#` is a chapter,
// `##` a section. The outline panel lists them, the editor header names the
// one under the caret, and the stats line counts the words. Pure functions,
// no React — the shell memoises them against the markdown string.
//
// Self-check (pure):
//   import("@/lib/outline").then(m => console.log(m.selfCheckOutline()))

export interface Heading {
  level: 1 | 2;
  title: string;
  /** 1-based line of the heading in the manuscript. */
  line: number;
  /** Character offset of the heading's first character. */
  offset: number;
  /** Prose words from the line after this heading to the next heading of the
   *  same or higher level. */
  words: number;
}

const FENCE = /^(```|~~~)/;
const ATX = /^(#{1,2})\s+(.+?)\s*#*\s*$/;
/** A token is a word when it carries a letter or a digit: `##`, `---`, `>`
 *  and a lone `*` are marks, not prose. */
const WORD = /[\p{L}\p{N}]/u;

/** Front matter is the block between a `---` first line and the next `---`.
 *  Returns the number of lines it occupies, 0 if there is none. */
function frontMatterLines(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return i + 1;
  }
  return 0;
}

/** Which lines sit inside a fenced code block, the fences themselves included. */
function fencedLines(lines: string[], start: number): boolean[] {
  const out = new Array<boolean>(lines.length).fill(false);
  let fenced = false;
  for (let i = start; i < lines.length; i++) {
    if (FENCE.test(lines[i].trimStart())) {
      fenced = !fenced;
      out[i] = true;
    } else out[i] = fenced;
  }
  return out;
}

function wordsInLine(line: string): number {
  let n = 0;
  for (const tok of line.split(/\s+/)) if (WORD.test(tok)) n++;
  return n;
}

/** Prose words in `lines[from, to)`: code blocks skipped, marks dropped. */
function wordsInRange(lines: string[], fenced: boolean[], from: number, to: number): number {
  let n = 0;
  for (let i = from; i < to; i++) if (!fenced[i]) n += wordsInLine(lines[i]);
  return n;
}

/** Prose words in a run of Markdown: what a writer means by a word count. */
export function countWords(text: string): number {
  const lines = text.split("\n");
  return wordsInRange(lines, fencedLines(lines, 0), 0, lines.length);
}

/** Word count of the manuscript body — front matter excluded. */
export function wordCount(markdown: string): number {
  const lines = markdown.split("\n");
  const start = frontMatterLines(lines);
  return wordsInRange(lines, fencedLines(lines, start), start, lines.length);
}

export function parseOutline(markdown: string): Heading[] {
  const lines = markdown.split("\n");
  const start = frontMatterLines(lines);
  const fenced = fencedLines(lines, start);
  const found: Omit<Heading, "words">[] = [];
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (i >= start && !fenced[i]) {
      const m = ATX.exec(raw);
      if (m) found.push({ level: m[1].length as 1 | 2, title: m[2], line: i + 1, offset });
    }
    offset += raw.length + 1;
  }

  // Words run from the line after a heading to the next heading at its level
  // or above — the heading's own title is not its prose.
  return found.map((h, i) => {
    let end = lines.length;
    for (let j = i + 1; j < found.length; j++) {
      if (found[j].level <= h.level) {
        end = found[j].line - 1;
        break;
      }
    }
    return { ...h, words: wordsInRange(lines, fenced, h.line, end) };
  });
}

/** Index (into `headings`) of the chapter the given line is in, or -1 before
 *  the first chapter. */
export function chapterAt(headings: Heading[], line: number): number {
  let idx = -1;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].level === 1 && headings[i].line <= line) idx = i;
  }
  return idx;
}

/** 1-based chapter number of a level-1 heading, counting level-1s before it. */
export function chapterNumber(headings: Heading[], index: number): number {
  let n = 0;
  for (let i = 0; i <= index && i < headings.length; i++) if (headings[i].level === 1) n++;
  return n;
}

/** Strips a numbering prefix (`1 `, `1.2 `, `Bab 1 `) so a PDF outline entry
 *  and a Markdown heading compare by their words. */
export function normalizeTitle(title: string): string {
  return title
    .replace(/^\s*(bab\s+)?\d+(\.\d+)*\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Silent reading at ~200 words a minute, the figure most readers settle on. */
export function readingMinutes(words: number): number {
  return Math.round(words / 200);
}

/** "±3 j" past the hour, "±12 mnt" under it. */
export function formatReadingTime(minutes: number): string {
  if (minutes >= 60) return `±${Math.round(minutes / 60)} j`;
  return `±${Math.max(1, minutes)} mnt`;
}

/** 38412 → "38.412" (id-ID grouping). */
export function formatInt(n: number): string {
  return n.toLocaleString("id-ID");
}

// --- self-check --------------------------------------------------------------

function ok(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`outline self-check: ${msg}`);
}

export function selfCheckOutline(): string {
  const md = [
    "---",
    "title: Senja",
    "---",
    "",
    "# Mula Kata",
    "",
    "Satu dua tiga.",
    "",
    "## Kenapa pelan",
    "",
    "Empat lima.",
    "",
    "```",
    "# bukan judul",
    "```",
    "",
    "# Pagi",
    "",
    "Enam.",
  ].join("\n");

  const h = parseOutline(md);
  ok(h.length === 3, `three headings, got ${h.length}`);
  ok(h[0].level === 1 && h[0].title === "Mula Kata" && h[0].line === 5, "first chapter at line 5");
  ok(h[1].level === 2 && h[1].title === "Kenapa pelan" && h[1].line === 9, "section at line 9");
  ok(h[2].title === "Pagi" && h[2].line === 17, "a heading inside a fence is not a heading");
  ok(h[0].words === 7, `chapter words run to the next chapter, section title in, code out: expected 7, got ${h[0].words}`);
  ok(h[1].words === 2, `section words run to the next heading: expected 2, got ${h[1].words}`);
  ok(h[2].words === 1, "last chapter runs to the end");
  ok(md.slice(h[0].offset, h[0].offset + 11) === "# Mula Kata", "offset points at the heading");

  ok(wordCount(md) === 11, `front matter, marks and code are not prose: expected 11, got ${wordCount(md)}`);
  ok(countWords("> *Waktu* yang tepat --- tidak") === 4, "marks are dropped, emphasised words kept");
  ok(chapterAt(h, 1) === -1 && chapterAt(h, 5) === 0 && chapterAt(h, 12) === 0 && chapterAt(h, 18) === 2, "chapterAt finds the enclosing chapter");
  ok(chapterNumber(h, 2) === 2 && chapterNumber(h, 1) === 1, "chapter numbers count level-1s only");
  ok(normalizeTitle("1 Mula Kata") === "mula kata" && normalizeTitle("Bab 2  Pagi ") === "pagi", "numbering prefixes are stripped");
  ok(normalizeTitle("1984") === "1984", "a numeric title is left alone");
  ok(formatReadingTime(readingMinutes(38412)) === "±3 j" && formatReadingTime(12) === "±12 mnt", "reading time formats");
  ok(formatInt(38412) === "38.412", "id-ID grouping");
  ok(parseOutline("").length === 0 && wordCount("") === 0, "empty manuscript");

  return "outline self-check: ok";
}
