# UI-REFERENCE — Foliate app surfaces

Decisions distilled from a Mobbin sweep of ~40 document, editor, and export
products. This is the shared contract for anyone building a surface below.
Where it conflicts with `../HANDOFF-foliate-mvp.md` §6, HANDOFF wins.

Copy is Indonesian. Icons are Phosphor (`@phosphor-icons/react`, already installed).

---

## Editor route — split view

- Grid, not flex: `grid-cols-[minmax(380px,40fr)_60fr]`. The preview absorbs
  extra width; the writing pane holds a ~65ch measure. Every reference product
  weights the rendered artifact heavier than the input (37/63, 30/70, 23/77) —
  a 50/50 split reads as two tools instead of one tool with a result.
- Below ~1100px: single column plus a two-item segmented toggle (Teks / Halaman).
  Do not shrink both panes.
- Divider is a 1px `--hairline` rule. Not a shadowed panel edge.

## Preview pane

- Continuous vertical page-stack. Sheet width 92% of pane, capped ~620px,
  `aspect-ratio` from the active trim, ~24px gutter between sheets.
- Field behind the stack is one warm step darker than `--paper` (~`#F2EFE7`).
  Never neutral or near-black — every PDF viewer surveyed used cold gray, and
  mixing warm with cool is an auto-reject here.
- Sheet: `1px var(--hairline)` border plus a shadow tinted to the field hue.
- Chrome is one sticky bottom-center pill — `hal. 4 dari 128` — fading ~1s after
  scroll idle, `opacity` only. No zoom, rotate, print, fit-width, or thumbnail
  rail. Surveyed viewers stack 7+ controls above the page; that chrome competes
  with the book.
- Loading: page-shaped skeleton at the current trim with shimmer.
- Nothing-yet: a single empty page outline, hairline border, no fill, **no
  shimmer**. Shimmer means "working" and must not also mean "empty".

## Top bar

Left to right: project title (inline-editable) · save state · flex gap ·
template trigger (ghost) · trim trigger (ghost) · theme toggle (icon) · account
(avatar) · **Ekspor** (the single filled button, oxblood).

- Exactly one filled button in the bar. Template and trim open popovers, not modals.
- Save state is muted prose beside the title, one size step down, three states:
  `Menyimpan…` → `Tersimpan` → `Tersimpan 4 menit lalu` (relative, recomputed on
  an interval). Reserve the width so the bar never reflows. No badge, no color,
  no per-save toast. Failure is the exception: `Gagal menyimpan` in oxblood with
  an inline `Coba lagi` text button.

## Template switcher

Popover, three cards in a row. Each thumbnail is a real rendered chapter-opener
page at the current trim, from the same Typst pipeline — a layout choice is only
decidable by seeing the layout. Under it: name, then a one-line typographic
descriptor in muted mono (`Spectral · 11/15 · sunk opener`).

Selected = 1.5px oxblood ring on the card plus oxblood name. No checkmark badge,
no per-card Preview/Choose pair, no category rail — at n=3 a rail is dead chrome.
The whole card is the click target.

## Trim selector

Popover rows: name left, dimensions right-aligned in muted mono
(`Novel · 5,5 × 8,5 in`). Each row is prefixed by a small rectangle with
`aspect-ratio` from that trim, so 5×8 and 6×9 differ visibly. `Kustom…` is the
last row and expands two number inputs in place.

Changing trim resizes the page-stack immediately, before the recompile lands.

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
  shadow. Below: title in ink, `Diubah 2 jam lalu` in muted.
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
