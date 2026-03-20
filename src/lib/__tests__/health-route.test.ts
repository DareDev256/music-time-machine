import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveOverallStatus,
  isAuthorizedForDetails,
  formatUptime,
} from "@/app/api/health/route";
import { NextRequest } from "next/server";

// ── resolveOverallStatus ────────────────────────────────────────────────

describe("resolveOverallStatus", () => {
  it("returns 'healthy' when all checks pass", () => {
    expect(resolveOverallStatus(["pass", "pass", "pass"])).toBe("healthy");
  });

  it("returns 'degraded' when worst severity is warn", () => {
    expect(resolveOverallStatus(["pass", "warn", "pass"])).toBe("degraded");
  });

  it("returns 'unhealthy' when any check fails", () => {
    expect(resolveOverallStatus(["pass", "warn", "fail"])).toBe("unhealthy");
  });

  it("returns 'healthy' for empty status array (no checks = no problems)", () => {
    expect(resolveOverallStatus([])).toBe("healthy");
  });

  it("treats unknown status values as 'pass' (defensive fallback)", () => {
    // An unrecognized status shouldn't crash or escalate severity
    expect(resolveOverallStatus(["pass", "unknown-status"])).toBe("healthy");
  });

  it("fail outweighs multiple warns", () => {
    expect(resolveOverallStatus(["warn", "warn", "fail", "warn"])).toBe("unhealthy");
  });
});

// ── isAuthorizedForDetails ──────────────────────────────────────────────

describe("isAuthorizedForDetails", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  function makeRequest(authHeader?: string): NextRequest {
    const headers: Record<string, string> = {};
    if (authHeader) headers["authorization"] = authHeader;
    return new NextRequest("http://localhost/api/health", { headers });
  }

  it("returns false when HEALTH_AUTH_TOKEN is not configured", () => {
    delete process.env.HEALTH_AUTH_TOKEN;
    expect(isAuthorizedForDetails(makeRequest("Bearer some-token"))).toBe(false);
  });

  it("returns false when no Authorization header is present", () => {
    process.env.HEALTH_AUTH_TOKEN = "secret-token";
    expect(isAuthorizedForDetails(makeRequest())).toBe(false);
  });

  it("returns false for non-Bearer auth scheme", () => {
    process.env.HEALTH_AUTH_TOKEN = "secret-token";
    expect(isAuthorizedForDetails(makeRequest("Basic c2VjcmV0"))).toBe(false);
  });

  it("returns true for correct Bearer token", () => {
    process.env.HEALTH_AUTH_TOKEN = "correct-token-123";
    expect(isAuthorizedForDetails(makeRequest("Bearer correct-token-123"))).toBe(true);
  });

  it("returns false for wrong Bearer token", () => {
    process.env.HEALTH_AUTH_TOKEN = "correct-token";
    expect(isAuthorizedForDetails(makeRequest("Bearer wrong-token"))).toBe(false);
  });

  it("returns false when token lengths differ (short-circuit)", () => {
    process.env.HEALTH_AUTH_TOKEN = "long-secret-token";
    expect(isAuthorizedForDetails(makeRequest("Bearer short"))).toBe(false);
  });

  it("rejects token with matching prefix but different suffix", () => {
    process.env.HEALTH_AUTH_TOKEN = "token-abcdef";
    expect(isAuthorizedForDetails(makeRequest("Bearer token-abcXYZ"))).toBe(false);
  });
});

// ── formatUptime ────────────────────────────────────────────────────────

describe("formatUptime", () => {
  it("formats seconds only", () => {
    expect(formatUptime(45_000)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatUptime(125_000)).toBe("2m 5s");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatUptime(3_665_000)).toBe("1h 1m 5s");
  });

  it("formats days, hours, and minutes", () => {
    expect(formatUptime(90_000_000)).toBe("1d 1h 0m");
  });

  it("handles zero milliseconds", () => {
    expect(formatUptime(0)).toBe("0s");
  });

  it("handles exactly 1 hour", () => {
    expect(formatUptime(3_600_000)).toBe("1h 0m 0s");
  });
});
