import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import ComparisonView from "../ComparisonView";
import { ComparisonData, SongData } from "@/types";

// Mock next/image used by SafeImage
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

function makeSong(overrides: Partial<SongData> = {}): SongData {
  return {
    id: "song-1",
    title: "Song One",
    artist: "Artist A",
    albumArt: "https://example.com/art1.jpg",
    releaseDate: "2020-01-01",
    spotify: null,
    youtube: null,
    billboard: null,
    genius: null,
    timeline: [],
    ...overrides,
  };
}

const defaultData: ComparisonData = {
  song1: makeSong({ id: "s1", title: "Stairway to Heaven", artist: "Led Zeppelin" }),
  song2: makeSong({ id: "s2", title: "Hotel California", artist: "Eagles" }),
  insights: [
    {
      metric: "Popularity",
      song1Value: "85",
      song2Value: "90",
      winner: "song2",
    },
    {
      metric: "Danceability",
      song1Value: "0.45",
      song2Value: "0.38",
      winner: "song1",
    },
    {
      metric: "Energy",
      song1Value: "0.70",
      song2Value: "0.70",
      winner: "tie",
    },
  ],
};

describe("ComparisonView", () => {
  it("renders both song titles", () => {
    render(<ComparisonView data={defaultData} />);

    // Each title appears twice: once in the song header column and once in the
    // score summary section, so we use getAllByText.
    const stairwayElements = screen.getAllByText("Stairway to Heaven");
    const hotelElements = screen.getAllByText("Hotel California");

    expect(stairwayElements.length).toBeGreaterThanOrEqual(1);
    expect(hotelElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all insight metric labels", () => {
    render(<ComparisonView data={defaultData} />);

    expect(screen.getByText("Popularity")).toBeInTheDocument();
    expect(screen.getByText("Danceability")).toBeInTheDocument();
    expect(screen.getByText("Energy")).toBeInTheDocument();
  });

  it('shows "Winner" text for winning song in each insight', () => {
    render(<ComparisonView data={defaultData} />);

    // Two insights have a winner (song2 for Popularity, song1 for Danceability).
    // The "tie" insight should NOT render a Winner label.
    const winnerLabels = screen.getAllByText("Winner");
    expect(winnerLabels).toHaveLength(2);
  });

  it("renders score summary section", () => {
    render(<ComparisonView data={defaultData} />);

    expect(screen.getByText("Overall Score")).toBeInTheDocument();
  });

  it("shows correct score counts", () => {
    render(<ComparisonView data={defaultData} />);

    // song1 wins 1 insight (Danceability), song2 wins 1 insight (Popularity).
    // The score summary renders each count in a <p> with text-3xl font-bold.
    // Both scores are "1".
    const scoreSummary = screen.getByText("Overall Score").closest("div")!;

    // song1 score: 1 win
    // song2 score: 1 win
    // Both values appear as "1" inside the summary block.
    const scoreValues = scoreSummary.querySelectorAll("p.text-3xl");
    expect(scoreValues).toHaveLength(2);
    expect(scoreValues[0].textContent).toBe("1");
    expect(scoreValues[1].textContent).toBe("1");
  });
});
