import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import QuickStats from "../QuickStats";
import { SongData } from "@/types";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function makeSong(overrides: Partial<SongData> = {}): SongData {
  return {
    id: "test-1",
    title: "Test Song",
    artist: "Test Artist",
    albumArt: "https://example.com/art.jpg",
    releaseDate: "2023-01-01",
    spotify: null,
    youtube: null,
    billboard: null,
    genius: null,
    timeline: [],
    ...overrides,
  };
}

describe("QuickStats", () => {
  it("renders nothing when no platform data is available", () => {
    const { container } = render(<QuickStats song={makeSong()} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows Spotify streams abbreviated", () => {
    const song = makeSong({
      spotify: {
        id: "sp-1",
        name: "Test",
        artist: "Test",
        album: "Test Album",
        albumArt: "https://example.com/art.jpg",
        releaseDate: "2023-01-01",
        popularity: 85,
        totalStreams: "2,400,000,000",
        playlistCount: 50000,
        previewUrl: null,
        externalUrl: "https://spotify.com/track/1",
      },
    });
    render(<QuickStats song={song} />);
    expect(screen.getByText("2.4B")).toBeInTheDocument();
    expect(screen.getByText("Streams")).toBeInTheDocument();
  });

  it("shows YouTube views abbreviated", () => {
    const song = makeSong({
      youtube: {
        videoId: "yt-1",
        title: "Test",
        thumbnail: "https://example.com/thumb.jpg",
        publishedAt: "2023-01-01T00:00:00Z",
        viewCount: "770,000,000",
        likeCount: "15,000,000",
        commentCount: "500,000",
        channelTitle: "TestVEVO",
        externalUrl: "https://youtube.com/watch?v=yt-1",
      },
    });
    render(<QuickStats song={song} />);
    expect(screen.getByText("770M")).toBeInTheDocument();
    expect(screen.getByText("Views")).toBeInTheDocument();
  });

  it("shows Billboard peak and weeks on chart", () => {
    const song = makeSong({
      billboard: {
        peakPosition: 1,
        peakDate: "2023-03-01",
        weeksOnChart: 90,
        entryPosition: 45,
        entryDate: "2023-01-14",
        chartHistory: [],
      },
    });
    render(<QuickStats song={song} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("Peak")).toBeInTheDocument();
    expect(screen.getByText("Weeks on Chart")).toBeInTheDocument();
  });

  it("shows Genius page views", () => {
    const song = makeSong({
      genius: {
        id: 12345,
        title: "Test",
        artist: "Test",
        albumArt: "https://example.com/art.jpg",
        pageViews: "5,200,000",
        annotationCount: 42,
        lyricsUrl: "https://genius.com/test",
        description: "A test song",
        releaseDate: "January 1, 2023",
      },
    });
    render(<QuickStats song={song} />);
    expect(screen.getByText("5.2M")).toBeInTheDocument();
    expect(screen.getByText("Page Views")).toBeInTheDocument();
  });

  it("renders all stats for a fully-loaded song", () => {
    const song = makeSong({
      spotify: {
        id: "sp-1", name: "Test", artist: "Test", album: "Album",
        albumArt: "https://example.com/art.jpg", releaseDate: "2023-01-01",
        popularity: 85, totalStreams: "1,000,000", playlistCount: 100,
        previewUrl: null, externalUrl: "https://spotify.com/track/1",
      },
      youtube: {
        videoId: "yt-1", title: "Test", thumbnail: "https://example.com/thumb.jpg",
        publishedAt: "2023-01-01T00:00:00Z", viewCount: "500,000",
        likeCount: "10,000", commentCount: "1,000", channelTitle: "Test",
        externalUrl: "https://youtube.com/watch?v=yt-1",
      },
      billboard: {
        peakPosition: 5, peakDate: "2023-03-01", weeksOnChart: 20,
        entryPosition: 50, entryDate: "2023-01-14", chartHistory: [],
      },
      genius: {
        id: 1, title: "Test", artist: "Test", albumArt: "https://example.com/art.jpg",
        pageViews: "800,000", annotationCount: 10, lyricsUrl: "https://genius.com/test",
        description: "Test", releaseDate: "January 1, 2023",
      },
    });
    render(<QuickStats song={song} />);
    // 5 stat items: Streams, Views, Peak, Weeks on Chart, Page Views
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
  });

  it("has accessible role attributes", () => {
    const song = makeSong({
      spotify: {
        id: "sp-1", name: "Test", artist: "Test", album: "Album",
        albumArt: "https://example.com/art.jpg", releaseDate: "2023-01-01",
        popularity: 85, totalStreams: "1,000,000", playlistCount: 100,
        previewUrl: null, externalUrl: "https://spotify.com/track/1",
      },
    });
    render(<QuickStats song={song} />);
    expect(screen.getByRole("list")).toHaveAttribute("aria-label", "Quick performance stats");
  });
});
