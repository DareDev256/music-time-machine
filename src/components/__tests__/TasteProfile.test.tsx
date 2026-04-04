import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import TasteProfile from "../TasteProfile";
import type { RecentSong } from "@/hooks/useRecentlyViewed";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    section: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <section {...props}>{children}</section>
    ),
    path: (props: React.SVGAttributes<SVGPathElement>) => <path {...props} />,
    circle: (props: React.SVGAttributes<SVGCircleElement>) => <circle {...props} />,
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function recentSong(id: string): RecentSong {
  return { id, title: `Song ${id}`, artist: "Artist", albumArt: "/art.jpg", viewedAt: Date.now() };
}

describe("TasteProfile", () => {
  it("renders nothing when fewer than 2 songs viewed", () => {
    const { container } = render(<TasteProfile songs={[recentSong("blinding-lights")]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<TasteProfile songs={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the profile when 2+ songs with audio features exist", () => {
    render(
      <TasteProfile songs={[recentSong("blinding-lights"), recentSong("bad-guy")]} />,
    );
    expect(screen.getByText("Your Listening DNA")).toBeInTheDocument();
    expect(screen.getByText("2 songs analyzed")).toBeInTheDocument();
  });

  it("displays an archetype name and description", () => {
    render(
      <TasteProfile songs={[recentSong("blinding-lights"), recentSong("bad-guy")]} />,
    );
    // Should find one of the archetype names
    const archetypes = ["The Dynamo", "The Optimist", "The Dreamer", "The Groover", "The Storm Chaser", "The Explorer"];
    const found = archetypes.some((name) => screen.queryByText(name));
    expect(found).toBe(true);
  });

  it("shows genre chips from viewed songs", () => {
    render(
      <TasteProfile songs={[recentSong("blinding-lights"), recentSong("bad-guy"), recentSong("shape-of-you")]} />,
    );
    const genreList = screen.getByRole("list", { name: /top genres/i });
    expect(genreList).toBeInTheDocument();
    expect(genreList.querySelectorAll("[role='listitem']").length).toBeGreaterThan(0);
  });

  it("renders feature bars for all 4 axes", () => {
    render(
      <TasteProfile songs={[recentSong("blinding-lights"), recentSong("bad-guy")]} />,
    );
    // Each axis label appears twice (SVG + bar), so use getAllByText
    expect(screen.getAllByText("Energy").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Groove").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Mood").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Tempo").length).toBeGreaterThanOrEqual(2);
  });

  it("renders an SVG radar visualization", () => {
    render(
      <TasteProfile songs={[recentSong("blinding-lights"), recentSong("bad-guy")]} />,
    );
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("ignores songs without audio features (non-mock IDs)", () => {
    const { container } = render(
      <TasteProfile songs={[recentSong("unknown-1"), recentSong("unknown-2")]} />,
    );
    // No mock data for these IDs, so features array is empty → returns null
    expect(container.innerHTML).toBe("");
  });
});
