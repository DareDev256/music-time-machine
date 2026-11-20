# Music Time Machine on Cloudflare Workers: LIVE on workers.dev (2026-11-19)

Live: https://music-time-machine.mini-outage-watch.workers.dev (Worker `music-time-machine`, OpenNext,
2.26 MB gzip). No custom domain (it had none on Vercel either). Deploy: `npm run cf:deploy`.
Secrets are set from ~/.secrets/wasplaying-*; production Convex is blessed-deer-298 (NOT the dev
deployment in .env.local).

The era data stays in public/era and is served as static assets; the code reads it through the
ASSETS binding, because a Worker has no filesystem:
- src/lib/era/data.ts keeps its synchronous readers. On Workers a file that is not loaded yet throws
  EraMiss; `withEra(fn)` fetches that file from ASSETS and runs `fn` again (each isolate fetches a
  file once). The month page primes every reader it uses (primeEraPage); /api/week, /api/card and
  the submit fact check wrap their reads in withEra. /api/health and /api/resolve use eraJson/eraList.
- Directory listings come from public/era/{heat,youtube}/manifest.json, written by
  scripts/era-manifest.mjs during cf:build (gitignored build output).
- Under next dev, next build and vitest nothing changes: the readers use the disk as before.

Build switches (cf:build only, Vercel and next dev unchanged): CF_BUILD=1 aliases convex/browser to
its fetch-only entry (the "node" entry bundles ws, which crashes on workerd), and NEXT_PUBLIC_SITE_URL
points canonical and OG links at workers.dev.

Verified 2026-11-19 from the Mini: /api/week?date=1995-07-15 returns chartWeek 1995-07-15 with
Waterfalls by TLC at #1; /era/1995-07 (with and without a song) 200 with the chart; /api/health
healthy (216 off-chart months); /api/resolve and /api/card 200. No paid model routes.
