import { describe, it, expect } from "vitest";
import { assertAllowedOrigin } from "../safeFetch";

describe("assertAllowedOrigin", () => {
  it("allows Spotify API origin", () => {
    expect(() => assertAllowedOrigin("https://api.spotify.com/v1/tracks/abc")).not.toThrow();
  });

  it("allows Spotify accounts origin", () => {
    expect(() => assertAllowedOrigin("https://accounts.spotify.com/api/token")).not.toThrow();
  });

  it("allows YouTube API origin", () => {
    expect(() => assertAllowedOrigin("https://www.googleapis.com/youtube/v3/search?q=test")).not.toThrow();
  });

  it("allows Genius API origin", () => {
    expect(() => assertAllowedOrigin("https://api.genius.com/songs/123")).not.toThrow();
  });

  it("blocks cloud metadata endpoint (169.254.169.254)", () => {
    expect(() => assertAllowedOrigin("http://169.254.169.254/latest/meta-data/")).toThrow("SSRF blocked");
  });

  it("blocks localhost", () => {
    expect(() => assertAllowedOrigin("http://localhost:3000/api/secret")).toThrow("SSRF blocked");
  });

  it("blocks internal IPs", () => {
    expect(() => assertAllowedOrigin("http://10.0.0.1/admin")).toThrow("SSRF blocked");
  });

  it("blocks arbitrary external domains", () => {
    expect(() => assertAllowedOrigin("https://evil.com/steal?data=secret")).toThrow("SSRF blocked");
  });

  it("blocks origin with @ credential trick", () => {
    // URL spec: https://user:pass@host/ — the host after @ is the real target
    expect(() => assertAllowedOrigin("https://api.spotify.com@evil.com/path")).toThrow("SSRF blocked");
  });

  it("blocks malformed URLs", () => {
    expect(() => assertAllowedOrigin("not-a-url")).toThrow("SSRF blocked: malformed URL");
  });

  it("blocks HTTP downgrade of allowed origins", () => {
    // Our allowlist only has https:// origins
    expect(() => assertAllowedOrigin("http://api.spotify.com/v1/tracks")).toThrow("SSRF blocked");
  });

  it("blocks subdomain spoofing", () => {
    expect(() => assertAllowedOrigin("https://api.spotify.com.evil.com/v1/tracks")).toThrow("SSRF blocked");
  });
});
