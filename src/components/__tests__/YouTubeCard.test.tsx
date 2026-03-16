import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import YouTubeCard from "../YouTubeCard";
import type { YouTubeData } from "@/types";

// Mock next/image — jsdom can't handle Next's optimized images
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock lucide-react ExternalLink used by PlatformCard
vi.mock("lucide-react", () => ({
  ExternalLink: () => <svg data-testid="external-link-icon" />,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeYouTubeData = (overrides?: Partial<YouTubeData>): YouTubeData => ({
  videoId: "dQw4w9WgXcQ",
  title: "Never Gonna Give You Up (Official Video)",
  thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  publishedAt: "2009-10-25T06:57:33Z",
  viewCount: "1,500,000,000",
  likeCount: "15,000,000",
  commentCount: "2,300,000",
  channelTitle: "Rick Astley",
  externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("YouTubeCard", () => {
  it("renders the YouTube platform header", () => {
    render(<YouTubeCard data={makeYouTubeData()} />);
    expect(screen.getByText("YouTube")).toBeInTheDocument();
  });

  it("renders all stat rows with correct labels and values", () => {
    const data = makeYouTubeData();
    render(<YouTubeCard data={data} />);

    expect(screen.getByText("Total Views")).toBeInTheDocument();
    expect(screen.getByText("1,500,000,000")).toBeInTheDocument();

    expect(screen.getByText("Likes")).toBeInTheDocument();
    expect(screen.getByText("15,000,000")).toBeInTheDocument();

    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("2,300,000")).toBeInTheDocument();

    expect(screen.getByText("Channel")).toBeInTheDocument();
    expect(screen.getByText("Rick Astley")).toBeInTheDocument();
  });

  it("renders thumbnail image with correct src and alt text", () => {
    const data = makeYouTubeData();
    render(<YouTubeCard data={data} />);

    const img = screen.getByAltText("Never Gonna Give You Up (Official Video)");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
    );
  });

  it("renders play button overlay inside the thumbnail area", () => {
    const { container } = render(<YouTubeCard data={makeYouTubeData()} />);

    // The play button is an SVG with the triangular play path "M8 5v14l11-7z"
    const playPaths = container.querySelectorAll('path[d="M8 5v14l11-7z"]');
    expect(playPaths.length).toBe(1);

    // Play button sits inside a red circle
    const redCircle = playPaths[0]?.closest(".bg-red-600");
    expect(redCircle).toBeInTheDocument();
  });

  it("formats publishedAt date in short format (MMM D, YYYY)", () => {
    render(<YouTubeCard data={makeYouTubeData({ publishedAt: "2009-10-25T06:57:33Z" })} />);

    expect(screen.getByText("Published")).toBeInTheDocument();
    // formatDate with SHORT_DATE options → "Oct 25, 2009"
    expect(screen.getByText("Oct 25, 2009")).toBeInTheDocument();
  });

  it("passes external URL to PlatformCard for the outbound link", () => {
    render(<YouTubeCard data={makeYouTubeData()} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back gracefully when publishedAt is unparseable", () => {
    const data = makeYouTubeData({ publishedAt: "not-a-date" });
    render(<YouTubeCard data={data} />);

    // formatDate returns raw string for invalid dates instead of "Invalid Date"
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument();
  });

  it("renders with different video data without bleed-through", () => {
    const data = makeYouTubeData({
      title: "Blinding Lights (Official Video)",
      thumbnail: "https://img.youtube.com/vi/abc123/maxresdefault.jpg",
      viewCount: "900,000,000",
      likeCount: "8,500,000",
      commentCount: "450,000",
      channelTitle: "The Weeknd",
      publishedAt: "2020-01-29T12:00:00Z",
    });
    render(<YouTubeCard data={data} />);

    expect(screen.getByAltText("Blinding Lights (Official Video)")).toBeInTheDocument();
    expect(screen.getByText("900,000,000")).toBeInTheDocument();
    expect(screen.getByText("The Weeknd")).toBeInTheDocument();
    expect(screen.getByText("Jan 29, 2020")).toBeInTheDocument();

    // Ensure no data from default fixture leaks in
    expect(screen.queryByText("Rick Astley")).not.toBeInTheDocument();
  });
});
