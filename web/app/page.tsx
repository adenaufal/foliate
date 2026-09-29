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
    "Ubah manuskrip Markdown jadi PDF ebook dengan tipografi penerbit. Justified, baseline grid, running head, chapter opener. Tanpa InDesign.",
};

export default function LandingPage() {
  return (
    <div className={`${newsreader.variable} ${spectral.variable}`}>
      <Nav />
      <main id="main">
        <Hero />
        <Transformation />
        <Specimens />
      </main>
      <Colophon />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-[var(--z-nav)] border-b border-hairline bg-paper/90 pt-safe backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-wide">
        <span
          translate="no"
          className="font-display text-lg leading-none tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
        >
          {BRAND_NAME}
        </span>
        <Link href="/library" className="btn btn-ghost">
          Editor
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] items-start gap-10 px-wide pb-16 pt-12 sm:pb-20 sm:pt-16 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16 md:pt-20 lg:gap-20">
      <div className="min-w-0 max-w-[540px]">
        <p
          className="text-sm text-muted"
          style={{ fontVariantCaps: "all-small-caps", letterSpacing: "0.12em" }}
        >
          Typesetting engine untuk penulis
        </p>
        <h1
          className="mt-3 font-display text-[clamp(2rem,7vw,3.25rem)] leading-[1.12] tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1' }}
        >
          Manuskrip jadi buku ter-typeset.
        </h1>
        <p
          className="mt-5 max-w-[42ch] text-lg leading-relaxed text-muted"
          style={{ fontFamily: "var(--font-newsreader), serif" }}
        >
          Tempel Markdown, pilih template. Foliate menyusun halaman penerbit, lalu ekspor PDF bersih.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/library" className="btn btn-primary">
            Coba sekarang
          </Link>
          <a href="#specimens" className="btn btn-ghost">
            Lihat template
          </a>
        </div>
      </div>

      <div className="relative mx-auto w-[min(100%,280px)] md:mx-0 md:w-[320px] lg:w-[360px]" aria-hidden>
        <div className="relative">
          <div className="page-edge overflow-hidden rounded-sm border border-hairline bg-paper shadow-page">
            <BookPageMockup />
          </div>
          <div className="absolute -right-2 -bottom-2 -z-10 h-full w-full rounded-sm border border-hairline bg-paper opacity-60" />
          <div className="absolute -right-4 -bottom-4 -z-20 h-full w-full rounded-sm border border-hairline bg-field opacity-40" />
        </div>
      </div>
    </section>
  );
}

function BookPageMockup() {
  return (
    <div
      className="px-8 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14"
      style={{ fontFamily: "var(--font-spectral), serif" }}
    >
      <p className="text-center text-[0.6rem] tracking-[0.2em] text-muted" style={{ fontVariantCaps: "all-small-caps" }}>
        Bab Satu
      </p>
      <h2 className="mt-2 text-center text-xl leading-snug tracking-tight text-ink">Mula Kata</h2>
      <div className="mt-6 space-y-3 text-[0.7rem] leading-[1.7] text-ink/80" style={{ textAlign: "justify", textIndent: "1.5em" }}>
        <p style={{ textIndent: 0 }}>
          Setiap buku dimulai dari satu kalimat yang ditulis ketika ragu masih menggantung. Halaman
          ini bukan tentang bagaimana menjadi produktif, melainkan tentang bagaimana <em>bertahan</em>{" "}
          pada satu pekerjaan cukup lama sampai ia berubah menjadi sesuatu yang layak dibaca orang
          lain.
        </p>
        <p>
          Saya menulis paragraf pertama buku ini di sebuah warung kopi di Yogyakarta, pukul lima
          sore, ketika langit mulai jingga.
        </p>
      </div>
      <p className="mt-8 text-center text-[0.55rem] tracking-wider text-muted/60">- 7 -</p>
    </div>
  );
}

function Transformation() {
  return (
    <section className="border-t border-hairline bg-field">
      <div className="mx-auto max-w-[1200px] px-wide py-16 sm:py-20 md:py-28">
        <h2
          className="max-w-[28ch] font-display text-2xl leading-snug tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1' }}
        >
          Dari teks mentah ke halaman yang disetakan.
        </h2>

        <div className="mt-10 grid gap-8 md:grid-cols-2 md:gap-10">
          <div className="min-w-0">
            <p className="mb-3 text-xs text-muted">Manuskrip (Markdown)</p>
            <div className="overflow-hidden rounded-lg border border-hairline bg-paper p-4 font-mono text-xs leading-relaxed text-ink/70 shadow-page sm:p-5">
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

          <div className="min-w-0">
            <p className="mb-3 text-xs text-muted">Hasil (PDF)</p>
            <div className="page-edge overflow-hidden rounded-lg border border-hairline bg-paper shadow-page">
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
    <section id="specimens" className="scroll-mt-20 border-t border-hairline">
      <div className="mx-auto max-w-[1200px] px-wide py-16 sm:py-20 md:py-28">
        <h2
          className="max-w-[32ch] font-display text-2xl leading-snug tracking-tight text-ink"
          style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1' }}
        >
          Tipografi penerbit, bukan template Word.
        </h2>
        <p
          className="mt-4 max-w-[52ch] leading-relaxed text-muted"
          style={{ fontFamily: "var(--font-newsreader), serif" }}
        >
          Setiap template dirancang untuk trim percetakan, dengan margin asimetris, running head,
          dan chapter opener yang presisi.
        </p>

        <div className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:pb-0">
          <SpecimenCard
            name="Literary"
            font="Spectral"
            desc="Serif klasik dengan small caps, sunk chapter opener, dan asterism scene break. Untuk fiksi sastra dan esai."
            specimen={
              <div style={{ fontFamily: "var(--font-spectral), serif" }}>
                <p
                  className="text-center text-[0.55rem] tracking-[0.15em] text-muted"
                  style={{ fontVariantCaps: "all-small-caps" }}
                >
                  Bab Satu
                </p>
                <p className="mt-1 text-center text-sm tracking-tight">Mula Kata</p>
                <p className="mt-3 text-[0.65rem] leading-[1.65] text-ink/70" style={{ textAlign: "justify" }}>
                  Setiap buku dimulai dari satu kalimat yang ditulis ketika ragu masih menggantung.
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
                <p className="text-center text-[0.55rem] tracking-[0.25em] text-muted uppercase">Satu</p>
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
                <p
                  className="mt-1 text-sm font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-geist), sans-serif" }}
                >
                  Mula Kata
                </p>
                <p
                  className="mt-3 text-[0.65rem] leading-[1.65] text-ink/70"
                  style={{ fontFamily: "var(--font-newsreader), serif" }}
                >
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
    <article className="w-[min(78vw,20rem)] shrink-0 snap-start md:w-auto">
      <div className="page-edge overflow-hidden rounded-sm border border-hairline bg-paper p-6 shadow-page sm:p-8">
        {specimen}
      </div>
      <h3 className="mt-4 text-base tracking-tight">{name}</h3>
      <p className="mt-0.5 font-mono text-2xs text-muted">{font}</p>
      <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-muted">{desc}</p>
    </article>
  );
}

function Colophon() {
  return (
    <footer className="border-t border-hairline pb-[max(1rem,var(--safe-bottom))]">
      <div className="mx-auto max-w-[1200px] px-wide py-14 sm:py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:gap-12">
          <div>
            <span
              translate="no"
              className="font-display text-xl leading-none tracking-tight text-ink"
              style={{ fontVariationSettings: '"SOFT" 40, "WONK" 1' }}
            >
              {BRAND_NAME}
            </span>
            <p
              className="mt-3 max-w-[42ch] text-sm leading-relaxed text-muted"
              style={{ fontFamily: "var(--font-newsreader), serif" }}
            >
              Typesetting engine untuk penulis Indonesia. Markdown masuk, buku keluar. Gratis selama
              v0.
            </p>
          </div>

          <div className="flex flex-col gap-6 text-sm md:items-end md:text-right">
            <div>
              <p className="text-xs text-muted" style={{ fontVariantCaps: "all-small-caps", letterSpacing: "0.12em" }}>
                Kolofon
              </p>
              <p className="mt-1.5 max-w-[32ch] font-mono text-2xs leading-relaxed text-muted">
                Disusun dengan Typst. Display: Fraunces. Body: Newsreader, Spectral, Source Serif 4,
                Libre Baskerville. Sans: Geist.
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
