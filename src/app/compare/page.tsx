"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Music } from "lucide-react";
import { ComparisonData, SearchResult } from "@/types";
import ComparisonView from "@/components/ComparisonView";
import SafeImage from "@/components/SafeImage";

function CompareContent() {
  const searchParams = useSearchParams();
  const preselected1 = searchParams.get("song1") || "";

  const [song1Id, setSong1Id] = useState(preselected1);
  const [song2Id, setSong2Id] = useState("");
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!song1Id || !song2Id) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/compare?song1=${encodeURIComponent(song1Id)}&song2=${encodeURIComponent(song2Id)}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to compare");
        return;
      }
      const data = await res.json();
      setComparison(data);
    } catch {
      setError("Failed to compare songs");
    } finally {
      setLoading(false);
    }
  }, [song1Id, song2Id]);

  useEffect(() => {
    if (song1Id && song2Id) {
      fetchComparison();
    }
  }, [song1Id, song2Id, fetchComparison]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-14 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">Back</span>
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Compare Songs</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Song Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <SongSelector
            label="Song 1"
            selectedId={song1Id}
            onSelect={setSong1Id}
          />
          <SongSelector
            label="Song 2"
            selectedId={song2Id}
            onSelect={setSong2Id}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <p className="text-accent">{error}</p>
          </div>
        )}

        {/* Results */}
        {comparison && !loading && <ComparisonView data={comparison} />}

        {/* Empty State */}
        {!comparison && !loading && !error && (
          <div className="text-center py-16">
            <Music className="w-16 h-16 text-foreground-secondary/30 mx-auto mb-4" />
            <p className="text-foreground-secondary text-lg">Select two songs to compare</p>
            <p className="text-foreground-secondary/60 text-sm mt-1">
              Search and pick songs from the dropdowns above
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function SongSelector({
  label,
  selectedId,
  onSelect,
}: {
  label: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  // If we have a pre-selected ID, fetch the song info
  useEffect(() => {
    if (selectedId && !selected) {
      fetch(`/api/song/${selectedId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.title) {
            setSelected({
              id: data.id,
              title: data.title,
              artist: data.artist,
              albumArt: data.albumArt,
              releaseDate: data.releaseDate,
            });
          }
        })
        .catch(() => {});
    }
  }, [selectedId, selected]);

  const handleSelect = (result: SearchResult) => {
    setSelected(result);
    onSelect(result.id);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <label className="text-foreground-secondary text-xs uppercase tracking-wider mb-2 block">
        {label}
      </label>

      {selected ? (
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary">
            <SafeImage
              src={selected.albumArt}
              alt={selected.title}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-medium text-sm truncate">{selected.title}</p>
            <p className="text-foreground-secondary text-xs truncate">{selected.artist}</p>
          </div>
          <button
            onClick={() => {
              setSelected(null);
              onSelect("");
            }}
            className="text-foreground-secondary hover:text-foreground text-xs px-2 py-1 rounded hover:bg-background-secondary"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a song..."
            className="w-full pl-10 pr-4 py-3 bg-background-secondary border border-border rounded-xl text-foreground placeholder-foreground-secondary text-sm focus:outline-none focus:border-accent"
          />

          {isOpen && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-10 max-h-60 overflow-auto">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-background-secondary text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary">
                    <SafeImage
                      src={result.albumArt}
                      alt={result.title}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground text-sm truncate">{result.title}</p>
                    <p className="text-foreground-secondary text-xs truncate">{result.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
