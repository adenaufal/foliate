// Foliate compile service — input sanitize (handoff §3).
// Encoding-level normalization only. Typographic smart-quotes / em-dash are
// delegated to pandoc's `+smart` extension downstream, so we do NOT regex them
// here (regex quote-curling is fragile around code, URLs, contractions).

const ZERO_WIDTH = /[​‌‍﻿]/g; // ZWSP, ZWNJ, ZWJ, BOM (mid-doc)
const NBSP = / /g;

export function sanitizeMarkdown(input) {
  if (typeof input !== "string") {
    throw new TypeError("markdown must be a string");
  }
  let s = input;

  // 1. strip leading UTF-8 BOM
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  // 2. NFC unicode normalization (compose accents → stable, embeddable glyphs)
  s = s.normalize("NFC");

  // 3. normalize line endings CRLF / CR → LF
  s = s.replace(/\r\n?/g, "\n");

  // 4. drop zero-width chars and convert non-breaking spaces to normal spaces
  s = s.replace(ZERO_WIDTH, "").replace(NBSP, " ");

  // 5. strip trailing whitespace on each line (but keep MD hard-break: 2+ spaces
  //    before newline are meaningful, so only trim lines that are all-whitespace
  //    or have a single trailing space)
  s = s.replace(/[ \t]+$/gm, (m) => (m.length >= 2 ? m : ""));

  // 6. collapse 3+ spaces mid-line to a single space (double-space cleanup,
  //    handoff §3) — but never touch indentation (leading spaces) or code.
  //    Conservative: only collapse runs of 3+ spaces that follow a non-space.
  s = s.replace(/(\S)[ ]{3,}(?=\S)/g, "$1 ");

  // 7. collapse 3+ consecutive blank lines to a single blank line
  s = s.replace(/\n{3,}/g, "\n\n");

  // 8. ensure exactly one trailing newline
  s = s.replace(/\n+$/, "") + "\n";

  return s;
}
