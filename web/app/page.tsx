import type { Metadata } from "next";
import { Newsreader, Spectral } from "next/font/google";
import Link from "next/link";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description:
    "Ubah manuskrip Markdown jadi PDF ebook dengan tipografi penerbit. Justified, baseline grid, running head, chapter opener — tanpa InDesign.",
};

export default function LandingPage() {
  return (
    <div className={`${newsreader.variable} ${spectral.variable}`}>
      <style>{`
        @keyframes f-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .f-in { animation: f-enter 0.6s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .f-in { animation: none; opacity: 1; } }
      `}</style>
      <Nav />
      <Hero />
      <Transformation />
      <Specimens />
      <Colophon />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-hairline bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-13 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <span
          className="font-display text-lg leading-none tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
        >
          {BRAND_NAME}
        </span>
        <Link
          href="/library"
          className="rounded-md bg-accent px-4 py-2 text-sm text-on-accent transition-transform duration-150 active:scale-[0.98]"
        >
          Buka Editor
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] gap-12 px-5 pb-20 pt-16 sm:px-8 md:grid-cols-[1fr_auto] md:gap-16 md:pt-24 lg:gap-24">
      <div className="max-w-[540px]">
        <p className="f-in text-sm tracking-widest text-muted" style={{ fontVariantCaps: "all-small-caps", animationDelay: "0.1s" }}>
          Typesetting engine untuk penulis
        </p>
        <h1
          className="f-in mt-4 font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1, "opsz" 48', animationDelay: "0.2s" }}
        >
          Manuskrip jadi buku
          <br />
          ter-typeset.
        </h1>
        <p
          className="f-in mt-6 max-w-[46ch] text-lg leading-relaxed text-muted"
          style={{ fontFamily: "var(--font-newsreader), serif", animationDelay: "0.35s" }}
        >
          Tempel Markdown, pilih template. Foliate menyusun halaman dengan
          tipografi penerbit — justified, baseline grid, running head, chapter
          opener — lalu ekspor PDF bersih. Tanpa InDesign. Tanpa kursus layout.
        </p>
        <div className="f-in mt-8 flex flex-wrap gap-3" style={{ animationDelay: "0.5s" }}>
          <Link
            href="/library"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-transform duration-150 active:scale-[0.98]"
          >
            Coba Sekarang
          </Link>
          <a
            href="#specimens"
            className="rounded-md border border-hairline px-5 py-2.5 text-sm text-ink transition-[background-color,transform] duration-150 hover:bg-field active:scale-[0.98]"
          >
            Lihat Template
          </a>
        </div>
      </div>

      {/* Asymmetric book mockup — a rendered page, not a screenshot */}
      <div className="f-in relative hidden md:block" aria-hidden style={{ animationDelay: "0.4s" }}>
        <div className="relative w-[320px] lg:w-[360px]">
          {/* Outer page shadow */}
          <div className="overflow-hidden rounded-sm border border-hairline bg-paper shadow-page">
            <BookPageMockup />
          </div>
          {/* Stacked page hint behind */}
          <div className="absolute -bottom-2 -right-2 -z-10 h-full w-full rounded-sm border border-hairline bg-paper opacity-60" />
          <div className="absolute -bottom-4 -right-4 -z-20 h-full w-full rounded-sm border border-hairline bg-field opacity-40" />
        </div>
      </div>
    </section>
  );
}

function BookPageMockup() {
  return (
    <div
      className="px-10 py-12 lg:px-12 lg:py-14"
      style={{ fontFamily: "var(--font-spectral), serif" }}
    >
      <p className="text-center text-[0.6rem] tracking-[0.2em] text-muted" style={{ fontVariantCaps: "all-small-caps" }}>
        Bab Satu
      </p>
      <h2 className="mt-2 text-center text-xl leading-snug tracking-tight text-ink">
        Mula Kata
      </h2>
      <div className="mt-6 space-y-3 text-[0.7rem] leading-[1.7] text-ink/80" style={{ textAlign: "justify", textIndent: "1.5em" }}>
        <p style={{ textIndent: 0 }}>
          Setiap buku dimulai dari satu kalimat yang ditulis ketika ragu masih
          menggantung. Halaman ini bukan tentang bagaimana menjadi produktif,
          melainkan tentang bagaimana <em>bertahan</em> pada satu pekerjaan cukup
          lama sampai ia berubah menjadi sesuatu yang layak dibaca orang lain.
        </p>
        <p>
          Saya menulis paragraf pertama buku ini di sebuah warung kopi di
          Yogyakarta, pukul lima sore, ketika langit mulai jingga.
        </p>
      </div>
      <p className="mt-8 text-center text-[0.55rem] tracking-wider text-muted/60">
        — 7 —
      </p>
    </div>
  );
}

function Transformation() {
  return (
    <section className="border-t border-hairline bg-field">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 md:py-28">
        <p className="text-sm tracking-widest text-muted" style={{ fontVariantCaps: "all-small-caps" }}>
          Sebelum &amp; sesudah
        </p>
        <h2
          className="mt-3 max-w-[32ch] font-display text-2xl leading-snug tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1' }}
        >
          Dari teks mentah ke halaman yang disetakan.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:gap-8">
          {/* Before — raw markdown */}
          <div>
            <p className="mb-3 text-xs text-muted">Manuskrip (Markdown)</p>
            <div className="overflow-hidden rounded-lg border border-hairline bg-paper p-5 font-mono text-xs leading-relaxed text-ink/70 shadow-page">
              <pre className="whitespace-pre-wrap">{`---
title: Menulis di Tepi Senja
subtitle: Catatan Kecil tentang Kerja
author: Ratna Kusumaningrum
---

# Mula Kata

Setiap buku dimulai dari satu kalimat
yang ditulis ketika ragu masih
menggantung.

> Waktu yang tepat tidak pernah datang.
> Yang datang hanyalah waktu yang biasa.`}</pre>
            </div>
          </div>

          {/* After — typeset page */}
          <div>
            <p className="mb-3 text-xs text-muted">Hasil (PDF)</p>
            <div className="overflow-hidden rounded-lg border border-hairline bg-paper shadow-page">
              <BookPageMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Specimens() {
  return (
    <section id="specimens" className="border-t border-hairline">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 md:py-28">
        <p className="text-sm tracking-widest text-muted" style={{ fontVariantCaps: "all-small-caps" }}>
          Tiga template bawaan
        </p>
        <h2
          className="mt-3 max-w-[36ch] font-display text-2xl leading-snug tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1' }}
        >
          Tipografi penerbit, bukan template Word.
        </h2>
        <p
          className="mt-4 max-w-[52ch] leading-relaxed text-muted"
          style={{ fontFamily: "var(--font-newsreader), serif" }}
        >
          Setiap template dirancang untuk trim size standar percetakan, dengan margin
          asimetris, running head, dan chapter opener yang presisi.
        </p>

        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          <SpecimenCard
            name="Literary"
            font="Spectral"
            desc="Serif klasik dengan small caps, sunk chapter opener, dan asterism scene break. Untuk fiksi sastra dan esai."
            specimen={
              <div style={{ fontFamily: "var(--font-spectral), serif" }}>
                <p className="text-center text-[0.55rem] tracking-[0.15em] text-muted" style={{ fontVariantCaps: "all-small-caps" }}>
                  Bab Satu
                </p>
                <p className="mt-1 text-center text-sm tracking-tight">Mula Kata</p>
                <p className="mt-3 text-[0.65rem] leading-[1.65] text-ink/70" style={{ textAlign: "justify" }}>
                  Setiap buku dimulai dari satu kalimat yang ditulis ketika ragu masih
                  menggantung.
                </p>
              </div>
            }
          />
          <SpecimenCard
            name="Manuscript"
            font="Source Serif 4"
            desc="Old-style figures, hairline chapter dividers, dan en-dash list markers. Untuk nonfiksi, memoir, dan how-to."
            specimen={
              <div style={{ fontFamily: "var(--font-newsreader), serif" }}>
                <p className="text-center text-[0.55rem] tracking-[0.25em] text-muted uppercase">
                  Satu
                </p>
                <div className="mx-auto my-2 h-px w-12 bg-hairline" />
                <p className="mt-1 text-center text-sm tracking-tight">Mula Kata</p>
                <p className="mt-3 text-[0.65rem] leading-[1.65] text-ink/70" style={{ textAlign: "justify" }}>
                  Saya menulis paragraf pertama buku ini di sebuah warung kopi di Yogyakarta.
                </p>
              </div>
            }
          />
          <SpecimenCard
            name="Contemporary"
            font="Libre Baskerville + Barlow"
            desc="Block paragraphs, oxblood bar scene break, dan large numeral chapter opener. Untuk buku bisnis dan self-help."
            specimen={
              <div>
                <p
                  className="text-3xl font-light tracking-tight text-ink/20"
                  style={{ fontFamily: "var(--font-geist), sans-serif" }}
                >
                  01
                </p>
                <p className="mt-1 text-sm font-medium tracking-tight" style={{ fontFamily: "var(--font-geist), sans-serif" }}>
                  Mula Kata
                </p>
                <p className="mt-3 text-[0.65rem] leading-[1.65] text-ink/70" style={{ fontFamily: "var(--font-newsreader), serif" }}>
                  Memulai adalah bagian yang paling sering dibesar-besarkan.
                </p>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}

function SpecimenCard({
  name,
  font,
  desc,
  specimen,
}: {
  name: string;
  font: string;
  desc: string;
  specimen: React.ReactNode;
}) {
  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-hairline bg-paper p-6 shadow-page sm:p-8">
        {specimen}
      </div>
      <h3 className="mt-4 text-base tracking-tight">{name}</h3>
      <p className="mt-0.5 font-mono text-2xs text-muted">{font}</p>
      <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-muted">{desc}</p>
    </div>
  );
}

function Colophon() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1fr_auto]">
          <div>
            <span
              className="font-display text-xl leading-none tracking-tight text-ink"
              style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
            >
              {BRAND_NAME}
            </span>
            <p
              className="mt-3 max-w-[42ch] text-sm leading-relaxed text-muted"
              style={{ fontFamily: "var(--font-newsreader), serif" }}
            >
              Typesetting engine untuk penulis Indonesia. Markdown masuk,
              buku keluar. Gratis selama v0.
            </p>
          </div>

          <div className="flex flex-col gap-6 text-sm md:items-end md:text-right">
            <div>
              <p className="text-xs tracking-widest text-muted" style={{ fontVariantCaps: "all-small-caps" }}>
                Kolofon
              </p>
              <p className="mt-1.5 max-w-[32ch] font-mono text-2xs leading-relaxed text-muted">
                Disusun dengan Typst. Display: Fraunces. Body: Newsreader,
                Spectral, Source Serif 4, Libre Baskerville. Sans: Geist.
              </p>
            </div>
            <div>
              <p className="text-xs tracking-widest text-muted" style={{ fontVariantCaps: "all-small-caps" }}>
                Plate
              </p>
              <p className="font-mono text-2xs text-muted">
                v0 · {BRAND_NAME} · 2026
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-hairline pt-6">
          <p className="font-mono text-2xs text-muted/60">
            Hak cipta template dilisensikan bersama hasil kompilasinya.
          </p>
        </div>
      </div>
    </footer>
  );
}
