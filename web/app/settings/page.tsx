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
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
        <h1 className="text-xl tracking-tight">Pengaturan</h1>
        <dl className="mt-6 max-w-[65ch] divide-y divide-hairline border-t border-hairline text-sm">
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted">Penyimpanan</dt>
            <dd>Lokal — proyek disimpan di peramban ini, bukan di server.</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted">Ekspor</dt>
            <dd>Berkas ditulis lewat dialog simpan; kamu yang pilih foldernya.</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted">Compile</dt>
            <dd>Typst berjalan di layanan lokal; tidak ada manuskrip yang dikirim keluar.</dd>
          </div>
        </dl>
        <p className="mt-8 font-mono text-2xs text-muted">{BRAND_NAME} · v0</p>
      </div>
    </AppShell>
  );
}
