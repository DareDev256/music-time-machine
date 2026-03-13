import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import Script from "next/script";
import ThemeProvider from "@/components/ThemeProvider";
import PrefsProvider from "@/components/PrefsProvider";
import Navigation from "@/components/Navigation";
import KeyboardShortcutProvider from "@/components/KeyboardShortcutProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Music Time Machine | Track Any Song Across the Music Ecosystem",
  description:
    "Search any song and see its complete performance timeline across Spotify, YouTube, Billboard, and Genius. Discover chart history, streaming stats, and cultural context.",
  keywords: [
    "music",
    "charts",
    "spotify",
    "youtube",
    "billboard",
    "song analytics",
    "music history",
  ],
  authors: [{ name: "Music Time Machine" }],
  openGraph: {
    title: "Music Time Machine",
    description:
      "Track any song across the music ecosystem - Spotify, YouTube, Billboard, and more.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          nonce={nonce}
        >{`(function(){var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.classList.add(t)}else if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.classList.add('light')}else{document.documentElement.classList.add('dark')}})();`}</Script>
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <PrefsProvider>
            <Navigation />
            <KeyboardShortcutProvider />
            <main className="pt-14">{children}</main>
          </PrefsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
