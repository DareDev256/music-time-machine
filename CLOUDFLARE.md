# Music Time Machine on Cloudflare Workers: NOT LIVE yet (2026-11-19)

OpenNext builds and deploys (music-time-machine.mini-outage-watch.workers.dev, 2.26 MB gzip, fits the
free plan), secrets are set from ~/.secrets/wasplaying-*, and production Convex is blessed-deer-298
(NOT the dev deployment in .env.local). Blocker: src/lib/era/data.ts reads public/era/*.json with
node:fs at runtime; Workers have no filesystem, so /api/week and /api/health come back empty.
Fix before cutover: load the era JSON through static imports or the ASSETS binding, then re-test
/api/week?date=1995-07-15 for a non-null chartWeek. No custom domain is attached.
