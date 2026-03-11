# Testing Guide

How Music Time Machine tests its code — the toolchain, test organization, mock patterns, and conventions across 25 test suites.

---

## Toolchain

| Tool | Purpose |
|------|---------|
| [Vitest](https://vitest.dev/) | Test runner (Vite-native, ESM-first) |
| [Testing Library](https://testing-library.com/) | Component rendering + DOM queries |
| [jsdom](https://github.com/jsdom/jsdom) | Browser environment for component tests |
| `vi.mock()` / `vi.fn()` | Module mocking + function spies |

All tests use Vitest's globals: `describe`, `it`, `expect`, `vi`, `beforeEach`.

---

## Running Tests

```bash
npm test                        # Watch mode (re-runs on file change)
npm run test:ci                 # Single run (CI/pre-commit)
npm run test:coverage           # Coverage report

# Filter by file or test name
npm test -- cache               # Runs cache.test.ts
npm test -- recommendations     # Runs recommendations.test.ts
npm test -- -t "expires"        # Runs tests matching "expires"
```

---

## Test Organization

```
src/
├── lib/__tests__/              # 20 suites — pure logic, API clients, utilities
│   ├── cache.test.ts           # TTLCache: TTL expiry, eviction, size tracking
│   ├── recommendations.test.ts # Scoring model, strategy selection, artist dedup
│   ├── recommendations-prefs.test.ts  # Preference bonuses, mood matching
│   ├── diversity-pipeline.integration.test.ts  # End-to-end pipeline composition
│   ├── spotify.test.ts         # Spotify client: auth flow, search, track mapping
│   ├── youtube.test.ts         # YouTube client: search, video details
│   ├── genius.test.ts          # Genius client: search, song metadata
│   ├── dataFetcher.test.ts     # Unified data layer: mock/API merge logic
│   ├── rateLimit.test.ts       # Token bucket: refill, consumption, stale eviction
│   ├── safeFetch.test.ts       # SSRF allowlist: blocks localhost, metadata, evil domains
│   ├── safeHref.test.ts        # URL sanitization: blocks javascript:, data:, ftp:
│   ├── apiHandler.test.ts      # Route handler wrapper: error catching, response format
│   ├── comparison.test.ts      # Song comparison metric calculations
│   ├── timeMachine.test.ts     # Date-based song lookup logic
│   ├── timeline.test.ts        # Timeline data aggregation
│   ├── mockData.test.ts        # Mock data integrity (all 18 songs well-formed)
│   ├── health.test.ts          # Cache stats for /api/health
│   ├── formatDate.test.ts      # Date formatting edge cases
│   ├── formatNumber.test.ts    # Number formatting (K/M/B suffixes)
│   └── toSlug.test.ts          # URL slug generation
│
├── components/__tests__/       # 4 suites — UI behavior with mocked APIs
│   ├── SearchBar.test.tsx      # Autocomplete, keyboard nav, clear/loading states
│   ├── ComparisonView.test.tsx # Dual selector, metric table rendering
│   ├── AudioPlayer.test.tsx    # Play/pause, seek bar, preview URL handling
│   └── QuickStats.test.tsx     # Stat card rendering with formatted numbers
│
└── hooks/__tests__/            # 1 suite — custom hook behavior
    └── useSongData.test.ts     # Parallel fetch, abort cleanup, error states
```

**Naming convention:** `{module}.test.ts` for logic, `{Component}.test.tsx` for React components. Tests live in `__tests__/` directories adjacent to their source.

---

## Mock Patterns

### 1. Module-level mocks (API clients)

External dependencies are mocked at the module boundary before import:

```typescript
// Mock the dependency
vi.mock("../safeFetch", () => ({
  safeFetch: vi.fn(),
}));
vi.mock("../rateLimit", () => ({
  checkSpotifyLimit: vi.fn(() => true),
}));

// Import the mock for assertions
import { safeFetch } from "../safeFetch";

// Type-cast for mock methods
const mockFetch = safeFetch as ReturnType<typeof vi.fn>;
mockFetch.mockResolvedValueOnce(mockResponse(TOKEN_RESPONSE));
```

This pattern is used by `spotify.test.ts`, `youtube.test.ts`, `genius.test.ts`, and `dataFetcher.test.ts` — any module that makes HTTP calls.

### 2. Fresh module re-import (stateful modules)

Modules that cache state (like Spotify's in-memory token) need `vi.resetModules()` + dynamic `import()` to get a clean instance per test:

```typescript
async function loadModule() {
  vi.resetModules();
  vi.mock("../safeFetch", () => ({ safeFetch: vi.fn() }));
  return import("../spotify");
}

it("refreshes expired token", async () => {
  const { searchSpotifyTrack } = await loadModule();
  // Token cache is now empty — first call triggers auth
});
```

### 3. Global fetch stub (component tests)

Component tests stub the global `fetch` since components call `fetch()` directly:

```typescript
const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ results: [] }),
  });
});
```

### 4. Next.js mocks (routing + images)

Component tests mock Next.js internals that don't exist in jsdom:

```typescript
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
```

### 5. Fake timers (TTL / expiry tests)

Cache and rate limit tests use `vi.useFakeTimers()` to control time:

```typescript
it("expires entries after TTL", () => {
  vi.useFakeTimers();
  cache.set("key1", "value1", 1000);

  vi.advanceTimersByTime(1001);
  expect(cache.get("key1")).toBeNull();

  vi.useRealTimers();  // Always restore
});
```

### 6. Test data factories (integration tests)

Integration tests use factory functions to build valid `SongData` objects with minimal overrides:

```typescript
function makeSong(overrides: Partial<SongData> & { id: string }): SongData {
  return {
    title: overrides.id,
    artist: "Test Artist",
    spotify: {
      audioFeatures: { danceability: 0.7, energy: 0.7, valence: 0.7, tempo: 120 },
      // ... sensible defaults
    },
    ...overrides,
  };
}
```

---

## Test Categories

### Unit Tests (20 suites)

Test single functions or classes in isolation. All external dependencies are mocked. These form the bulk of the suite and run in < 2 seconds.

**What they verify:**
- Pure function I/O (formatters, slug generators, validators)
- Class behavior (TTLCache lifecycle, token bucket math)
- API client mapping (raw Spotify/YouTube/Genius JSON → app types)
- Security boundaries (SSRF allowlist, URL sanitization)

### Integration Tests (1 suite)

`diversity-pipeline.integration.test.ts` tests the full recommendation pipeline end-to-end — scoring, strategy resolution, picking, and diversity analysis — without mocking internal functions. Uses real `SongData` objects with controlled audio features.

**Why it exists:** The recommendation pipeline has 4 composable stages. Unit tests verify each stage, but bugs have appeared at the seams (NaN propagation, artist pre-seeding). This suite catches composition errors.

### Component Tests (4 suites)

Render React components with Testing Library, interact via `fireEvent`, assert DOM state via `screen` queries. All network calls and Next.js internals are mocked.

**What they verify:**
- Render output matches expected DOM structure
- User interactions (type, click, keyboard) trigger correct state changes
- Loading/error states render appropriate UI
- Accessibility attributes are present

---

## Conventions

| Convention | Example |
|------------|---------|
| One `describe` per module/component | `describe("TTLCache", () => { ... })` |
| Test names start with verb | `"stores and retrieves values"` |
| `beforeEach` resets all mocks | `vi.resetAllMocks()` in every suite |
| Env vars set in `beforeEach` | `process.env.SPOTIFY_CLIENT_ID = "test_id"` |
| No test interdependence | Each test creates its own state |
| Fake timers always restored | `vi.useRealTimers()` in the same test or `afterEach` |
| Mock responses use helpers | `function mockResponse(data, ok)` |

---

## Security Test Coverage

Several suites specifically test security boundaries:

| Suite | What it guards |
|-------|---------------|
| `safeFetch.test.ts` | SSRF prevention — allowlisted origins only, blocks `169.254.x.x`, `localhost`, `10.x.x.x`, `@` credential tricks |
| `safeHref.test.ts` | XSS via href — blocks `javascript:`, `data:`, `ftp:`, `file:` protocols |
| `rateLimit.test.ts` | Rate limiting math — token refill, bucket exhaustion, stale eviction |
| `apiHandler.test.ts` | Route guard pattern — rate limit → validate → execute |

---

## Adding a New Test

1. Create `src/{layer}/__tests__/{module}.test.ts`
2. Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`
3. Mock external deps at module level with `vi.mock()`
4. Reset mocks in `beforeEach`
5. Follow the verb-first naming convention
6. Run `npm test -- {module}` to verify

For component tests, add `.tsx` extension and import `@testing-library/react` + `@testing-library/jest-dom`.

---

*Last updated: 2026-03-10 · 322 tests across 25 suites*
