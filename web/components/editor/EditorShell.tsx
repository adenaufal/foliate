"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { EditorTopBar } from "@/components/chrome/EditorTopBar";
import { MarkdownPane } from "@/components/editor/MarkdownPane";
import { ExportDialog } from "@/components/export/ExportDialog";
import { PagePreview } from "@/components/preview/PagePreview";
import { ThemePresets } from "@/components/settings/ThemePresets";
import { BRAND_NAME, COPY } from "@/lib/brand";
import { inlineError } from "@/lib/compile";
import { useEditorSession } from "@/lib/editor-session";

/**
 * Editor route composition. Owns the split, the divider, and the collapse —
 * nothing else. Every surface below is a leaf that takes values and callbacks
 * from `useEditorSession`.
 */
export function EditorShell({ projectId }: { projectId: string }) {
  const session = useEditorSession(projectId);
  const [pane, setPane] = useState<Pane>("teks");
  const [exportOpen, setExportOpen] = useState(false);
  const heading = session.title || COPY.untitled;

  // The title lives in IndexedDB, so the server cannot render it — the route's
  // static metadata is only the placeholder until the project loads here.
  useEffect(() => {
    if (session.status === "ready") document.title = `${heading} · ${BRAND_NAME}`;
  }, [session.status, heading]);

  if (session.status === "missing") return <NotFound />;

  // The dialog reuses whatever is already on screen; during a recompile that
  // is the outgoing PDF, not nothing.
  const pdfUrl =
    session.compile.kind === "ready"
      ? session.compile.url
      : session.compile.kind === "compiling"
        ? session.compile.previousUrl
        : null;

  return (
    // Definite height, not just a floor: with `min-h` the 1fr row grows to the
    // height of the page stack, the document itself scrolls, and the top bar
    // and page pill ride away with it. dvh, so mobile browser chrome is out.
    <div className="grid h-dvh grid-rows-[auto_auto_minmax(0,1fr)] bg-paper">
      {/* The route's heading. Visible as the inline-editable input in the bar,
          so it is hidden here and not a grid row (sr-only is absolute). */}
      <h1 className="sr-only">{heading}</h1>

      <EditorTopBar
        title={session.title}
        onTitleChange={session.setTitle}
        save={session.save}
        onRetrySave={session.retrySave}
        template={session.template}
        onTemplateChange={session.setTemplate}
        trim={session.trim}
        onTrimChange={session.setTrim}
        onExport={() => setExportOpen(true)}
        themePresets={
          <ThemePresets
            template={session.template}
            bodyFont={session.bodyFont}
            onBodyFontChange={session.setBodyFont}
            fonts={session.fonts}
            onFontUpload={session.addFont}
          />
        }
      />

      <PaneToggle value={pane} onChange={setPane} />

      {/* Grid, not flex percentages: the preview absorbs every extra pixel and
          the writing pane holds its measure. Both panes stay mounted below the
          breakpoint so the pdf.js canvases and the caret survive a toggle.
          row-start-3 is load-bearing: the pane toggle above is display:none at
          ≥1100px, which stops it being a grid item, and auto-placement would
          otherwise drop this into the auto row and leave the 1fr row empty. */}
      <main id="main" className="row-start-3 grid min-h-0 grid-cols-1 split:grid-cols-[minmax(380px,40fr)_60fr]">
        <div
          className={`min-h-0 min-w-0 split:block split:border-r split:border-hairline ${
            pane === "teks" ? "" : "hidden"
          }`}
        >
          <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
            <MarkdownPane
              value={session.markdown}
              onChange={session.setMarkdown}
              onImportFile={session.importFile}
              onLoadSample={() => void session.loadSample()}
            />
            {/* The preview pane points here for the detail, so it has to be
                here. Inline, in the service's voice, never a toast (§6.6). */}
            {session.compile.kind === "failed" && (
              <p
                role="alert"
                className="flex items-start gap-2 border-t border-hairline px-page py-3 text-sm leading-relaxed text-accent-ink"
              >
                <WarningCircleIcon size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden />
                {inlineError(session.compile.error)}
              </p>
            )}
          </div>
        </div>

        <div className={`min-h-0 min-w-0 split:block ${pane === "halaman" ? "" : "hidden"}`}>
          <PagePreview
            status={session.compile}
            projectId={projectId}
            trim={session.trim}
            onPageCount={session.reportPageCount}
          />
        </div>
      </main>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={session.title}
        trim={session.trim}
        pdfUrl={pdfUrl}
        onExport={session.runExport}
      />
    </div>
  );
}

type Pane = "teks" | "halaman";

// Two items, so a segmented control rather than tabs. Gone at ≥1100px, where
// both panes are visible at once.
function PaneToggle({ value, onChange }: { value: Pane; onChange: (p: Pane) => void }) {
  return (
    <div className="border-b border-hairline px-page py-2 split:hidden">
      <div role="group" aria-label="Panel" className="grid w-full grid-cols-2 rounded-md border border-hairline p-0.5 sm:inline-grid sm:w-auto">
        {(["teks", "halaman"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={`tap rounded-[calc(var(--radius-md)-2px)] px-5 py-1.5 text-sm transition-[color,background-color,scale] duration-150 ease-[var(--ease-enter)] active:scale-[0.96] ${
              value === p ? "bg-field text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {p === "teks" ? "Teks" : "Halaman"}
          </button>
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-[1400px] px-page py-10">
      <p className="text-base">{COPY.loadFailed}</p>
      <p className="mt-1 text-sm text-muted">Proyek ini sudah dihapus atau tautannya salah.</p>
      <Link
        href="/library"
        className="mt-4 inline-block text-sm text-accent-ink underline-offset-4 hover:underline"
      >
        {COPY.backToLibrary}
      </Link>
    </main>
  );
}
