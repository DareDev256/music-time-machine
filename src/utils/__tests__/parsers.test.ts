import { describe, it, expect } from "vitest";
import { extractDomainFromUrl } from "../parsers";

describe("extractDomainFromUrl", () => {
  // ── Valid URLs ──────────────────────────────────────────────────────
  it("extracts domain from a standard HTTPS URL", () => {
    const result = extractDomainFromUrl("https://open.spotify.com/track/123");
    expect(result).toEqual({
      domain: "open.spotify.com",
      origin: "https://open.spotify.com",
      protocol: "https:",
    });
  });

  it("extracts domain from an HTTP URL", () => {
    const result = extractDomainFromUrl("http://example.com/page");
    expect(result?.domain).toBe("example.com");
    expect(result?.protocol).toBe("http:");
  });

  it("lowercases the domain", () => {
    expect(extractDomainFromUrl("https://API.Spotify.COM")?.domain).toBe(
      "api.spotify.com"
    );
  });

  it("handles URLs with ports", () => {
    const result = extractDomainFromUrl("https://localhost:3000/api");
    expect(result?.domain).toBe("localhost");
  });

  it("handles URLs with query strings and fragments", () => {
    const result = extractDomainFromUrl(
      "https://example.com/path?q=test#section"
    );
    expect(result?.domain).toBe("example.com");
  });

  it("strips trailing dots from hostname", () => {
    expect(extractDomainFromUrl("https://example.com./path")?.domain).toBe(
      "example.com"
    );
  });

  // ── Dangerous protocols ─────────────────────────────────────────────
  it("rejects javascript: protocol", () => {
    expect(extractDomainFromUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: protocol", () => {
    expect(extractDomainFromUrl("data:text/html,<h1>hi</h1>")).toBeNull();
  });

  it("rejects vbscript: protocol", () => {
    expect(extractDomainFromUrl("vbscript:MsgBox(1)")).toBeNull();
  });

  it("rejects ftp: protocol", () => {
    expect(extractDomainFromUrl("ftp://files.example.com")).toBeNull();
  });

  it("rejects file: protocol", () => {
    expect(extractDomainFromUrl("file:///etc/passwd")).toBeNull();
  });

  // ── Credential smuggling ────────────────────────────────────────────
  it("strips userinfo before parsing to prevent phishing", () => {
    const result = extractDomainFromUrl("https://evil.com@legit.com/path");
    // After stripping userinfo, URL becomes https://legit.com/path
    expect(result?.domain).toBe("legit.com");
  });

  it("strips password-bearing userinfo", () => {
    const result = extractDomainFromUrl(
      "https://user:pass@api.spotify.com/v1"
    );
    expect(result?.domain).toBe("api.spotify.com");
  });

  // ── Control characters (CRLF injection) ─────────────────────────────
  it("rejects URLs with null bytes", () => {
    expect(extractDomainFromUrl("https://example.com\x00")).toBeNull();
  });

  it("rejects URLs with newlines", () => {
    expect(extractDomainFromUrl("https://example.com\r\nX-Injected: true")).toBeNull();
  });

  it("rejects URLs with tabs", () => {
    expect(extractDomainFromUrl("https://exa\tmple.com")).toBeNull();
  });

  // ── Overlong input ──────────────────────────────────────────────────
  it("rejects URLs exceeding 2048 characters", () => {
    const long = "https://example.com/" + "a".repeat(2040);
    expect(extractDomainFromUrl(long)).toBeNull();
  });

  it("accepts URLs at exactly 2048 characters", () => {
    const url = "https://example.com/" + "a".repeat(2028);
    expect(url.length).toBe(2048);
    expect(extractDomainFromUrl(url)).not.toBeNull();
  });

  // ── Non-string / empty input ────────────────────────────────────────
  it("returns null for null input", () => {
    expect(extractDomainFromUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractDomainFromUrl(undefined)).toBeNull();
  });

  it("returns null for numeric input", () => {
    expect(extractDomainFromUrl(42)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractDomainFromUrl("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(extractDomainFromUrl("   ")).toBeNull();
  });

  it("returns null for malformed URL", () => {
    expect(extractDomainFromUrl("not-a-url")).toBeNull();
  });

  it("trims leading/trailing whitespace before parsing", () => {
    const result = extractDomainFromUrl("  https://example.com  ");
    expect(result?.domain).toBe("example.com");
  });
});
