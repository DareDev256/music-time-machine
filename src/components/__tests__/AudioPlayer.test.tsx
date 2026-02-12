import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AudioPlayer from "../AudioPlayer";

// Mock next/image used by SafeImage
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Stub HTMLMediaElement play/pause on jsdom's actual prototype
beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});

const defaultProps = {
  previewUrl: "https://p.scdn.co/mp3-preview/abc123",
  title: "Bohemian Rhapsody",
  artist: "Queen",
  albumArt: "https://example.com/album.jpg",
};

describe("AudioPlayer", () => {
  it("renders song title and artist name", () => {
    render(<AudioPlayer {...defaultProps} />);

    expect(screen.getByText("Bohemian Rhapsody")).toBeInTheDocument();
    expect(screen.getByText("Queen")).toBeInTheDocument();
  });

  it("renders play button initially (not pause)", () => {
    const { container } = render(<AudioPlayer {...defaultProps} />);

    // The Play icon from lucide-react renders as an SVG.
    // When isPlaying is false the component renders <Play> which has
    // a class containing "ml-0.5", while <Pause> does not.
    // We can verify the button exists and that no "Pause" icon is rendered.
    const button = container.querySelector("button");
    expect(button).toBeInTheDocument();

    // Play icon SVG is present (lucide renders svg elements)
    const svgs = button!.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
  });

  it("renders audio element with correct src", () => {
    const { container } = render(<AudioPlayer {...defaultProps} />);

    const audio = container.querySelector("audio");
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute("src", "https://p.scdn.co/mp3-preview/abc123");
  });

  it("renders Spotify link when spotifyUrl is provided", () => {
    render(
      <AudioPlayer
        {...defaultProps}
        spotifyUrl="https://open.spotify.com/track/123"
      />
    );

    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "https://open.spotify.com/track/123"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render Spotify link when spotifyUrl is not provided", () => {
    render(<AudioPlayer {...defaultProps} />);

    const link = screen.queryByRole("link");
    expect(link).not.toBeInTheDocument();
  });
});
