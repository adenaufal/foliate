import type { Metadata } from "next";
import { Libre_Baskerville, Source_Serif_4, Spectral } from "next/font/google";
import { AppShell } from "@/components/chrome/AppShell";
import { ProjectLibrary } from "@/components/library/ProjectLibrary";
import { COPY } from "@/lib/brand";

const spectral = Spectral({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-spectral",
  display: "swap",
  preload: false,
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  preload: false,
});
const baskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-baskerville",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = { title: COPY.libraryTitle };

export default function LibraryPage() {
  return (
    <AppShell>
      <div className={`${spectral.variable} ${sourceSerif.variable} ${baskerville.variable}`}>
        <ProjectLibrary />
      </div>
    </AppShell>
  );
}
