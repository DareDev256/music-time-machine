/**
 * Centralized request parameter parsing with input validation.
 *
 * API routes currently do ad-hoc param extraction via `searchParams.get()` with
 * inconsistent validation. This module provides hardened parsers that defend against:
 *
 * 1. **Parameter pollution** — `?sort=name&sort=DROP TABLE` sends an array; `.get()`
 *    silently returns only the first value. We detect and reject multi-value params.
 *
 * 2. **Type coercion attacks** — `?page=1e308` or `?limit=NaN` parse as numbers but
 *    produce garbage. We enforce integer-only with explicit bounds.
 *
 * 3. **Unbounded pagination** — `?limit=999999` can OOM the server or dump the entire
 *    dataset. We clamp to configurable ceilings.
 *
 * 4. **Injection via sort/filter** — `?sort=;DROP TABLE--` bypasses naive allowlists.
 *    We use a strict Set lookup — no regex, no substring matching.
 *
 * 5. **Prototype pollution** — `?field=__proto__` or `constructor` as param values
 *    can corrupt object prototypes if used in bracket notation downstream.
 */

// ── Constants ────────────────────────────────────────────────────────

/** Maximum length for any single query parameter value. */
const MAX_PARAM_LENGTH = 500;

/** Maximum number of query parameters allowed per request. */
const MAX_PARAM_COUNT = 20;

/** Keys that could trigger prototype pollution in bracket notation. */
const POISONED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** ASCII control characters — no legitimate query param contains these. */
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

// ── Types ────────────────────────────────────────────────────────────

export interface ParsedPagination {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationBounds {
  maxPage?: number;
  maxLimit?: number;
  defaultLimit?: number;
}

export interface ParamValidationError {
  param: string;
  reason: string;
}

export type ParamResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ParamValidationError };

// ── Core validators ──────────────────────────────────────────────────

/**
 * Reject requests with too many query parameters.
 *
 * Excessive params waste parsing time and can be used for hash-collision
 * DoS against naive object-based param stores (not URLSearchParams, but
 * downstream code that spreads params into objects).
 */
export function validateParamCount(params: URLSearchParams): ParamResult<true> {
  let count = 0;
  for (const _key of params.keys()) {
    count++;
    if (count > MAX_PARAM_COUNT) {
      return { ok: false, error: { param: "*", reason: `Exceeded maximum of ${MAX_PARAM_COUNT} query parameters` } };
    }
  }
  return { ok: true, value: true };
}

/**
 * Extract a single string parameter with full sanitization.
 *
 * Detects HTTP parameter pollution (multiple values for the same key),
 * strips control characters, enforces length limits, and blocks
 * prototype-pollution payloads.
 */
export function parseStringParam(
  params: URLSearchParams,
  name: string,
  opts: { required?: boolean; maxLength?: number } = {}
): ParamResult<string | null> {
  const maxLen = opts.maxLength ?? MAX_PARAM_LENGTH;

  // Parameter pollution detection: getAll() reveals duplicate keys
  // that .get() silently hides — an attacker can send contradictory
  // values hoping one bypasses validation while the other hits the DB.
  const values = params.getAll(name);
  if (values.length > 1) {
    return { ok: false, error: { param: name, reason: "Duplicate parameter — only one value allowed" } };
  }

  const raw = values[0] ?? null;
  if (raw === null || raw.trim() === "") {
    if (opts.required) {
      return { ok: false, error: { param: name, reason: "Required parameter is missing" } };
    }
    return { ok: true, value: null };
  }

  // Control characters can cause log injection (CRLF) or confuse
  // downstream parsers that split on \n or \t.
  if (CONTROL_CHAR_RE.test(raw)) {
    return { ok: false, error: { param: name, reason: "Contains invalid control characters" } };
  }

  if (raw.length > maxLen) {
    return { ok: false, error: { param: name, reason: `Exceeds maximum length of ${maxLen}` } };
  }

  const trimmed = raw.trim();

  // Prototype pollution: if the cleaned value IS a dangerous key,
  // reject. Prevents `obj[userInput] = ...` attacks downstream.
  if (POISONED_KEYS.has(trimmed)) {
    return { ok: false, error: { param: name, reason: "Disallowed parameter value" } };
  }

  return { ok: true, value: trimmed };
}

/**
 * Parse an integer parameter with strict validation and bounds clamping.
 *
 * Unlike `parseInt()` which silently parses "123abc" as 123, we reject
 * any value that isn't purely numeric (with optional leading minus).
 * Also rejects `NaN`, `Infinity`, floats, and scientific notation.
 */
export function parseIntParam(
  params: URLSearchParams,
  name: string,
  opts: { min?: number; max?: number; defaultValue?: number } = {}
): ParamResult<number> {
  const strResult = parseStringParam(params, name);
  if (!strResult.ok) return strResult as ParamResult<number>;

  if (strResult.value === null) {
    if (opts.defaultValue !== undefined) {
      return { ok: true, value: opts.defaultValue };
    }
    return { ok: false, error: { param: name, reason: "Required integer parameter is missing" } };
  }

  const raw = strResult.value;

  // Strict integer pattern: optional minus, then digits only.
  // Rejects "1e5", "1.0", "0x1A", "+1", "1_000" — all of which
  // parseInt/Number would happily coerce.
  if (!/^-?\d+$/.test(raw)) {
    return { ok: false, error: { param: name, reason: "Must be a valid integer" } };
  }

  const num = Number(raw);

  // Guard against numbers too large for safe integer representation.
  // Number("99999999999999999") silently rounds to 100000000000000000.
  if (!Number.isSafeInteger(num)) {
    return { ok: false, error: { param: name, reason: "Integer value out of safe range" } };
  }

  if (opts.min !== undefined && num < opts.min) {
    return { ok: false, error: { param: name, reason: `Must be at least ${opts.min}` } };
  }
  if (opts.max !== undefined && num > opts.max) {
    return { ok: false, error: { param: name, reason: `Must be at most ${opts.max}` } };
  }

  return { ok: true, value: num };
}

/**
 * Parse a pagination pair (page + limit) with safe defaults and bounds.
 *
 * Computes `offset` server-side so routes don't do arithmetic on
 * user-controlled values — preventing integer overflow in offset
 * calculations that could wrap to negative and confuse slicing.
 */
export function parsePagination(
  params: URLSearchParams,
  bounds: PaginationBounds = {}
): ParamResult<ParsedPagination> {
  const maxPage = bounds.maxPage ?? 1000;
  const maxLimit = bounds.maxLimit ?? 100;
  const defaultLimit = bounds.defaultLimit ?? 20;

  const pageResult = parseIntParam(params, "page", { min: 1, max: maxPage, defaultValue: 1 });
  if (!pageResult.ok) return pageResult as ParamResult<ParsedPagination>;

  const limitResult = parseIntParam(params, "limit", { min: 1, max: maxLimit, defaultValue: defaultLimit });
  if (!limitResult.ok) return limitResult as ParamResult<ParsedPagination>;

  const page = pageResult.value;
  const limit = limitResult.value;

  return {
    ok: true,
    value: {
      page,
      limit,
      offset: (page - 1) * limit,
    },
  };
}

/**
 * Validate a parameter against a strict allowlist.
 *
 * Uses `Set.has()` — O(1) exact match, no regex, no substring tricks.
 * An attacker can't inject SQL or traversal characters because only
 * pre-approved strings pass.
 */
export function parseEnumParam<T extends string>(
  params: URLSearchParams,
  name: string,
  allowed: ReadonlySet<T>,
  opts: { defaultValue?: T } = {}
): ParamResult<T> {
  const strResult = parseStringParam(params, name);
  if (!strResult.ok) return strResult as ParamResult<T>;

  if (strResult.value === null) {
    if (opts.defaultValue !== undefined) {
      return { ok: true, value: opts.defaultValue };
    }
    return { ok: false, error: { param: name, reason: "Required parameter is missing" } };
  }

  if (!allowed.has(strResult.value as T)) {
    // Don't echo allowed values in error — reveals valid options to attackers
    return { ok: false, error: { param: name, reason: "Invalid parameter value" } };
  }

  return { ok: true, value: strResult.value as T };
}
