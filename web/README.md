# Foliate — web

Next.js 15 App Router · React 19 · Tailwind **v4** (CSS-only config) · TypeScript.

```
npm run dev     # http://localhost:3000 — needs compile-service on :8723 for previews
npm run build
```

## Where things are

| Path | Owns |
|---|---|
| `styles/tokens.css` | The only stylesheet. Palette, type scale, radius, dark mode. **Do not create a second file that `@import "tailwindcss"`** — v4 would emit the framework twice. |
| `lib/brand.ts` | `BRAND_NAME` + all user-facing copy (Indonesian). Nothing else hardcodes the name. |
| `lib/storage.ts` | `StorageDriver` interface, IndexedDB `localDriver`, `supabaseDriver` stub. |
| `lib/compile.ts` | Typed compile-service client + trim geometry. |
| `app/api/compile/route.ts` | Proxy to `COMPILE_SERVICE_URL`. The browser never hits :8723. |
| `lib/outline.ts` | Headings and prose word counts read off the Markdown. Pure; `selfCheckOutline()`. |
| `lib/templates.ts` | Template catalogue + per-trim page geometry mirrored from the `.typ` files. Pure; `selfCheckTemplates()`. |
| `components/chrome/AppShell.tsx` | Top bar for library and settings. |
| `components/chrome/EditorTopBar.tsx` | The editor's bar: view switch, panel toggles, Ekspor. |
| `components/chrome/CommandPalette.tsx` | ⌘K. Takes a flat `Command[]`; the shell builds the list. |
| `components/editor/EditorShell.tsx` | Columns, drawers, view switch, palette commands, outline↔PDF page mapping. |
| `components/editor/OutlinePanel.tsx` | Chapter list with page numbers, stats footer. |
| `components/editor/InspectorPanel.tsx` | Template, trim, body face, page specification. |
| `components/preview/PdfStack.tsx` | Page stack or spreads; reads the PDF outline. |

## Tailwind v4 notes

There is no `tailwind.config.ts` and adding one does nothing. Tokens live in
`@theme inline { }` in `styles/tokens.css`; `--color-x` generates `bg-x`/`text-x`.
`inline` is required because every value is a `var()` reference — plain `@theme`
would produce a var-of-a-var that the `.dark` class swap does not propagate.
Dark mode is `@custom-variant dark (&:where(.dark, .dark *))`, not a config key.

## Checks

- `/dev/storage-check` runs the assert-based self-check for the local driver.
- pdf.js: import it **lazily inside an effect** (`await import("pdfjs-dist")`).
  A top-level import breaks `next build` with `DOMMatrix is not defined` — a
  `"use client"` module is still evaluated during prerender. Worker:
  `new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString()`.
