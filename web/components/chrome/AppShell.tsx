import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "./AccountMenu";
import { ThemeToggle } from "./ThemeToggle";
import { BRAND_NAME, COPY } from "@/lib/brand";

/**
 * App chrome for the library and settings routes. Grid rows, not flex;
 * `100dvh`, not `h-screen` (HANDOFF §6.8).
 *
 * Brand mark, theme, account — nothing route-specific. The editor does not use
 * this shell at all; it owns its own grid and `EditorTopBar`, which is where
 * the bar's single filled button (Ekspor) lives.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] grid-rows-[auto_1fr] bg-paper">
      <header className="sticky top-0 z-20 border-b border-hairline bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-13 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link
            href="/library"
            aria-label={COPY.backToLibrary}
            className="shrink-0 font-display text-lg leading-none tracking-tight text-ink transition-opacity duration-150 hover:opacity-70"
            style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
          >
            {BRAND_NAME}
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* min-h-0/min-w-0 so a route can be `h-full` with its own inner scroll
          instead of growing the page. */}
      <main className="min-h-0 min-w-0">{children}</main>
    </div>
  );
}
