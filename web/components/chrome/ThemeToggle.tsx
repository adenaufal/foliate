"use client";

import { useEffect, useState } from "react";
// Per-icon imports: the barrel is thousands of modules and slows dev compiles.
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { COPY } from "@/lib/brand";
import { suppressThemeTransitions, THEME_KEY, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  // Starts null so the first client render matches the server HTML; the real
  // value comes from the class THEME_INIT_SCRIPT already applied.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    suppressThemeTransitions();
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // private mode — the toggle still works for this session
    }
    setTheme(next);
  }

  const label = theme === "dark" ? COPY.themeToLight : COPY.themeToDark;

  return (
    <button
      type="button"
      onClick={toggle}
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
