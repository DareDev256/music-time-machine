import { describe, it, expect } from "vitest";
import { rateLimitResponse } from "../rateLimit";

/** rateLimitResponse: X-Request-ID traceability + security headers on 429s. */
describe("rateLimitResponse — request ID traceability", () => {
  it("attaches X-Request-ID when provided", async () => {
    const res = rateLimitResponse("abc-123-def");
    expect(res.headers.get("X-Request-ID")).toBe("abc-123-def");
  });

  it("omits X-Request-ID when not provided", async () => {
    const res = rateLimitResponse();
    expect(res.headers.get("X-Request-ID")).toBeNull();
  });

  it("preserves request ID with UUID format", async () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const res = rateLimitResponse(uuid);
    expect(res.headers.get("X-Request-ID")).toBe(uuid);
  });
});

describe("rateLimitResponse — security headers", () => {
  it("includes nosniff to prevent MIME-sniffing of 429 body", () => {
    const res = rateLimitResponse();
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("includes X-Frame-Options DENY", () => {
    const res = rateLimitResponse();
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("includes Cache-Control no-store", () => {
    const res = rateLimitResponse();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets Content-Type to application/json", () => {
    const res = rateLimitResponse();
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("includes Retry-After header for client backoff", () => {
    const res = rateLimitResponse();
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns parseable JSON body with error message", async () => {
    const res = rateLimitResponse("test-id");
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/too many requests/i);
  });
});
