# Foliate

Turn a Markdown manuscript into a publisher-grade PDF ebook — justified text, a
baseline grid, running heads, folios, and real chapter openers — straight from
the browser. The preview is the actual compiled PDF, so what you see is what you
export. No InDesign, no layout course.

Interface copy is Indonesian; the code and docs are English.

## How it works

Two pieces:

```
web/              Next.js 15 app — landing, project library, editor + live PDF preview
  app/api/compile   proxy → the compile service (reads COMPILE_SERVICE_URL)
compile-service/  Fastify server: Markdown → Pandoc → Typst → PDF
  templates/        the three book templates (the actual product)
  fonts/            bundled faces the templates set, passed to Typst via --font-path
```

The editor is local-first: projects live in the browser (IndexedDB), and the
manuscript is only sent to the compile service to be typeset. Nothing is stored
server-side.

### The templates

| Template       | Body face             | For                          |
| -------------- | --------------------- | ---------------------------- |
| Literary       | Spectral              | literary fiction, essays     |
| Manuscript     | Source Serif 4        | non-fiction, memoir, how-to  |
| Contemporary   | Libre Baskerville + Barlow | business, self-help     |

## Local development

Prerequisites: Node ≥ 20, plus [Typst](https://github.com/typst/typst) and
[Pandoc](https://pandoc.org/) (**≥ 3.1.7** — that release added the Typst
writer) on your PATH.

```bash
# 1. compile service (port 8723)
cd compile-service
npm install
npm run dev

# 2. web app (port 3000) — in a second terminal
cd web
npm install
npm run dev
```

Open the app, start from the sample manuscript or paste your own Markdown, and
the right-hand pane renders the compiled book as you type.

## Deployment

The compile service shells out to the native `typst` and `pandoc` binaries, so
it needs a container host — it cannot run on an edge/serverless runtime. The web
app can run anywhere Next.js does. A working split:

- **compile-service → [Render](https://render.com)** (or Fly/Railway) via
  `compile-service/Dockerfile`. A `render.yaml` blueprint is included. You get a
  `https://<name>.onrender.com` URL.
- **web → [Cloudflare Workers](https://workers.cloudflare.com)** via
  [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Set the app's
  `COMPILE_SERVICE_URL` variable to the compile service's public URL.

```bash
cd web
npm run deploy          # builds with OpenNext and deploys to Cloudflare
```

See `web/wrangler.jsonc` and `render.yaml` for the specifics.

## Licensing

The bundled fonts are under the SIL Open Font License; each face's license sits
beside it in `compile-service/fonts/`.
