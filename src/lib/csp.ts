// One Content-Security-Policy for the whole app. The proxy adds a per-request nonce;
// next.config.ts uses the fallback form for responses the proxy never sees.
// Third parties, and why each is here:
//   *.mzstatic.com        Apple cover art (img + fetched as WebGL textures)
//   i.ytimg.com           YouTube thumbnails for anchors that only live on YouTube
//   musicbrainz.org       song resolve, called from the browser (per-visitor rate limit)
//   itunes.apple.com      song resolve + previews, called from the browser
//   *.itunes.apple.com    30 s preview audio
//   youtube-nocookie.com  play-in-place for YouTube-only anchors

export function buildCsp(scriptSrc: string, styleSrc: string, prod = process.env.NODE_ENV === "production"): string {
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https://*.mzstatic.com https://i.ytimg.com",
    "font-src 'self'",
    "connect-src 'self' https://musicbrainz.org https://itunes.apple.com https://*.mzstatic.com",
    "media-src 'self' https://*.itunes.apple.com",
    "frame-src https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Production only: upgrading http → https breaks `next dev` on http://localhost.
    ...(prod ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Without a nonce: 'strict-dynamic' + 'unsafe-inline' as a pair. Browsers that support
 * strict-dynamic ignore unsafe-inline (CSP3 §8.1); older ones fall back to it.
 */
export const FALLBACK_CSP = buildCsp("'self' 'unsafe-inline' 'strict-dynamic'", "'self' 'unsafe-inline'");
