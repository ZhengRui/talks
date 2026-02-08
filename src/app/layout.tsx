import type { Metadata } from "next";
import {
  Inter, Playfair_Display, JetBrains_Mono, Archivo_Black, Space_Grotesk,
  Manrope, Syne, Space_Mono, Cormorant, IBM_Plex_Sans,
  Bodoni_Moda, DM_Sans, Plus_Jakarta_Sans, Outfit, Fraunces,
  Work_Sans, Archivo, Nunito, Cormorant_Garamond, Source_Serif_4,
} from "next/font/google";
import "./globals.css";
import "@/styles/engine.css";
import "@/styles/themes/modern.css";
import "@/styles/themes/bold.css";
import "@/styles/themes/elegant.css";
import "@/styles/themes/dark-tech.css";
import "@/styles/themes/bold-signal.css";
import "@/styles/themes/electric-studio.css";
import "@/styles/themes/creative-voltage.css";
import "@/styles/themes/dark-botanical.css";
import "@/styles/themes/notebook-tabs.css";
import "@/styles/themes/pastel-geometry.css";
import "@/styles/themes/split-pastel.css";
import "@/styles/themes/vintage-editorial.css";
import "@/styles/themes/neon-cyber.css";
import "@/styles/themes/terminal-green.css";
import "@/styles/themes/swiss-modern.css";
import "@/styles/themes/paper-ink.css";
import "@/styles/components.css";
import "@/styles/animations.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni-moda",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  weight: ["300", "400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif-4",
  display: "swap",
});

const fontVariables = [
  inter, playfair, jetbrainsMono, archivoBlack, spaceGrotesk,
  manrope, syne, spaceMono, cormorant, ibmPlexSans,
  bodoniModa, dmSans, plusJakartaSans, outfit, fraunces,
  workSans, archivo, nunito, cormorantGaramond, sourceSerif4,
].map(f => f.variable).join(" ");

export const metadata: Metadata = {
  title: "Presentation Hub",
  description: "Rui's talk collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={fontVariables}
    >
      <body>{children}</body>
    </html>
  );
}
