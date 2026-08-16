# M0 Compile Spike — Decision

**Date:** 2026-05-29
**Scope:** Prove a Markdown manuscript can become a publisher-grade PDF via Typst,
and decide between two MD→Typst paths: **(A) pandoc** vs **(B) a custom mapper**.

## Result: both paths clear the visual gate — output is byte-identical

Both pipelines compiled the same sample manuscript through the same `literary.typ`
template to a 10-page PDF. Rendered at 120 ppi, the pages are **pixel-identical**:

| page | A vs B pixel delta |
|------|--------------------|
| 1 (title) | 0 |
| 5 (chapter 1 opener + body) | 0 |
| 7 (chapter 2 opener) | 0 |
| 9 (chapter 3 + code block) | 0 |

So the choice is **not** about output fidelity. The template layer is provably
parser-agnostic: whichever path feeds it the same Typst body, the book looks the same.

## Recommendation: pandoc (Path A) as the primary parser for M1

Use pandoc to parse Markdown; keep the custom mapper as a documented fallback and
as the proof that the template is decoupled from the parser.

**Why pandoc wins for a product that ingests arbitrary author manuscripts:**
- Real manuscripts hit the long tail of Markdown — tables, footnotes, nested lists,
  multi-paragraph list items, reference links, hard breaks, HTML passthrough,
  setext headings. The custom mapper (~90 lines) covers only the features in our
  sample; covering the tail correctly is months of work pandoc already did.
- CommonMark/GFM correctness is a solved problem; re-solving it is a known trap.
- Less parsing code to own means fewer ingestion bugs reaching authors.

**What the custom mapper proved (worth keeping):**
- The Typst output is fully controllable and auditable end to end.
- A zero-dependency path exists if we ever need to drop the pandoc binary.
- The template requires no pandoc-specific shims beyond one `horizontalrule` helper.
