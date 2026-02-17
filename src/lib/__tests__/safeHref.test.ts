import { describe, it, expect } from "vitest";
import { safeHref } from "../safeHref";

describe("safeHref", () => {
  // --- Valid HTTPS URLs pass through ---
  it("allows HTTPS URLs", () => {
    expect(safeHref("https://open.spotify.com/track/abc123")).toBe(
      "https://open.spotify.com/track/abc123"
    );
  });

  it("allows HTTPS URLs with paths and query params", () => {
    const url = "https://genius.com/songs/123?ref=mtm";
    expect(safeHref(url)).toBe(url);
  });

  // --- Dangerous protocols blocked ---
  it("blocks javascript: protocol", () => {
    expect(safeHref("javascript:alert(document.cookie)")).toBe("#");
  });

  it("blocks data: protocol", () => {
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("blocks vbscript: protocol", () => {
    expect(safeHref("vbscript:MsgBox('xss')")).toBe("#");
  });

  // --- HTTP downgrade blocked ---
  it("blocks HTTP URLs (must be HTTPS)", () => {
    expect(safeHref("http://evil.com/steal")).toBe("#");
  });

  // --- Edge cases ---
  it("returns '#' for undefined", () => {
    expect(safeHref(undefined)).toBe("#");
  });

  it("returns '#' for null", () => {
    expect(safeHref(null)).toBe("#");
  });

  it("returns '#' for empty string", () => {
    expect(safeHref("")).toBe("#");
  });

  it("returns '#' for malformed URL", () => {
    expect(safeHref("not-a-url")).toBe("#");
  });

  it("blocks ftp: protocol", () => {
    expect(safeHref("ftp://files.example.com/data")).toBe("#");
  });

  it("blocks file: protocol", () => {
    expect(safeHref("file:///etc/passwd")).toBe("#");
  });
});
