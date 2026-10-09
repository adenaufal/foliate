"use client";

import { useEffect, useState } from "react";
// Per-icon imports: the barrel is thousands of modules and slows dev compiles.
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { COPY } from "@/lib/brand";
import { THEME_EVENT, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  // Starts null so the first client render matches the server HTML; the real
  // value comes from the class THEME_INIT_SCRIPT already applied.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const read = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    // The command palette flips the theme too; the label follows either way.
    window.addEventListener(THEME_EVENT, read);
    return () => window.removeEventListener(THEME_EVENT, read);
  }, []);

  const label = theme === "dark" ? COPY.themeToLight : COPY.themeToDark;

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      title={label}
      aria-label={label}
      className="btn-icon"
    >
      {/* Both are rendered; CSS picks one, so there is no hydration mismatch
          and no flash while `theme` resolves. */}
      <SunIcon size={17} weight="regular" className="col-start-1 row-start-1 dark:hidden" aria-hidden />
      <MoonIcon size={17} weight="regular" className="col-start-1 row-start-1 hidden dark:block" aria-hidden />
    </button>
  );
}
