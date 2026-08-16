"use client";

// Runnable check for components/export/ExportDialog. It needs a real compiled
// PDF and a real disk write, so it cannot be an assert under node — open
// /dev/export-check with the compile service running, wait for `ready`, then
// export once as PDF and once as EPUB and open both files.

import { useEffect, useState } from "react";
import { ExportDialog } from "@/components/export/ExportDialog";
import { useEditorSession } from "@/lib/editor-session";
import { storage } from "@/lib/storage";

const TITLE = "export-check";

export default function ExportCheckPage() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      // Reuse the scratch project across reloads instead of piling up rows.
      const existing = (await storage.list()).find((p) => p.title === TITLE);
      const source = await fetch("/samples/manuscript.md").then((r) => r.text());
      // The sample references placeholder-desk.jpg, which nothing ships and no
      // caller puts in `assets` — typst then fails the whole compile. Dropping
      // images keeps this check about the export, not about that gap.
      const markdown = source.replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, "");
      const project = existing ?? (await storage.create({ title: TITLE, markdown }));
      if (live) setProjectId(project.id);
    })();
    return () => {
      live = false;
    };
  }, []);

  return projectId ? <Harness projectId={projectId} /> : <p className="p-8 font-mono text-sm">memuat…</p>;
}

function Harness({ projectId }: { projectId: string }) {
  const session = useEditorSession(projectId);
  const [open, setOpen] = useState(false);

  const pdfUrl =
    session.compile.kind === "ready"
      ? session.compile.url
      : session.compile.kind === "compiling"
        ? session.compile.previousUrl
        : null;

  return (
    <div className="grid gap-4 p-8">
      <p id="compile-state" className="font-mono text-sm text-muted">
        {session.compile.kind}
        {session.compile.kind === "failed" ? ` — ${session.compile.error.message}` : ""}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-full rounded-md bg-accent px-4 text-sm font-medium text-on-accent sm:w-auto sm:justify-self-start"
      >
        Ekspor
      </button>

      <ExportDialog
        open={open}
        onClose={() => setOpen(false)}
        title={session.title}
        trim={session.trim}
        pdfUrl={pdfUrl}
        onExport={session.runExport}
      />
    </div>
  );
}
