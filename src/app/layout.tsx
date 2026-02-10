import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import Navigation from "@/components/Navigation";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var t = localStorage.getItem('theme');
                if (t === 'light' || t === 'dark') {
                  document.documentElement.classList.add(t);
                } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                  document.documentElement.classList.add('light');
                } else {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <Navigation />
          <main className="pt-14">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
