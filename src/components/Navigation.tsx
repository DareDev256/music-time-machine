"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Music, Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function Navigation() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-[#FC3C44] rounded-lg flex items-center justify-center">
              <Music className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              Music Time Machine
            </span>
          </Link>

          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4.5 h-4.5 text-gray-400 hover:text-gray-200" />
            ) : (
              <Moon className="w-4.5 h-4.5 text-gray-500 hover:text-gray-700" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
