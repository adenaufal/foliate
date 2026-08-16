// =============================================================================
// Foliate — Template: "Manuscript"
// Half a step slower than `literary`: 24 lines to the page instead of 31, so the
// text block sits in far more white. Old-style figures everywhere, including the
// folios. The foot of the page is empty — folio and running head merge into one
// line in the top outer corner.
// Exports the pipeline interface: `book` + `horizontalrule`.
// =============================================================================

#let ACCENT = rgb("#8A2E2E") // oxblood / proof-red (locked)
#let INK = rgb("#1A1A1A")
#let MUTED = rgb("#6B6862")
#let HAIRLINE = rgb("#E6E2D8")

// Scene break (pandoc `---`). A short centred hairline, not literary's asterism.
#let horizontalrule = {
  v(1.2em)
  align(center, line(length: 15%, stroke: 0.4pt + MUTED))
  v(1.2em)
}

// Margins are per-trim, not one fixed inch recipe: fixed inches hold ~49 chars
// on 5x8 but balloon to ~66 on 6x9. Each row is tuned to 49-56 chars/line.
#let _GEOM = (
  "5x8": (
    width: 5in, height: 8in, size: 11pt,
    margin: (inside: 0.82in, outside: 0.68in, top: 1.05in, bottom: 1.00in),
  ),
  "6x9": (
    width: 6in, height: 9in, size: 11.5pt,
    margin: (inside: 1.10in, outside: 0.85in, top: 1.25in, bottom: 1.15in),
  ),
  "a5": (
    width: 148mm, height: 210mm, size: 11pt,
    margin: (inside: 1.00in, outside: 0.82in, top: 1.15in, bottom: 1.10in),
  ),
)

// Custom trims keep the 5x8 proportions (margins as a share of the page).
#let _geom(trim) = {
  if type(trim) == dictionary and "width" in trim and "height" in trim {
    (
      width: trim.width, height: trim.height, size: 11pt,
      margin: (inside: 16.4%, outside: 13.6%, top: 13.1%, bottom: 12.5%),
    )
  } else if type(trim) == str {
    _GEOM.at(trim, default: _GEOM.at("5x8"))
  } else {
    _GEOM.at("5x8")
  }
}

// Folio + running head on one line in the top outer corner.
// Verso: folio, em-space, book title. Recto: chapter title, em-space, folio.
// Blind on chapter openers and on everything before the first level-1 heading.
#let _topline(book-title, body-font) = context {
  let pageno = here().page()
  let chs = query(heading.where(level: 1))
  let starts = chs.map(c => c.location().page())
  if pageno < starts.at(0, default: 99999) or starts.contains(pageno) { return }
  set text(font: body-font, size: 8.5pt, fill: MUTED, number-type: "old-style")
  let folio = counter(page).display()
  let sc(t) = text(size: 8pt, tracking: 0.1em)[#smallcaps(t)]
  if calc.odd(pageno) {
    let before = chs.filter(c => c.location().page() <= pageno)
    let label = if before.len() > 0 { before.last().body } else { [] }
    align(right)[#sc(label)#h(1em)#folio]
  } else {
    align(left)[#folio#h(1em)#sc(book-title)]
  }
}

// -----------------------------------------------------------------------------
// Main template entry point. `doc` is the manuscript body (pandoc output).
// -----------------------------------------------------------------------------
#let book(
  title: "Untitled",
  subtitle: none,
  author: "Anonymous",
  // trim presets: "5x8", "6x9", "a5", or (width:, height:) for custom
  trim: "5x8",
  toc: true,
  body-font: "Source Serif 4",
  mono-font: "DejaVu Sans Mono",
  doc,
) = {
  let g = _geom(trim)

  set document(title: title, author: author)

  // Source Serif 4 carries real smcp and onum, so no separate SC font file.
  set text(
    font: body-font,
    size: g.size,
    fill: INK,
    lang: "id",
    hyphenate: true,
    number-type: "old-style",
  )
  // leading 0.95em => ~17.8pt baseline-to-baseline at 11pt (1.62x the size)
  set par(
    justify: true,
    leading: 0.95em,
    spacing: 0.95em,
    first-line-indent: (amount: 1.2em, all: false),
    linebreaks: "optimized",
  )

  // --- inline marks ---
  show emph: it => text(style: "italic", it.body)
  show strong: it => text(weight: 600, it.body)
  show link: it => text(fill: ACCENT, it)

  // --- block quote: inset on both sides, roman, no rule, no colour shift ---
  show quote.where(block: true): it => block(
    inset: (left: 2.2em, right: 2.2em),
    width: 100%,
  )[
    #set text(size: 0.92em, fill: INK)
    #set par(first-line-indent: 0pt, leading: 0.9em, justify: true)
    #it.body
  ]

  // --- code: hairline rules above and below, no panel, no radius ---
  show raw.where(block: true): it => block(
    width: 100%,
    breakable: false,
    inset: (left: 1.2em, y: 0.8em),
    stroke: (top: 0.5pt + HAIRLINE, bottom: 0.5pt + HAIRLINE),
  )[
    #set text(font: mono-font, size: 0.82em, fill: INK)
    #set par(justify: false, first-line-indent: 0pt, leading: 0.62em)
    #it
  ]

  // --- lists: en-dash marker; enum numerals inherit the old-style figures ---
  set list(
    marker: text(size: 0.9em, fill: MUTED)[#sym.dash.en],
    indent: 1.2em, body-indent: 0.6em, spacing: 0.55em,
  )
  set enum(indent: 1.2em, body-indent: 0.6em, spacing: 0.55em)

  // --- figure: full measure, caption centred below (lang id => "Gambar") ---
  show figure: set image(width: 100%)
  show figure.caption: it => {
    set text(size: 8.5pt, style: "italic", fill: MUTED)
    it
  }

  // --- sub-headings ---
  show heading.where(level: 2): it => block(above: 1.8em, below: 0.7em)[
    #set text(size: 1.0em, weight: 400, fill: INK, tracking: 0.1em)
    #set par(justify: false, first-line-indent: 0pt)
    #smallcaps(it.body)
  ]
  show heading.where(level: 3): it => block(above: 1.3em, below: 0.5em)[
    #set text(size: 0.95em, weight: 400, style: "italic", fill: MUTED)
    #set par(justify: false, first-line-indent: 0pt)
    #it.body
  ]

  // number level-1 headings only; the counter drives both opener and TOC
  set heading(numbering: (..n) => if n.pos().len() == 1 {
    numbering("1", ..n.pos())
  })

  // --- chapter opener: forced recto, deep sunk, centred, closed by a hairline ---
  show heading.where(level: 1): it => {
    pagebreak(to: "odd", weak: true)
    v(1.6in)
    block(width: 100%)[
      #set align(center)
      #set par(justify: false, first-line-indent: 0pt, leading: 0.4em)
      #text(size: 9.5pt, fill: ACCENT, tracking: 0.22em)[
        #smallcaps[Bab] #counter(heading).display(it.numbering)
      ]
      #v(0.8em)
      #text(size: 1.45em, weight: 400, fill: INK)[#it.body]
      #v(1.1em)
      #line(length: 100%, stroke: 0.4pt + HAIRLINE)
    ]
    v(1.4em)
  }

  // ===========================================================================
  // FRONT MATTER — no folio, no running head
  // ===========================================================================
  set page(
    width: g.width,
    height: g.height,
    margin: g.margin,
    numbering: none,
    header: none,
    footer: none,
  )

  // --- title page ---
  {
    set align(center)
    set par(justify: false, first-line-indent: 0pt)
    v(2.4in)
    text(size: 2.0em, weight: 400, fill: INK)[#title]
    if subtitle != none {
      v(0.7em)
      text(size: 1.0em, style: "italic", fill: MUTED)[#subtitle]
    }
    v(2.2em)
    line(length: 60%, stroke: 0.4pt + HAIRLINE)
    v(1.5em)
    text(size: 1.0em, fill: INK, tracking: 0.14em)[#smallcaps(author)]
  }

  // --- table of contents (clickable; level-1 + level-2) ---
  // Suppressed as a unit — its own recto break included. The front matter stays
  // an even number of pages either way (the body always breaks to the next odd
  // page), so the verso/recto sides of the top line never flip.
  if toc {
    pagebreak(to: "odd", weak: true)
    {
      set align(center)
      set par(justify: false, first-line-indent: 0pt)
      text(size: 1.2em, weight: 400, fill: INK, tracking: 0.12em)[#smallcaps[Daftar Isi]]
    }
    v(1.4em)
    show outline.entry.where(level: 1): it => {
      v(0.6em, weak: true)
      it
    }
    show outline.entry.where(level: 2): it => text(size: 0.92em, fill: MUTED, it)
    outline(title: none, depth: 2, indent: 1.2em)
  }

  // ===========================================================================
  // BODY — folio restarts at 1; running head/folio line switched on
  // ===========================================================================
  pagebreak(to: "odd", weak: true)
  set page(numbering: "1", header: _topline(title, body-font), footer: none)
  counter(page).update(1)

  doc
}
