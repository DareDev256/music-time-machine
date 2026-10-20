import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Display: Archivo with its width axis (condensed 62–80% for titles).
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
// Data and labels.
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono", display: "swap" });
// Seven-segment readouts. DSEG by keshikan, SIL OFL 1.1.
const seg = localFont({ src: "../fonts/DSEG7Classic-Bold.woff2", variable: "--font-seg", display: "block" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://music-time-machine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Was Playing · the music time machine",
  description:
    "Name a song you lived with. Fly back through every #1, week by week, and land in its era: the charts and the internet that week, including songs that were never on Spotify or Apple.",
  openGraph: {
    title: "Was Playing",
    description: "Name a song. Fly back to the week it was playing.",
    type: "website",
    images: [{ url: "/api/card?format=wide", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/api/card?format=wide"] },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable} ${seg.variable}`}>
      <body>{children}</body>
    </html>
  );
}
