import { AppShell } from "@/components/chrome/AppShell";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: "Pengaturan" };

/**
 * The account menu's entry point. v0 is single-user and local-first, so this
 * states where things are kept and stops. Anything configurable — theme in the
 * top bar, template and trim per project — already lives where it is used.
 */
export default function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] px-page py-10 sm:py-12">
        <h1 className="text-2xl tracking-tight">Pengaturan</h1>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted">
          Foliate menyimpan pekerjaanmu di perangkat ini. Template, ukuran halaman, dan tema
          diatur per proyek dari editor.
        </p>
        <dl className="mt-8 max-w-[65ch] divide-y divide-hairline border-y border-hairline text-sm">
          <div className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
            <dt className="text-muted">Penyimpanan</dt>
            <dd className="min-w-0">Lokal. Proyek disimpan di peramban ini, bukan di server.</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
            <dt className="text-muted">Ekspor</dt>
            <dd className="min-w-0">Berkas ditulis lewat dialog simpan; kamu yang pilih foldernya.</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
            <dt className="text-muted">Compile</dt>
            <dd className="min-w-0">Typst berjalan di layanan lokal; tidak ada manuskrip yang dikirim keluar.</dd>
          </div>
        </dl>
        <p translate="no" className="mt-10 font-mono text-2xs text-muted">
          {BRAND_NAME} v0
        </p>
      </div>
    </AppShell>
  );
}
