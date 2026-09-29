// Theme is a class on <html>, not a media query — the toggle has to be able to
// override the OS. tokens.css declares `@custom-variant dark (&:where(.dark, .dark *))`.
export type Theme = "light" | "dark";
export const THEME_KEY = "foliate-theme";

/** Runs before first paint to avoid a flash of the wrong palette. Inlined into
 *  <head> by app/layout.tsx; keep it dependency-free and synchronous. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

/** Theme swaps recolor almost every node. Transitions on those properties smear
 *  the flip; disable them for one frame, then restore. */
export function suppressThemeTransitions() {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  void document.documentElement.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => style.remove());
  });
}
