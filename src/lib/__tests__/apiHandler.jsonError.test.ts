import { describe, it, expect } from "vitest";
import { jsonError, jsonWithCache } from "../apiHandler";

/** jsonError: security-hardened error responses (400/404/422). */
describe("jsonError", () => {
  it("returns correct status for 400 Bad Request", async () => {
    const res = jsonError({ error: "Missing query parameter" }, 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing query parameter");
  });

  it("returns correct status for 404 Not Found", async () => {
    const res = jsonError({ error: "Song not found" }, 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Song not found");
  });

  it("returns correct status for 422 Unprocessable Entity", async () => {
    const res = jsonError({ error: "Invalid date format" }, 422);
    expect(res.status).toBe(422);
  });

  it("includes X-Content-Type-Options: nosniff on errors", () => {
    const res = jsonError({ error: "bad" }, 400);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("includes X-Frame-Options: DENY on errors", () => {
    const res = jsonError({ error: "bad" }, 404);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("includes Cache-Control: no-store on errors", () => {
    const res = jsonError({ error: "bad" }, 400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does NOT leak internal details in error body", async () => {
    // Callers should only pass generic messages, but verify the shape
    const res = jsonError({ error: "Invalid ID" }, 400);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body.error).not.toContain("stack");
    expect(body.error).not.toContain("at ");
  });
});

/** Security header parity — both response builders must include the same protections. */
describe("security header parity: jsonWithCache vs jsonError", () => {
  it("both include nosniff header", () => {
    const cached = jsonWithCache({ ok: true }, "public, max-age=300");
    const errored = jsonError({ error: "not found" }, 404);

    expect(cached.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(errored.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("both include X-Frame-Options DENY", () => {
    const cached = jsonWithCache({ ok: true }, "no-store");
    const errored = jsonError({ error: "bad" }, 400);

    expect(cached.headers.get("X-Frame-Options")).toBe("DENY");
    expect(errored.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
