"use client";

// The writing surface. A plain textarea: no editor library is installed, and a
// single-user Markdown tool does not earn the bundle. Chrome is one hairline
// and one error strip; everything else is the text.

import { useId, useRef, useState } from "react";
// Per-icon import: the barrel is thousands of modules and slows dev compiles.
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { COPY } from "@/lib/brand";
import type { MarkdownPaneProps } from "@/lib/editor-session";

// This surface's own copy. lib/brand.ts holds the chrome strings and is not
// this task's file to extend.
const LABEL = {
  surface: "Manuskrip",
  sample: "Coba contoh",
  // UI-REFERENCE names this button `Impor .docx`. Nothing returns markdown for
  // a .docx — compile-service converts one on its way to a PDF and exposes no
  // markdown-out route — so the honest label is the generic one until it does.
  importFile: "Impor berkas",
  tooBig: "Berkas terlalu besar. Maksimal 2 MB.",
};

/** .docx is offered so picking one gets the session's explanation inline,
 *  rather than being silently unselectable in the picker. */
const ACCEPT = ".md,.markdown,.txt,.docx";

/** Mirrors MAX_MARKDOWN_BYTES in compile-service/src/config.mjs.
 *  ponytail: this guards the main thread, not the service — `importFile` does
 *  `await file.text()` with no size check, so a huge drop freezes the tab
 *  before anything is sent. The durable place for it is lib/editor-session.ts. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** ~65ch of the mono face at --text-base, plus its gutters. Shared by the
 *  textarea and the empty-state overlay so the prompt sits on the caret line. */
const MEASURE = "mx-auto w-full max-w-[41rem]";
const GUTTER = "px-4 sm:px-6";

export function MarkdownPane({ value, onChange, onImportFile, onLoadSample }: MarkdownPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptId = useId();

  async function take(file: File | null | undefined) {
    if (!file) return;
    setError(file.size > MAX_IMPORT_BYTES ? LABEL.tooBig : await onImportFile(file));
  }

  return (
    <div
      className="relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-paper"
      onDragOver={(e) => {
        e.preventDefault(); // without this the browser opens the dropped file
        setDragging(true);
      }}
      onDragLeave={(e) => {
        // dragleave also fires crossing into a child; only a real exit counts.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void take(e.dataTransfer.files[0]);
      }}
    >
      <div
        className="relative min-h-0"
        // The measure leaves side gutters; clicking one should still land the
        // caret rather than doing nothing.
        onClick={(e) => {
          if (e.target === e.currentTarget) areaRef.current?.focus();
        }}
      >
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => {
            if (error) setError(null);
            onChange(e.target.value);
          }}
          aria-label={LABEL.surface}
          aria-describedby={value ? undefined : promptId}
          // No onKeyDown by design: Tab has to keep moving focus out of here.
          // The focus ring is the global one, pulled inside so it frames the
          // measure instead of the pane edge.
          className={`${MEASURE} ${GUTTER} block h-full resize-none bg-transparent py-6 font-mono text-base leading-8 text-ink focus-visible:-outline-offset-2`}
        />

        {/* Vanishes the moment there is text — the prompt is the placeholder,
            so it must not survive the first keystroke. */}
        {!value && (
          <div
            className={`${MEASURE} ${GUTTER} pointer-events-none absolute inset-x-0 top-0 py-6`}
          >
            <p id={promptId} className="text-base leading-8 text-muted">
              {COPY.editorPlaceholder}
            </p>
            <div className="pointer-events-auto -ml-2 mt-1 flex flex-wrap items-center gap-x-3">
              <GhostText onClick={onLoadSample}>{LABEL.sample}</GhostText>
              <GhostText onClick={() => fileRef.current?.click()}>{LABEL.importFile}</GhostText>
            </div>
          </div>
        )}
      </div>

      {/* Inline, in the service's own voice. Never an alert, never a toast. */}
      {error && (
        <p
          role="alert"
          className={`${GUTTER} flex items-start gap-2 border-t border-hairline py-3 text-sm text-accent-ink`}
        >
          <WarningCircleIcon size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* Dragover feedback is a border colour change and nothing else. Drawn as
          an overlay so the 2px never reflows the text. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 border-2 transition-colors duration-150 ${
          dragging ? "border-accent" : "border-transparent"
        }`}
      />

      {/* display:none, so it is not a phantom tab stop; the ghost button above
          is the keyboard route into the picker. */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = ""; // so picking the same file twice still fires
        }}
      />
    </div>
  );
}

// Text button, not a bordered one: the empty state must not read as a form.
// h-11 keeps the tap target at 44px without showing a box.
function GhostText({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center rounded-md px-2 text-sm text-muted underline-offset-4 transition-[color,transform] duration-150 hover:text-ink hover:underline active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
