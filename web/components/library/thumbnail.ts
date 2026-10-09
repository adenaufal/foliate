// Library card art. The card is the project's first rendered page, so the
// render has to be cached — a library of twelve projects must never fire twelve
// compiles on load (UI-REFERENCE, project library).
import { storage } from "@/lib/storage";

/** Card art is ~140–260 CSS px wide; anything larger is bytes in IndexedDB for
 *  no visible gain. */
const THUMB_WIDTH = 320;

/**
 * Cache the first page of a fresh compile as this project's card art, and the
 * page count beside it. Call it once per successful compile from whoever owns
 * the pdf.js canvas — the library itself never compiles. Failures are
 * swallowed: this is a cache, and a missing one degrades to the typographic
 * placeholder.
 */
export async function cacheThumbnail(
  projectId: string,
  page: HTMLCanvasElement,
  pageCount?: number,
): Promise<void> {
  if (!page.width || !page.height) return;
  try {
    const small = document.createElement("canvas");
    small.width = THUMB_WIDTH;
    small.height = Math.round((page.height / page.width) * THUMB_WIDTH);
    small.getContext("2d")?.drawImage(page, 0, 0, small.width, small.height);
    // Card art is a cache, not an edit: carrying the stored timestamp forward
    // keeps `Diubah …` honest and stops a merely-opened project floating to the
    // top of the library.
    const current = await storage.get(projectId);
    if (!current) return;
    await storage.update(projectId, {
      thumbnail: small.toDataURL("image/webp", 0.72),
      ...(pageCount ? { pageCount } : {}),
      updatedAt: current.updatedAt,
    });
  } catch {
    // no card art this time; the placeholder covers it
  }
}
