import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import PlatformShowdown from "../PlatformShowdown";
import { SongData } from "@/types";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
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

const spotifyData = {
  id: "sp1",
  name: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  albumArt: "https://example.com/art.jpg",
  releaseDate: "2023-01-01",
  popularity: 85,
  totalStreams: "2,400,000,000",
  playlistCount: 45000,
  previewUrl: null,
  externalUrl: "https://open.spotify.com/track/sp1",
};

const youtubeData = {
  videoId: "yt1",
  title: "Test Song MV",
  thumbnail: "https://example.com/thumb.jpg",
  publishedAt: "2023-01-01T00:00:00Z",
  viewCount: "1,500,000,000",
  likeCount: "15,000,000",
  commentCount: "2,300,000",
  channelTitle: "TestVEVO",
  externalUrl: "https://youtube.com/watch?v=yt1",
};

describe("PlatformShowdown", () => {
  it("renders nothing when spotify is missing", () => {
    const { container } = render(<PlatformShowdown song={makeSong({ youtube: youtubeData })} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when youtube is missing", () => {
    const { container } = render(<PlatformShowdown song={makeSong({ spotify: spotifyData })} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the showdown when both platforms are present", () => {
    render(<PlatformShowdown song={makeSong({ spotify: spotifyData, youtube: youtubeData })} />);
    expect(screen.getByText("Platform Showdown")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
  });

  it("shows correct verdict for spotify-dominant song", () => {
    render(<PlatformShowdown song={makeSong({ spotify: spotifyData, youtube: youtubeData })} />);
    // 2.4B streams vs 1.5B views → Spotify leaning
    expect(screen.getByText(/Spotify Leaning/)).toBeInTheDocument();
  });

  it("shows metric labels", () => {
    render(<PlatformShowdown song={makeSong({ spotify: spotifyData, youtube: youtubeData })} />);
    expect(screen.getByText("Reach")).toBeInTheDocument();
    expect(screen.getByText("Engagement")).toBeInTheDocument();
    expect(screen.getByText("Discussion")).toBeInTheDocument();
  });

  it("shows win counts", () => {
    render(<PlatformShowdown song={makeSong({ spotify: spotifyData, youtube: youtubeData })} />);
    const winLabels = screen.getAllByText("wins");
    expect(winLabels).toHaveLength(2);
  });

  it("renders balanced verdict when platforms are close", () => {
    const balancedYT = { ...youtubeData, viewCount: "2,300,000,000" };
    render(<PlatformShowdown song={makeSong({ spotify: spotifyData, youtube: balancedYT })} />);
    expect(screen.getByText(/Balanced Presence/)).toBeInTheDocument();
  });
});
