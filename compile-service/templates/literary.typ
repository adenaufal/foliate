// =============================================================================
// Foliate — Template: "Literary"
// A publisher-grade book layout for digital-first ebooks.
// Imported by both pipeline paths (pandoc body + custom mapper).
// Parametric: trim size, margins, fonts, metadata.
// =============================================================================

#let BRAND_NAME = "Foliate"
#let ACCENT = rgb("#8A2E2E") // oxblood / proof-red (locked)
#let INK = rgb("#1A1A1A")
#let MUTED = rgb("#6B6862")

// Scene break (pandoc `---` / thematic break). A centered asterism, not a line.
#let horizontalrule = {
  v(0.6em)
  align(center)[
    #text(fill: MUTED, size: 1.1em, tracking: 0.6em)[\*\*\*]
  ]
  v(0.6em)
}

// Running head: verso = book title, recto = current chapter title.
// Suppressed on front matter and on chapter-opener pages.
#let _runhead(book-title, display-font) = context {
  let pageno = here().page()
  let chs = query(heading.where(level: 1))
  let starts = chs.map(c => c.location().page())
  // before the first chapter (title page, TOC): no running head
  let first = starts.at(0, default: 99999)
  if pageno < first { return }
  // chapter opener page: no running head
  if starts.contains(pageno) { return }
  set text(font: display-font, size: 8pt, fill: MUTED, tracking: 0.08em)
  if calc.odd(pageno) {
    let before = chs.filter(c => c.location().page() <= pageno)
    let label = if before.len() > 0 { upper(before.last().body) } else { [] }
    align(right)[#label]
  } else {
    align(left)[#upper(book-title)]
  }
}

// -----------------------------------------------------------------------------
// Main template entry point.
// `doc` is the manuscript body (from pandoc or the custom mapper).
// -----------------------------------------------------------------------------
#let book(
  title: "Untitled",
  subtitle: none,
  author: "Anonymous",
  // trim presets: "5x8", "6x9", "a5", or (width, height) in inches/cm
  trim: "5x8",
  toc: true,
  body-font: "Spectral",
  display-font: "Spectral",
  // small-caps cut used for chapter labels, running heads, colophon
  label-font: "Spectral SC",
  body-size: 10.5pt,
  doc,
) = {
  // --- resolve trim size -> page dimensions ---
  // The pipeline sends a preset string or a custom (width:, height:) dict;
  // dict.at() only takes string keys, so branch on the type first.
  let dims = if type(trim) == dictionary and "width" in trim and "height" in trim {
    trim
  } else if type(trim) == str {
    (
      "5x8": (width: 5in, height: 8in),
      "6x9": (width: 6in, height: 9in),
      "a5": (width: 148mm, height: 210mm),
    ).at(trim, default: (width: 5in, height: 8in))
  } else {
    (width: 5in, height: 8in)
  }

  set document(title: title, author: author)

  // --- page geometry: asymmetric margins (inner < outer), book-like ---
  set page(
    width: dims.width,
    height: dims.height,
    margin: (
      inside: 0.85in,
      outside: 0.7in,
      top: 0.85in,
      bottom: 0.8in,
    ),
    numbering: "1",
    number-align: center + bottom,
    header: _runhead(title, display-font),
    footer: context {
      let pageno = here().page()
      let chs = query(heading.where(level: 1))
      let starts = chs.map(c => c.location().page())
      let first = starts.at(0, default: 99999)
      // folio only inside the body (not on front matter / chapter openers)
      if pageno < first or starts.contains(pageno) {
        // chapter opener: folio still shown, centered, understated
        if starts.contains(pageno) {
          set text(font: body-font, size: 9pt, fill: MUTED)
          align(center)[#counter(page).display()]
        }
        return
      }
      set text(font: body-font, size: 9pt, fill: MUTED)
      align(center)[#counter(page).display()]
    },
  )

  // --- body typography: justified, generous leading, ligatures on ---
  set text(
    font: body-font,
    size: body-size,
    fill: INK,
    lang: "id",
    hyphenate: true,
  )
  set par(
    justify: true,
    leading: 0.72em,
    spacing: 0.72em,
    first-line-indent: (amount: 1.4em, all: false),
    linebreaks: "optimized",
  )

  // widow/orphan control + keep headings with following text
  set par(justify: true)

  // --- inline marks ---
  show emph: it => text(style: "italic", it.body)
  show strong: it => text(weight: 600, it.body)

  // links: subtle oxblood, no underline (used by clickable TOC + cross-refs)
  show link: it => text(fill: ACCENT, it)

  // --- block quote: indented, ranging left rule, slightly smaller ---
  show quote.where(block: true): it => block(
    inset: (left: 1.4em, right: 1.0em),
    width: 100%,
  )[
    #set text(size: 0.95em, fill: MUTED.darken(15%))
    #set par(first-line-indent: 0pt)
    #it.body
  ]

  // --- code: mono, tinted panel, no justify ---
  show raw.where(block: true): it => block(
    fill: rgb("#F4F2EC"),
    inset: (x: 1em, y: 0.8em),
    radius: 3pt,
    width: 100%,
    breakable: false,
  )[
    #set text(font: "DejaVu Sans Mono", size: 0.85em, fill: INK)
    #set par(justify: false, first-line-indent: 0pt, leading: 0.6em)
    #it
  ]

  // --- lists: tighter, hanging indent ---
  set list(indent: 0.6em, body-indent: 0.5em, spacing: 0.72em)
  set enum(indent: 0.6em, body-indent: 0.5em, spacing: 0.72em)

  // --- sub-headings (## , ###): display font, no number ---
  show heading.where(level: 2): it => {
    set text(font: display-font, size: 1.05em, weight: 600, fill: INK)
    block(above: 1.5em, below: 0.7em)[#it.body]
  }
  show heading.where(level: 3): it => {
    set text(font: display-font, size: 0.95em, weight: 500, style: "italic", fill: MUTED.darken(20%))
    block(above: 1.2em, below: 0.55em)[#it.body]
  }

  // first paragraph after any heading: no indent (publisher convention)
  show heading: it => it
  set heading(numbering: none)

  // --- chapter opener (level-1 `#`): new recto page, sunk head, numbered ---
  show heading.where(level: 1): it => {
    pagebreak(to: "odd", weak: true)
    counter("chapter").step()
    v(2.2in - 0.85in) // sink the chapter head ~down the page
    block(width: 100%)[
      #set align(left)
      #set par(justify: false, first-line-indent: 0pt, leading: 0.3em)
      #context {
        let n = counter("chapter").get().first()
        text(font: label-font, size: 10pt, fill: ACCENT, tracking: 0.18em)[Bab #n]
      }
      #v(0.5em)
      #text(font: display-font, size: 1.9em, weight: 400, fill: INK)[#it.body]
      #v(0.45em)
      #line(length: 2.2em, stroke: 1pt + ACCENT)
    ]
    v(1.2em)
  }

  // ===========================================================================
  // FRONT MATTER
  // ===========================================================================

  // --- Title page (no folio, no running head) ---
  // Scoped: the page set rule must not leak past the front matter, or the body
  // inherits header: none / footer: none and loses its folios entirely.
  {
  set page(numbering: none, header: none, footer: none)
  v(1.6in)
  align(center)[
    #text(font: display-font, size: 2.4em, weight: 400, fill: INK)[#title]
    #if subtitle != none {
      v(0.6em)
      text(font: display-font, size: 1.05em, style: "italic", fill: MUTED)[#subtitle]
    }
    #v(2.2em)
    #line(length: 18%, stroke: 0.6pt + ACCENT)
    #v(2.2em)
    #text(font: body-font, size: 1.05em, fill: INK, tracking: 0.04em)[#upper[#author]]
  ]
  // Colophon at the foot of the title page (print-craft marginalia)
  place(bottom + center, dy: -0.2in)[
    #text(font: label-font, size: 8.5pt, fill: MUTED, tracking: 0.12em)[
      Disusun dengan #BRAND_NAME
    ]
  ]

  // --- Table of contents (clickable; level-1 + level-2) ---
  // Suppressed as a unit — its own recto break included — so nothing is left
  // behind. The front matter stays an even number of pages either way (the
  // body always breaks to the next odd page), so recto/verso never flips.
  if toc {
    pagebreak(to: "odd", weak: true)
    set page(numbering: none)
    text(font: display-font, size: 1.4em, weight: 400, fill: INK)[Daftar Isi]
    v(1.2em)
    // restart visible page numbering at the body via roman? keep simple: arabic from body
    outline(
      title: none,
      depth: 2,
      indent: 1.2em,
    )
  }
  } // end front matter scope

  // ===========================================================================
  // BODY
  // ===========================================================================
  // restart folio at 1 for the body (front matter unnumbered)
  pagebreak(to: "odd", weak: true)
  counter(page).update(1)
  counter("chapter").update(0)

  // TOC entry styling: chapters bold-ish display font, sub-entries muted
  show outline.entry.where(level: 1): it => {
    set text(font: display-font, size: 1.0em, fill: INK)
    v(0.6em, weak: true)
    it
  }
  show outline.entry.where(level: 2): it => {
    set text(font: body-font, size: 0.92em, fill: MUTED)
    it
  }

  doc
}


