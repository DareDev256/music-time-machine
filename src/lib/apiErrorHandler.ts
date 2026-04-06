/**
 * Unified API error handling for all outbound service calls.
 *
 * Every API module (Spotify, YouTube, Genius) catches errors identically:
 *   console.error("Context:", error instanceof Error ? error.message : "Unknown");
 *   return fallback;
 *
 * This module centralises that pattern so:
 * - Error extraction logic lives in one place
 * - Adding structured logging or error tracking later is a single-file change
 * - Catch blocks become one-liners instead of three
 */

/** Safely extract a human-readable message from any thrown value. */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

/**
 * Log an API error and return a typed fallback value.
 *
 * Usage:
 *   catch (error) { return apiCatch("Spotify search", [], error); }
 */
export function apiCatch<T>(context: string, fallback: T, error: unknown): T {
  console.error(`${context} error:`, extractErrorMessage(error));
  return fallback;
}
