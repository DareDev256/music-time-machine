import type { NextConfig } from "next";

/**
 * Static fallback CSP — enforced on every response via Next.js headers().
 *
 * The dynamic nonce-based CSP in src/proxy.ts overrides this for page routes,
 * but static assets (/_next/static/*), error pages, and any request the proxy
 * doesn't intercept still need baseline protection.
 *
 * Without nonces, we use 'strict-dynamic' + 'unsafe-inline' as a fallback pair:
 * browsers that support strict-dynamic ignore unsafe-inline (CSP3 spec §8.1),
 * while older browsers fall back to unsafe-inline rather than blocking everything.
 */
const fallbackCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'strict-dynamic'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.scdn.co https://i.ytimg.com https://images.genius.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://www.googleapis.com https://api.genius.com",
  "media-src 'self' https://p.scdn.co",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.0.0",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.genius.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: fallbackCsp,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), idle-detection=(), screen-wake-lock=(), web-share=(self)",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "X-Permitted-Cross-Domain-Policies",
            value: "none",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
