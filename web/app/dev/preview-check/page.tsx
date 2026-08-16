"use client";

// Runnable check for components/preview/. Not part of the product surface —
// the sibling of app/dev/storage-check, same purpose: drive one leaf against
// real data without the rest of the editor existing yet.
//
//   1. cd compile-service && npm start
//   2. cd web && npm run dev  →  /dev/preview-check
//
// The two PDFs are produced by POSTing compile-service/samples/manuscript.md
// to /compile (see this file's sibling in public/samples).

import { useState } from "react";
import { PagePreview } from "@/components/preview/PagePreview";
import type { Trim } from "@/lib/compile";
import type { CompileStatus } from "@/lib/editor-session";

const SHORT = "/samples/preview-check.pdf";
/** Same manuscript, one line edited — the recompile case that must not blank. */
const REVISED = "/samples/preview-check-rev.pdf";
const LONG = "/samples/preview-check-long.pdf";

const CASES: Record<string, CompileStatus> = {
  empty: { kind: "empty" },
  "compiling (pertama)": { kind: "compiling", previousUrl: null },
  "compiling (ulang)": { kind: "compiling", previousUrl: SHORT },
  failed: {
    kind: "failed",
    error: { error: true, stage: "typst", message: "gagal", line: 12 },
  },
  "ready (pendek)": { kind: "ready", url: SHORT, pageCount: null },
  "ready (revisi)": { kind: "ready", url: REVISED, pageCount: null },
  "ready (panjang)": { kind: "ready", url: LONG, pageCount: null },
};

const TRIMS: Trim[] = ["5x8", "6x9", "a5", { width: 8, height: 10, unit: "in" }];

export default function PreviewCheck() {
  const [key, setKey] = useState("ready (pendek)");
  const [trim, setTrim] = useState<Trim>("5x8");
  const [pages, setPages] = useState(0);

  return (
    <div className="grid h-[100dvh] grid-rows-[auto_1fr]">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-3 text-sm">
        {Object.keys(CASES).map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            className={`rounded-md border px-2 py-1 ${k === key ? "border-accent text-accent-ink" : "border-hairline text-muted"}`}
          >
            {k}
          </button>
        ))}
        <span className="ml-4 text-muted">trim</span>
        {TRIMS.map((t) => (
          <button
            key={JSON.stringify(t)}
            onClick={() => setTrim(t)}
            className={`rounded-md border px-2 py-1 ${JSON.stringify(t) === JSON.stringify(trim) ? "border-accent text-accent-ink" : "border-hairline text-muted"}`}
          >
            {typeof t === "string" ? t : "custom"}
          </button>
        ))}
        <span className="ml-4 text-muted" data-testid="pages">
          onPageCount: {pages}
        </span>
      </div>
      {/* min-h-0 is the shell's job (EditorShell puts it on both cells); the
          pane only promises to fill the cell it is given. */}
      <div className="min-h-0 min-w-0">
        <PagePreview status={CASES[key]} projectId="dev-preview-check" trim={trim} onPageCount={setPages} />
      </div>
    </div>
  );
}
