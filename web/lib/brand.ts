// Single source of the product name and user-facing chrome copy.
// BUILD-PLAN §3: no hardcoded "Foliate" strings in components.
// Copy is Indonesian (BUILD-PLAN §6); identifiers and comments are English.

export const BRAND_NAME = "Foliate";
export const BRAND_TAGLINE = "Manuskrip jadi buku ter-typeset.";

export const COPY = {
  // library
  libraryTitle: "Proyek",
  libraryLoading: "Memuat proyek…",
  libraryEmptyTitle: "Belum ada proyek.",
  libraryEmptyBody: "Mulai dari manuskrip contoh, atau tempel Markdown-mu sendiri.",
  newProject: "Proyek baru",
  openSample: "Buka contoh",
  untitled: "Tanpa judul",

  // editor
  editorPlaceholder: "Tempel teks, atau tarik file .md ke sini.",
  previewEmpty: "Halaman akan muncul di sini.",
  export: "Ekspor",

  // save state — muted prose beside the title, never a badge or a toast
  saving: "Menyimpan…",
  saved: "Tersimpan",
  saveFailed: "Gagal menyimpan",
  retry: "Coba lagi",

  // chrome
  themeToLight: "Ganti ke mode terang",
  themeToDark: "Ganti ke mode gelap",
  account: "Akun",
  backToLibrary: "Kembali ke daftar proyek",

  // errors — inline and human-readable, never a stack trace (HANDOFF §6.6)
  loadFailed: "Gagal memuat proyek.",
  compileServiceDown: "Layanan compile tidak merespons. Pastikan compile-service jalan.",
  notConfigured: "Driver penyimpanan ini belum dikonfigurasi.",
} as const;

/** Relative save-state prose: "Tersimpan 4 menit lalu". */
export function savedAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return COPY.saved;
  const m = Math.round(s / 60);
  if (m < 60) return `${COPY.saved} ${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${COPY.saved} ${h} jam lalu`;
  return `${COPY.saved} ${Math.round(h / 24)} hari lalu`;
}

/** Library card timestamp: "Diubah 2 jam lalu". */
export function changedAgo(at: number, now = Date.now()): string {
  return savedAgo(at, now).replace(COPY.saved, "Diubah").replace(/^Diubah$/, "Diubah baru saja");
}
