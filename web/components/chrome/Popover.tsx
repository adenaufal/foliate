"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A popover, not a modal (UI-REFERENCE, top bar). Built on the native `popover`
 * attribute: the platform already owns light dismiss, Escape, the top layer,
 * and returning focus to the trigger — every behaviour a library would have
 * been installed for. Placement is the only piece missing (CSS anchor
 * positioning is not portable yet), so placement is all this adds.
 *
 * ponytail: placed once, on open. The header is sticky and any outside
 * interaction dismisses, so re-placing on scroll or resize would be dead code.
 */
export function Popover({
  label,
  triggerLabel,
  trigger,
  triggerClassName = GHOST_CONTROL,
  panelClassName = "",
  align = "end",
  children,
}: {
  /** Names the panel. Also the trigger's tooltip. */
  label: string;
  /** Only when the trigger has no text of its own (the avatar). */
  triggerLabel?: string;
  trigger: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  /** Which edge of the trigger the panel lines up with. */
  align?: "start" | "end";
  /** `open` gates work that should not run before the panel is seen. */
  children: (api: { open: boolean; close: () => void }) => ReactNode;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    // React types neither `beforetoggle` nor the ToggleEvent payload, so both
    // are wired by hand.
    const place = (e: Event) => {
      const anchor = button.current;
      if (!anchor || (e as ToggleEvent).newState !== "open") return;
      const r = anchor.getBoundingClientRect();
      el.style.top = `${r.bottom + 6}px`;
      el.style.left = align === "end" ? "auto" : `${Math.max(8, r.left)}px`;
      el.style.right = align === "end" ? `${Math.max(8, window.innerWidth - r.right)}px` : "auto";
    };
    // Second pass, once the panel has a box: a trigger near one edge of a
    // narrow viewport would otherwise hang the panel off the other side.
    const sync = (e: Event) => {
      const opened = (e as ToggleEvent).newState === "open";
      setOpen(opened);
      if (!opened) return;
      const r = el.getBoundingClientRect();
      if (r.left < 8) {
        el.style.left = "8px";
        el.style.right = "auto";
      } else if (r.right > window.innerWidth - 8) {
        el.style.right = "8px";
        el.style.left = "auto";
      }
    };
    el.addEventListener("beforetoggle", place);
    el.addEventListener("toggle", sync);
    return () => {
      el.removeEventListener("beforetoggle", place);
      el.removeEventListener("toggle", sync);
    };
  }, [align]);

  return (
    <>
      <button
        ref={button}
        type="button"
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={label}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {/* `inset-auto` undoes the UA's `inset: 0`; top/left/right come from
          `place`. The fade is opacity + transform only (HANDOFF §6.3). */}
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={label}
        className={`fixed inset-auto m-0 max-h-[min(80dvh,calc(100dvh-var(--safe-top)-var(--safe-bottom)-1rem))] overflow-auto overscroll-contain rounded-xl border border-hairline bg-paper p-0 text-ink shadow-page transition-[opacity,transform] duration-150 ease-[var(--ease-enter)] starting:-translate-y-1 starting:opacity-0 ${panelClassName}`}
      >
        {children({ open, close: () => panel.current?.hidePopover() })}
      </div>
    </>
  );
}

/** The bar's ghost control. Shared so the two triggers cannot drift apart. */
export const GHOST_CONTROL =
  "tap flex h-9 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm text-muted transition-[color,background-color,scale] duration-150 ease-[var(--ease-enter)] hover:bg-field hover:text-ink active:scale-[0.96]";
