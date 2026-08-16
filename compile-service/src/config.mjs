// Foliate compile service — central config.
// Brand name is LOCKED (handoff §9) and lives in exactly one place.
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const BRAND_NAME = "Foliate";

const __dir = dirname(fileURLToPath(import.meta.url));
export const SERVICE_ROOT = resolve(__dir, ".."); // compile-service/
export const TEMPLATES_DIR = resolve(SERVICE_ROOT, "templates");
export const FONTS_DIR = resolve(SERVICE_ROOT, "fonts");

// Resolve a binary: explicit env var wins, else assume it's on PATH (Linux
// container), else fall back to known Windows dev install paths.
function resolveBinary(envVar, bareName, devCandidates) {
  const fromEnv = process.env[envVar];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const c of devCandidates) {
    if (existsSync(c)) return c;
  }
  // container/PATH case: trust the bare name, let spawn resolve it
  return bareName;
}

const HOME = process.env.USERPROFILE || process.env.HOME || "";

export const TYPST_BIN = resolveBinary("TYPST_BIN", "typst", [
  `${HOME}\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Typst.Typst_Microsoft.Winget.Source_8wekyb3d8bbwe\\typst-x86_64-pc-windows-msvc\\typst.exe`,
]);

export const PANDOC_BIN = resolveBinary("PANDOC_BIN", "pandoc", [
  `${HOME}\\AppData\\Local\\Pandoc\\pandoc.exe`,
]);

// Compile limits
export const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS ?? 45_000);
export const MAX_MARKDOWN_BYTES = Number(process.env.MAX_MARKDOWN_BYTES ?? 2 * 1024 * 1024); // ~2MB (handoff §5)
// Room for the base64 payloads that ride along with the markdown: docx source,
// extracted images, uploaded fonts. base64 inflates ~33%, so this is ~18MB of
// real bytes shared across all of them.
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 24 * 1024 * 1024);
export const PORT = Number(process.env.PORT ?? 8723);
