// =============================================================================
// Foliate — Template: "Contemporary"
// Block paragraphs (blank line between, zero indent) where literary and
// manuscript both indent. Libre Baskerville for the body, Barlow for every
// heading and all page furniture — two voices instead of one serif. Chapters
// break to the next page, not to a recto. Header empty; sans running foot.
// Exports the pipeline interface: `book` + `horizontalrule`.
// =============================================================================

#let ACCENT = rgb("#8A2E2E") // oxblood / proof-red (locked)
#let INK = rgb("#1A1A1A")
#let MUTED = rgb("#6B6862")
#let HAIRLINE = rgb("#E6E2D8")

// Scene break (pandoc `---`). A flush-left oxblood bar, not a centred asterism.
#let horizontalrule = {
  v(1.1em)
  align(left, line(length: 2.5em, stroke: 2pt + ACCENT))
  v(1.1em)
}

// Tightest measure of the three: 48-53 chars/line. Typst 0.14 ships no
// Indonesian hyphenation patterns, so justification has only word spacing to
// work with — going narrower than 48 chars opens rivers.
#let _GEOM = (
  "5x8": (
    width: 5in, height: 8in, size: 9.5pt,
    margin: (inside: 0.88in, outside: 0.72in, top: 0.70in, bottom: 0.78in),
  ),
  "6x9": (
    width: 6in, height: 9in, size: 10pt,
    margin: (inside: 1.15in, outside: 0.95in, top: 0.85in, bottom: 0.92in),
  ),
  "a5": (
    width: 148mm, height: 210mm, size: 9.5pt,
    margin: (inside: 1.15in, outside: 0.95in, top: 0.78in, bottom: 0.85in),
  ),
)

// Custom trims keep the 5x8 proportions. Libre Baskerville averages ~0.537em
// per character, so 48 chars needs measure >= 25.8 * size; shrink the type on a
// narrow page rather than let the measure fall through the floor.
#let _geom(trim) = {
  if type(trim) == dictionary and "width" in trim and "height" in trim {
    let measure = trim.width * 0.68
    (
      width: trim.width, height: trim.height,
      size: calc.min(9.5pt, measure / 25.8),
      margin: (inside: 17.6%, outside: 14.4%, top: 8.75%, bottom: 9.75%),
    )
  } else if type(trim) == str {
    _GEOM.at(trim, default: _GEOM.at("5x8"))
  } else {
    _GEOM.at("5x8")
  }
}

// Running foot sharing the folio's baseline: folio at the outer edge, book
// title (verso) / chapter title (recto) against the inner margin. The folio
// stays on chapter openers; only the running foot is suppressed there.
#let _foot(book-title, sans) = context {
  let pageno = here().page()
  let chs = query(heading.where(level: 1))
  let starts = chs.map(c => c.location().page())
  if pageno < starts.at(0, default: 99999) { return }
  set text(font: sans, size: 8pt, weight: 400, fill: MUTED)
  let folio = counter(page).display()
  // Sides follow the printed folio, not the sheet: this template breaks to the
  // next page rather than to a recto, so the front matter can be an odd number
  // of pages (no TOC, or a two-page one) and physical parity would then be
  // inverted for the whole body.
  let recto = calc.odd(counter(page).at(here()).first())
  let running = if starts.contains(pageno) { [] } else {
    let label = if recto {
      let before = chs.filter(c => c.location().page() <= pageno)
      if before.len() > 0 { before.last().body } else { [] }
    } else { book-title }
    text(size: 7.5pt, tracking: 0.14em)[#upper(label)]
  }
  if recto { [#running#h(1fr)#folio] } else { [#folio#h(1fr)#running] }
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
  body-font: "Libre Baskerville",
  display-font: "Barlow",
  mono-font: "DejaVu Sans Mono",
  doc,
) = {
  let g = _geom(trim)

  set document(title: title, author: author)

  set text(
    font: body-font,
    size: g.size,
    fill: INK,
    lang: "id",
    hyphenate: true,
  )
  // block paragraphs: no indent, a visible gap between
  // leading 0.78em => ~14.7pt baseline-to-baseline at 9.5pt (1.55x the size)
  // spacing 1.55em puts a half-line of air between paragraphs; the spec's
  // 0.85em measured out 0.7pt wider than the leading, i.e. no gap at all.
  set par(
    justify: true,
    leading: 0.78em,
    spacing: 1.55em,
    first-line-indent: 0pt,
    linebreaks: "optimized",
  )

  // --- inline marks ---
  show emph: it => text(style: "italic", it.body)
  show strong: it => text(weight: 700, it.body)
  show link: it => text(fill: ACCENT, it)

  // --- block quote as a pull-quote: sans, full measure, no indent, no rule ---
  show quote.where(block: true): it => block(
    width: 100%,
    above: 1.3em,
    below: 1.3em,
  )[
    #set text(font: display-font, size: 1.05em, weight: 400, fill: MUTED.darken(10%))
    #set par(first-line-indent: 0pt, justify: true)
    #it.body
  ]

  // --- code: square-cornered hairline box, no fill ---
  show raw.where(block: true): it => block(
    width: 100%,
    breakable: false,
    inset: 0.9em,
    stroke: 0.5pt + HAIRLINE,
  )[
    #set text(font: mono-font, size: 0.82em, fill: INK)
    #set par(justify: false, first-line-indent: 0pt, leading: 0.62em)
    #it
  ]

  // --- lists: a drawn oxblood square, so no glyph-coverage risk ---
  set list(
    marker: box(width: 0.3em, height: 0.3em, baseline: -0.15em, fill: ACCENT),
    indent: 0.9em, body-indent: 0.6em, spacing: 0.6em,
  )
  set enum(indent: 0.9em, body-indent: 0.6em, spacing: 0.6em)

  // --- figure: full measure, caption flush left in sans ---
  show figure: set image(width: 100%)
  show figure.caption: it => {
    set text(font: display-font, size: 7.5pt, weight: 400, fill: MUTED, tracking: 0.1em)
    set par(justify: false)
    align(left, upper(it))
  }

  // --- sub-headings: sans, both of them ---
  show heading.where(level: 2): it => block(above: 1.9em, below: 0.55em)[
    #set text(font: display-font, size: 1.05em, weight: 600, fill: INK)
    #set par(justify: false, first-line-indent: 0pt)
    #it.body
  ]
  show heading.where(level: 3): it => block(above: 1.5em, below: 0.5em)[
    #set text(font: display-font, size: 0.85em, weight: 500, fill: MUTED, tracking: 0.1em)
    #set par(justify: false, first-line-indent: 0pt)
    #upper(it.body)
  ]

  // number level-1 headings only; the counter drives both opener and TOC
  set heading(numbering: (..n) => if n.pos().len() == 1 {
    numbering("1", ..n.pos())
  })

  // --- chapter opener: next page (not recto), high and flush left ---
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    v(0.35in)
    block(width: 100%)[
      #set align(left)
      #set par(justify: false, first-line-indent: 0pt, leading: 0.3em)
      #text(font: display-font, size: 3.0em, weight: 700, fill: ACCENT)[
        #counter(heading).display(it.numbering)
      ]
      #linebreak()
      #text(font: display-font, size: 1.55em, weight: 600, fill: INK)[#it.body]
    ]
    v(1.6em)
  }

  // ===========================================================================
  // FRONT MATTER — no folio, no running foot
  // ===========================================================================
  set page(
    width: g.width,
    height: g.height,
    margin: g.margin,
    numbering: none,
    header: none,
    footer: none,
  )

  // --- title page: asymmetric, flush left high, author pinned bottom-left ---
  {
    set par(justify: false, first-line-indent: 0pt, leading: 0.9em)
    v(1.1in)
    text(font: display-font, size: 2.6em, weight: 700, fill: INK)[#title]
    if subtitle != none {
      v(1.0em)
      text(size: 1.0em, style: "italic", fill: MUTED)[#subtitle]
    }
  }
  place(bottom + left, dy: -0.35in)[
    #text(font: display-font, size: 0.95em, weight: 600, fill: INK, tracking: 0.12em)[
      #upper(author)
    ]
  ]

  // --- table of contents: flush left, oxblood numbers, no dot leaders ---
  // Suppressed as a unit, its own page break included: the title page then runs
  // straight into chapter one with no blank between them.
  if toc {
    pagebreak(weak: true)
    {
      set par(justify: false, first-line-indent: 0pt)
      text(font: display-font, size: 1.3em, weight: 700, fill: INK)[Daftar Isi]
    }
    v(1.2em)
    set outline.entry(fill: none)
    show outline.entry: set text(font: display-font, size: 0.95em, weight: 400, fill: INK)
    // The link() is what makes the entry clickable — `it.inner()` alone is not.
    // It trips the `show link` rule, so the title half restates its own fill.
    show outline.entry.where(level: 1): it => context {
      v(0.7em, weak: true)
      let n = counter(heading).at(it.element.location()).first()
      link(it.element.location())[
        #text(fill: ACCENT)[#n]#h(0.7em)#text(fill: INK)[#it.inner()]
      ]
    }
    show outline.entry.where(level: 2): it => text(size: 0.88em, fill: MUTED, it)
    outline(title: none, depth: 2, indent: 1.4em)
  }

  // ===========================================================================
  // BODY — folio restarts at 1; header stays empty, running foot switched on
  // ===========================================================================
  pagebreak(weak: true)
  set page(numbering: "1", header: none, footer: _foot(title, display-font))
  counter(page).update(1)

  doc
}
