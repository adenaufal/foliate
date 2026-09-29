// One sheet in the stack. Geometry is identical across the three preview
// states so the page never changes size when a compile lands (UI-REFERENCE,
// preview pane): 92% of the pane capped at 620px, trim aspect, hairline border,
// shadow tinted to the field hue via --shadow-page.

import type { ReactNode } from "react";

/** Vertical gutter between sheets, in px. `gap-6` on the stack — kept here
 *  because the page pill derives its pitch from it. */
export const GUTTER = 24;

const BASE = "w-[92%] max-w-[620px] shrink-0 overflow-hidden border border-hairline";

export function Sheet({
  aspect,
  page,
  variant = "page",
  children,
}: {
  aspect: number;
  /** 1-based page number; also the IntersectionObserver handle. */
  page?: number;
  /** `outline` is the nothing-yet state: no fill, no shadow, and no shimmer —
   *  shimmer means "working" and must not also mean "empty". */
  variant?: "page" | "skeleton" | "outline";
  children?: ReactNode;
}) {
  return (
    <div
      data-page={page}
      style={{ aspectRatio: String(aspect) }}
      className={
        variant === "outline"
          ? `${BASE} grid place-items-center px-6 text-center`
          : `${BASE} page-edge bg-paper shadow-page`
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
