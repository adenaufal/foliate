"use client";

// The writing surface. A plain textarea: no editor library is installed, and a
// single-user Markdown tool does not earn the bundle. Chrome is one hairline
// and one error strip; everything else is the text.

import { useCallback, useId, useImperativeHandle, useRef, useState } from "react";
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
const GUTTER = "px-page";

/** 1-based line of a character offset. */
function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Character offset of the start of a 1-based line. */
function offsetOfLine(text: string, line: number): number {
  let offset = 0;
  for (let n = 1; n < line; n++) {
    const nl = text.indexOf("\n", offset);
    if (nl < 0) return text.length;
    offset = nl + 1;
  }
  return offset;
}

/**
 * Where a character offset sits vertically inside the textarea's scrollable
 * content, soft wraps included. A textarea exposes no caret geometry, so the
 * text up to the offset is set in a mirror with the same metrics and the
 * marker's position read off that. Rendered once per jump, never per key.
 */
function caretTop(ta: HTMLTextAreaElement, offset: number): number {
  const cs = getComputedStyle(ta);
  const mirror = document.createElement("div");
  for (const prop of [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "line-height",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "border-top-width",
    "border-bottom-width",
    "border-left-width",
    "border-right-width",
    "text-indent",
    "word-spacing",
    "tab-size",
  ]) {
    mirror.style.setProperty(prop, cs.getPropertyValue(prop));
  }
  mirror.style.boxSizing = "border-box";
  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "-100000px";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.width = `${ta.clientWidth}px`;
  mirror.textContent = ta.value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.append(marker);
  document.body.append(mirror);
  const top = marker.offsetTop;
  mirror.remove();
  return top;
}

export function MarkdownPane({
  value,
  onChange,
  onImportFile,
  onLoadSample,
  onCaretLine,
  ref,
}: MarkdownPaneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const lastLine = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptId = useId();

  async function take(file: File | null | undefined) {
    if (!file) return;
    setError(file.size > MAX_IMPORT_BYTES ? LABEL.tooBig : await onImportFile(file));
  }

  // Reported only when it changes: the outline re-renders per line, not per key.
  const reportCaret = useCallback(() => {
    const ta = areaRef.current;
    if (!ta || !onCaretLine) return;
    const line = lineOf(ta.value, ta.selectionStart);
    if (line === lastLine.current) return;
    lastLine.current = line;
    onCaretLine(line);
  }, [onCaretLine]);

  useImperativeHandle(
    ref,
    () => ({
      focusLine(line: number) {
        const ta = areaRef.current;
        if (!ta) return;
        const offset = offsetOfLine(ta.value, line);
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(offset, offset);
        // The line lands where the first line sits on a fresh page: one
        // padding's worth below the top edge.
        ta.scrollTop = Math.max(0, caretTop(ta, offset) - parseFloat(getComputedStyle(ta).paddingTop));
        reportCaret();
      },
    }),
    [reportCaret],
  );

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
            reportCaret();
          }}
          onSelect={reportCaret}
          onKeyUp={reportCaret}
          onClick={reportCaret}
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
        className={`pointer-events-none absolute inset-0 border-2 transition-colors duration-150 ease-[var(--ease-enter)] ${
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
      className="inline-flex h-11 items-center rounded-md px-2 text-sm text-muted underline-offset-4 transition-[color,scale] duration-150 ease-[var(--ease-enter)] hover:text-ink hover:underline active:scale-[0.96]"
    >
      {children}
    </button>
  );
}
