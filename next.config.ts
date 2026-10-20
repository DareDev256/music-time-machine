import type { NextConfig } from "next";
import { FALLBACK_CSP } from "./src/lib/csp";

/**
 * Static fallback headers for every response. The nonce-based CSP in src/proxy.ts
 * overrides the CSP for page routes; static assets, error pages and anything the proxy
 * doesn't intercept still get this baseline.
 *
 * No Cross-Origin-Embedder-Policy: nothing here needs SharedArrayBuffer, and COEP would
 * block the youtube-nocookie player for YouTube-only anchors.
 */
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.0.0",
  },
  // Route handlers and the era page read the shards and fonts with fs; Vercel only bundles files it can trace.
  outputFileTracingIncludes: {
    "/era/[month]": ["./public/era/**/*.json"],
    "/api/**": ["./public/era/**/*.json", "./public/fonts/**"],
  },
  images: {
    remotePatterns: [
      // iTunes cover art (is1-ssl … is5-ssl.mzstatic.com)
      { protocol: "https", hostname: "*.mzstatic.com", pathname: "/image/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/**" },
    ],
  },
  async redirects() {
    // The v1 mock dashboard (tagged v1.40.0) is gone; old links land on the console.
    return [
      { source: "/song/:path*", destination: "/", permanent: true },
      { source: "/artist/:path*", destination: "/", permanent: true },
      { source: "/compare", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/era/:file*.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: FALLBACK_CSP },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), idle-detection=(), screen-wake-lock=(), web-share=(self)",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
