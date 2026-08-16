// Throwaway node runner for the pure reducer self-check in lib/editor-session.ts.
// Run with:  node .session-check.mjs
// Two things stand between node and that file: extensionless relative imports
// (a sync resolve hook maps them to .ts) and lib/storage.ts opening IndexedDB
// at module scope (stubbed — nothing in the self-check touches the driver).
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(url)) return { url: url.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

globalThis.indexedDB = { open: () => ({}) };

const { selfCheckSession } = await import("./lib/editor-session.ts");
console.log(selfCheckSession());
