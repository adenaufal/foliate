// One sheet in the stack. Geometry is identical across the three preview
// states so the page never changes size when a compile lands (UI-REFERENCE,
// preview pane): 92% of the pane capped at 620px, trim aspect, hairline border,
// shadow tinted to the field hue via --shadow-page. In a spread, each sheet
// takes half the row instead and wears a spine shadow on its inner edge.

import type { ReactNode } from "react";

/** Vertical gutter between sheets, in px. `gap-6` on the stack — kept here
 *  because the page pill derives its pitch from it. */
export const GUTTER = 24;

const BASE = "relative shrink-0 overflow-hidden border border-hairline";

const SIZE = {
  full: "w-[92%] max-w-[620px]",
  half: "w-1/2 max-w-[620px]",
} as const;

export function Sheet({
  aspect,
  page,
  variant = "page",
  size = "full",
  side,
  children,
}: {
  aspect: number;
  /** 1-based page number; also the IntersectionObserver handle. */
  page?: number;
  /** `outline` is the nothing-yet state: no fill, no shadow, and no shimmer —
   *  shimmer means "working" and must not also mean "empty". */
  variant?: "page" | "skeleton" | "outline";
  /** `half` is one page of a facing pair. */
  size?: keyof typeof SIZE;
  /** Which side of the spine this page sits on. Draws the gutter shadow. */
  side?: "verso" | "recto";
  children?: ReactNode;
}) {
  const spine = side === "verso" ? "spine-verso" : side === "recto" ? "spine-recto" : "";
  return (
    <div
      data-page={page}
      style={{ aspectRatio: String(aspect) }}
      className={
        variant === "outline"
          ? `${BASE} ${SIZE[size]} grid place-items-center px-6 text-center`
          : `${BASE} ${SIZE[size]} page-edge bg-paper shadow-page ${spine}`
      }
    >
      {variant === "skeleton" ? (
        <div className="h-full w-full animate-shimmer bg-linear-to-r from-transparent via-hairline/70 to-transparent" />
      ) : (
        children
      )}
    </div>
  );
}
