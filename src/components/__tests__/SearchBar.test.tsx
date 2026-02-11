import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SearchBar from "../SearchBar";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/image used by SafeImage
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockPush.mockReset();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);

  // Default: return empty results
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ results: [] }),
  });
});

describe("SearchBar", () => {
  it("renders search input with correct placeholder", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText("Search for any song...");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("shows clear button when query is entered", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText("Search for any song...");

    // Initially there should be no clear button (the X / Loader2 button is
    // conditionally rendered only when `query` is truthy)
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    // Type a query to trigger the clear button
    fireEvent.change(input, { target: { value: "Beatles" } });

    // Now a button should appear (the clear/loading button)
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("does not show dropdown initially", () => {
    const { container } = render(<SearchBar />);

    // The dropdown is rendered only when isOpen && results.length > 0.
    // On mount neither condition is true, so no dropdown container exists.
    // The dropdown has a ref="dropdownRef" and contains result buttons.
    // We check that no result buttons appear outside the search input.
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(0);
  });

  it("shows no results message for empty search results", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ results: [] }),
    });

    render(<SearchBar />);

    const input = screen.getByPlaceholderText("Search for any song...");

    await act(async () => {
      fireEvent.change(input, { target: { value: "xyznonexistent" } });
    });

    // Advance past the 300ms debounce and let microtasks flush
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // The component shows "No songs found for ..." when isOpen, query is truthy,
    // results is empty, and isLoading is false.
    await waitFor(() => {
      expect(screen.getByText(/No songs found/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});
