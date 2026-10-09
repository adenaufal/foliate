# UI-REFERENCE — Foliate app surfaces

Decisions distilled from a Mobbin sweep of ~40 document, editor, and export
products. This is the shared contract for anyone building a surface below.
Where it conflicts with `../HANDOFF-foliate-mvp.md` §6, HANDOFF wins.

Copy is Indonesian. Icons are Phosphor (`@phosphor-icons/react`, already installed).

---

## Editor route — the studio

Four columns at ≥1200px (`wide`): **kerangka naskah · teks · halaman ·
inspektur penyusunan**. The two side columns fold away (top-bar toggles,
remembered in localStorage); between 1100 and 1200px they are not columns but
drawers (native `<dialog>`, left and right) opened by the same toggles.

- The middle pair is a grid, not flex: `minmax(0,1fr)_minmax(0,1.12fr)` beside
  the side columns, `minmax(380px,40fr)_60fr` without them. The preview absorbs
  extra width; the writing pane holds a ~65ch measure. Every reference product
  weights the rendered artifact heavier than the input (37/63, 30/70, 23/77) —
  a 50/50 split reads as two tools instead of one tool with a result.
- View switch in the top bar: Teks · Keduanya · Halaman. `Keduanya` exists at
  ≥1100px only; below that the switch is the two-item Teks / Halaman and both
  panes stay mounted (canvases and caret survive a toggle).
- Dividers are 1px `--hairline` rules. Not shadowed panel edges.
- The editor column carries one header line: `BAB 2 · Tentang Memulai` on the
  left (the chapter under the caret), `158 kata · baris 24` and the `⌘K` cap on
  the right. Muted, mono figures, nothing clickable but the cap.

## Kerangka naskah (outline column, 216px)

- Read off the Markdown: `#` is a chapter, `##` a section. Numbered `01 02 …`
  in mono; sections indented under their chapter with a hairline.
- Page numbers come from the compiled PDF's own bookmarks (Typst writes one per
  heading), matched to the headings by order, by words if the counts disagree.
  Physical pages — the same numbers as the page pill — never the printed folio.
- The chapter under the caret is the active row: `--field` fill, a 2px accent
  bar on the left, accent number and page. Clicking any row moves **both**
  panes: caret to the heading, stack to its page.
- Footer: `38.412 kata · 128 halaman · ±3 j baca`. Prose words only — marks,
  fences and front matter are not words.
- Empty: one sentence, left-aligned: `Belum ada bab. Awali bab dengan # Judul`.

## Inspektur penyusunan (inspector column, 236px)

Everything that shapes the page, in the order it is decided:

- **Template** — three rows, each a real rendered chapter opener at the current
  trim (same Typst pipeline, cached per session), name, then the one-line
  descriptor in muted mono (`Spectral · 10,5/15 · pembuka turun`). Selected =
  1.5px accent ring and accent name. Nothing compiles while the panel is off
  screen.
- **Ukuran halaman** — rows with a rectangle at the trim's own aspect ratio;
  `Kustom…` last, expanding two number inputs in place.
- **Huruf isi** — a `<details>` whose summary is the face in force
  (`Spectral · bawaan template`); the specimen rows and the upload open on
  demand.
- **Spesifikasi** — size, leading, lines per page, measure (±chars), margins,
  and where the running head and folio sit, in the template's own words.
  Mirrored from the `.typ` files (`lib/templates.ts`), not measured.

Template and trim have no popovers in the top bar any more; the inspector is
their one home at every width.

## Perintah (⌘K / Ctrl+K)

Native `<dialog>`, 34rem, groups in fixed order: Template · Ukuran halaman ·
Lompat ke bab · Tampilan · Berkas. The option in force is set in accent and
tagged `aktif`; running it is a no-op. Substring filter over label, detail and
keywords. `↑↓ pilih · ↵ jalankan · esc tutup` in the footer. The `⌘K` cap in
the editor header is the one visible handle; there is no toolbar button.

## Preview pane

- Continuous vertical page-stack. Sheet width 92% of pane, capped ~620px,
  `aspect-ratio` from the active trim, ~24px gutter between sheets.
- Field behind the stack is one warm step darker than `--paper` (~`#F2EFE7`).
  Never neutral or near-black — every PDF viewer surveyed used cold gray, and
  mixing warm with cool is an auto-reject here.
- Sheet: `1px var(--hairline)` border plus a shadow tinted to the field hue.
- Chrome is one sticky bottom-center pill — `hal. 4 dari 128` — fading ~1s after
  scroll idle, `opacity` only, plus the one-page / spread toggle at the top right
  (two icon buttons, no fade: a mode is not transient). No zoom, rotate, print,
  fit-width, or thumbnail rail. Surveyed viewers stack 7+ controls above the
  page; that chrome competes with the book.
- **Spread**: facing pages as the book is bound — page 1 alone on the right,
  then (2,3), (4,5)…, each half the row, a gutter shadow on the inner edge
  (`.spine-verso` / `.spine-recto`). The pill reads `hal. 6–7 dari 128`. The
  choice is remembered in localStorage.
- Loading: page-shaped skeleton at the current trim with shimmer.
- Nothing-yet: a single empty page outline, hairline border, no fill, **no
  shimmer**. Shimmer means "working" and must not also mean "empty".

## Top bar

Left to right: brand · `/` · project title (inline-editable) · save state ·
flex gap · view switch (Teks · Keduanya · Halaman) · outline toggle (icon) ·
inspector toggle (icon) · theme toggle (icon) · account (avatar) · **Ekspor**
(the single filled button, oxblood).

- Exactly one filled button in the bar. The two panel toggles show `aria-pressed`
  with a `--field` fill; at ≥1200px they fold a column, below that they open a
  drawer.
- Save state is muted prose beside the title, one size step down, three states:
  `Menyimpan…` → `Tersimpan` → `Tersimpan 4 menit lalu` (relative, recomputed on
  an interval). Reserve the width so the bar never reflows. No badge, no color,
  no per-save toast. Failure is the exception: `Gagal menyimpan` in oxblood with
  an inline `Coba lagi` text button.

## Template and trim

Both live in the inspector (above). The rules carried over from the old
popovers still hold: a thumbnail is a real rendered chapter opener, never an
illustration; selected is a ring and an accent name, no checkmark badge, no
Preview/Choose pair, no category rail; a trim row is prefixed by a rectangle at
its own aspect ratio; changing trim resizes the page stack immediately, before
the recompile lands.

## Export dialog

Two columns. Left (~35%): PDF | EPUB segmented control, then label-left rows —
Trim (inherits current), Sertakan TOC (toggle), Nama file (text input, label
above per HANDOFF §6.6) — then the filled `Ekspor PDF` full-width at the bottom
of that column. Right (~65%): the first page already rendered in the preview
stack, reused, not re-fetched.

Async: the button label carries the status — `Ekspor PDF` → disabled
`Menyusun…` → bottom-right text toast `PDF tersimpan`, auto-dismiss ~6s,
manual X. No spinner; text status is honest about an operation of unknown
duration. The reference apps pair that toast with a `Buka folder` action; a
browser cannot open a folder, so Foliate ships the toast without it. On failure, an inline error in the left column in
the HANDOFF §6.6 voice — never a toast, never a stack trace.

## Project library

- Card = the rendered first page at the project's trim aspect ratio. Cache the
  render; never recompile on library load. Hairline border, one warm-tinted edge
  shadow. Below: title in ink, then `Literary · 5 × 8 in · 128 hal.` in muted
  mono (the page count is cached beside the card art), then `Diubah 2 jam lalu`.
- The manuscript last touched wears an accent ring and a `Lanjutkan` bar along
  the foot of its page — the one accent fill on a card.
- Heading row: `Proyek`, then `5 naskah · 312 halaman` in mono, then a
  Terbaru / Judul segmented switch and `Proyek baru`.
- This is the only place uniform cards are allowed — each card is a distinct page
  render, not a repeated container. Other sections separate with `divide-y` and
  whitespace.
- `...` menu appears on hover **and** on `:focus-within` so it stays keyboard
  reachable. Order: Buka · Ganti nama · Duplikat · —divider— · Hapus (oxblood;
  the one legitimate accent use on a non-CTA).
- Rename inline on the card title (Enter commits, Esc reverts). No dialog.
- Delete confirms, and the copy states permanence, because there is no trash:
  `Hapus permanen? Proyek ini tidak bisa dikembalikan.`
- Empty state, left-aligned under the `Proyek` heading, no illustration, not
  centered: `Belum ada proyek.` / `Mulai dari manuskrip contoh, atau tempel
  Markdown-mu sendiri.` / `[Proyek baru]` filled + `[Buka contoh]` ghost.
  `Buka contoh` loads `public/samples/manuscript.md` — first render should be a
  real typeset book, one click in.

## Editor empty state

Placeholder inside the writing surface: `Tempel teks, atau tarik file .md ke sini.`
Beneath it two ghost text buttons: `Coba contoh` · `Impor .docx`. Both vanish on
first keystroke. Dragover highlights the drop zone with a border-color change only.

## Theme customization (Phase 2)

Per-template theme is a short list of preset rows, each rendered in its own
colors with live specimen text showing the actual pairing
(`Source Serif 4 / Geist` set in those faces). Active row ringed in oxblood.
No hex field, no color wheel — a curated finite set keeps every output on-brand.
Custom font upload is a separate labelled row beneath the presets, not mixed into
the swatch list.

---

## Observed antipatterns — auto-reject

1. Circular spinner in the preview pane (Lovable does exactly this).
2. Emoji anywhere in chrome or copy (Craft's export-success modal, Coda's chips).
3. Purple/indigo accents or gradient thumbnails (Pitch, Webflow, Lovable).
4. Cool or near-black field behind the page (Zillow `#2b2b2b`, Dropbox).
5. Overloaded preview toolbars — zoom %, rotate, print, fit-width, search.
6. An AI assistant panel in the second pane (Grammarly, Jasper, WRITER).
7. Multi-color status systems. One accent; state rides on weight and position.
8. Uniform drop-shadowed card grids as the default container.
9. Category rails or pagination on a 3-item picker.
10. Three parallel "create from…" cards on an empty state. Two buttons is the ceiling.
11. Bulk multi-select with a checkbox column and bottom action bar.
12. Two filled primaries in the top bar.
13. Soft "Trash" wording for a delete that is permanent.
14. Save state as a colored badge or a per-save toast.
15. Serif in app chrome. Serif is the book and the brand mark only.
16. A side panel that stays a column at every width. Below 1200px it is a drawer.
17. A thumbnail rail or page scrubber beside the stack. The outline's page
    numbers and the spread toggle are the whole navigation.
