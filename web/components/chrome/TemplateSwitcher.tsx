"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { Popover } from "./Popover";
import { templateThumbnail } from "./template-thumbnails";
import { trimAspect, type TemplateId, type Trim } from "@/lib/compile";

/**
 * Three cards in a row, each showing a real rendered chapter opener. No
 * category rail and no per-card Preview/Choose pair — at n=3 both are dead
 * chrome (UI-REFERENCE). The whole card is the click target.
 */
export function TemplateSwitcher({
  template,
  onTemplateChange,
  trim,
  themePresets,
}: {
  template: TemplateId;
  onTemplateChange: (template: TemplateId) => void;
  /** Thumbnails are rendered at the trim the book is actually set in. */
  trim: Trim;
  themePresets?: ReactNode;
}) {
  const active = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0];

  return (
    <Popover
      label="Template"
      triggerLabel={`Template: ${active.label}`}
      trigger={
        <>
          <span className="hidden sm:inline">{active.label}</span>
          <span className="sm:hidden">Template</span>
          <CaretDownIcon size={13} weight="bold" />
        </>
      }
      panelClassName="w-[34rem] max-w-[calc(100vw-1.5rem)]"
    >
      {({ open, close }) => (
        <>
          <div className="grid grid-cols-1 gap-1.5 p-2 min-[420px]:grid-cols-3">
            {TEMPLATES.map((t) => {
              const selected = t.id === template;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onTemplateChange(t.id);
                    close();
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] min-[420px]:block ${
                    selected
                      ? "border-transparent ring-[1.5px] ring-accent"
                      : "border-hairline hover:bg-field"
                  }`}
                >
                  <span className="block w-16 shrink-0 min-[420px]:w-full">
                    <Thumbnail template={t.id} trim={trim} enabled={open} />
                  </span>
                  <span className="block min-w-0 min-[420px]:mt-2">
                    <span
                      className={`block text-sm ${selected ? "text-accent-ink" : "text-ink"}`}
                    >
                      {t.label}
                    </span>
                    <span className="mt-0.5 block text-balance font-mono text-2xs leading-4 text-muted">
                      {t.descriptor}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {themePresets ? (
            <div className="border-t border-hairline p-2">{themePresets}</div>
          ) : null}
        </>
      )}
    </Popover>
  );
}

/**
 * Label plus the one-line typographic descriptor. Figures are read off the
 * .typ sources at the default 5×8 trim; manuscript and contemporary step their
 * body size at other trims, so treat the pair as the template's character
 * rather than a measurement of the current page.
 */
const TEMPLATES: { id: TemplateId; label: string; descriptor: string }[] = [
  { id: "literary", label: "Literary", descriptor: "Spectral · 10,5/15 · pembuka turun" },
  { id: "manuscript", label: "Manuscript", descriptor: "Source Serif 4 · 11/17,8 · bab terpusat" },
  {
    id: "contemporary",
    label: "Contemporary",
    descriptor: "Libre Baskerville · 9,5/14,7 · nomor bab besar",
  },
];

/**
 * Page-shaped at the current trim in all three states. Shimmer means "working"
 * and only appears while compiling; a page that never arrived is a bare
 * outline, same as the preview pane's nothing-yet state.
 */
function Thumbnail({
  template,
  trim,
  enabled,
}: {
  template: TemplateId;
  trim: Trim;
  enabled: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Nothing compiles until the popover has been opened once. The module cache
  // makes every reopen after that instant.
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setFailed(false);
    templateThumbnail(template, trim).then(
      (url) => live && setSrc(url),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [enabled, template, trim]);

  return (
    <span
      className="relative block overflow-hidden rounded-sm border border-hairline bg-paper"
      style={{ aspectRatio: trimAspect(trim) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a canvas data URL; next/image would only proxy it
        <img src={src} alt="" className="block h-full w-full object-cover" />
      ) : failed ? null : (
        <span className="absolute inset-0 block overflow-hidden">
          <span className="animate-shimmer block h-full w-1/2 bg-linear-to-r from-transparent via-field to-transparent" />
        </span>
      )}
    </span>
  );
}
