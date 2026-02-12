"use client";

import { motion } from "framer-motion";
import { Filter, Calendar } from "lucide-react";

interface FilterBarProps {
  genres: string[];
  activeGenre: string | null;
  activeEra: string | null;
  onGenreChange: (genre: string | null) => void;
  onEraChange: (era: string | null) => void;
}

const ERAS = ["2010s", "2020s"] as const;

export default function FilterBar({
  genres,
  activeGenre,
  activeEra,
  onGenreChange,
  onEraChange,
}: FilterBarProps) {
  return (
    <motion.div
      className="flex flex-wrap items-center gap-2 mb-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Genre filters */}
      <div className="flex items-center gap-1.5 mr-2">
        <Filter className="w-3.5 h-3.5 text-foreground-secondary" />
        <span className="text-xs text-foreground-secondary font-medium">Genre</span>
      </div>
      {genres.map((genre) => (
        <button
          key={genre}
          onClick={() => onGenreChange(activeGenre === genre ? null : genre)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
            activeGenre === genre
              ? "bg-accent text-white border-accent shadow-sm"
              : "bg-background-secondary text-foreground-secondary border-border hover:border-accent/40 hover:text-foreground"
          }`}
        >
          {genre}
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Era filters */}
      <div className="flex items-center gap-1.5 mr-1">
        <Calendar className="w-3.5 h-3.5 text-foreground-secondary" />
        <span className="text-xs text-foreground-secondary font-medium">Era</span>
      </div>
      {ERAS.map((era) => (
        <button
          key={era}
          onClick={() => onEraChange(activeEra === era ? null : era)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
            activeEra === era
              ? "bg-accent text-white border-accent shadow-sm"
              : "bg-background-secondary text-foreground-secondary border-border hover:border-accent/40 hover:text-foreground"
          }`}
        >
          {era}
        </button>
      ))}

      {/* Clear all */}
      {(activeGenre || activeEra) && (
        <button
          onClick={() => {
            onGenreChange(null);
            onEraChange(null);
          }}
          className="px-3 py-1 rounded-full text-xs font-medium text-accent hover:text-accent/80 transition-colors"
        >
          Clear
        </button>
      )}
    </motion.div>
  );
}
