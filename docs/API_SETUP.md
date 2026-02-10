# API Setup Guide

This guide walks through configuring the three external APIs used by Music Time Machine. All APIs are optional — the app works fully with mock data out of the box.

---

## Quick Start

1. Create `.env.local` in the project root:

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_API_KEY=
GENIUS_ACCESS_TOKEN=
USE_MOCK_DATA=true
```

2. Fill in whichever API keys you have. Leave the rest blank.
3. Set `USE_MOCK_DATA=false` to enable real API calls.
4. Restart the dev server (`npm run dev`).

The app detects which APIs are configured at runtime via `isSpotifyConfigured()`, `isYouTubeConfigured()`, and `isGeniusConfigured()`. Any unconfigured API silently falls back to mock data.

---

## Spotify API

**Auth method:** OAuth 2.0 Client Credentials (server-to-server, no user login required)

### Setup Steps

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account (free tier works)
3. Click **Create App**
   - App name: `Music Time Machine` (or anything)
   - App description: anything
   - Redirect URI: `http://localhost:3000/callback` (not actually used for Client Credentials flow, but required by the form)
   - Select **Web API**
4. Once created, go to **Settings**
5. Copy **Client ID** and **Client Secret**

### Environment Variables

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### What It Provides

- Track search with autocomplete results
- Track details: streams, popularity score, playlist count
- Audio features: danceability, energy, valence, tempo
- 30-second audio preview URLs
- Album art from Spotify CDN (`i.scdn.co`)
- Artist data: monthly listeners, top tracks, discography

### How Auth Works

The `spotify.ts` client uses Client Credentials flow:
1. POSTs client ID + secret (Base64 encoded) to `https://accounts.spotify.com/api/token`
2. Receives an access token valid for 1 hour
3. Token is cached in memory and auto-refreshed on expiry
4. All subsequent requests use `Authorization: Bearer <token>`

No user login, no refresh tokens, no PKCE. Purely server-side.

### Rate Limit Applied

**30 requests per 30 seconds** (token bucket)

Spotify's official limit is higher, but this conservative limit prevents accidental burst usage and keeps the app within safe margins.

---

## YouTube Data API v3

**Auth method:** API Key (no OAuth required)

### Setup Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services > Library**
4. Search for **YouTube Data API v3** and click **Enable**
5. Go to **APIs & Services > Credentials**
6. Click **Create Credentials > API Key**
7. Copy the generated key
8. (Recommended) Click **Edit API Key** and restrict it:
   - Under **API restrictions**, select **Restrict key** and choose **YouTube Data API v3**
   - Under **Application restrictions**, add your domain or IP

### Environment Variables

```env
YOUTUBE_API_KEY=your_api_key_here
```

### What It Provides

- Video search by song title + artist name
- Video details: view count, like count, comment count
- Thumbnail URL, publish date, channel title
- External link to YouTube video

### Quota Warning

YouTube Data API v3 has a daily quota of **10,000 units** (default). Each search costs 100 units. Each video details call costs 1 unit. That means roughly **100 searches per day** on the free tier. The in-app rate limiter helps, but be aware of this hard ceiling.

To request a quota increase: Google Cloud Console > APIs & Services > YouTube Data API v3 > Quotas > Request Increase.

### Rate Limit Applied

**100 requests per hour** (token bucket)

---

## Genius API

**Auth method:** Bearer Token

### Setup Steps

1. Go to [Genius API Clients](https://genius.com/api-clients)
2. Log in with your Genius account
3. Click **New API Client**
   - App name: `Music Time Machine`
   - App website URL: `http://localhost:3000`
   - Redirect URI: `http://localhost:3000/callback`
4. After creation, click **Generate Access Token**
5. Copy the token

### Environment Variables

```env
GENIUS_ACCESS_TOKEN=your_access_token_here
```

### What It Provides

- Song search by title + artist
- Song details: page views, annotation count
- Lyrics URL (link to genius.com, not raw lyrics)
- Song description and release context
- Album art from Genius CDN (`images.genius.com`)

### Rate Limit Applied

**50 requests per minute** (token bucket)

---

## USE_MOCK_DATA Toggle

```env
USE_MOCK_DATA=true   # Always use mock data. No API calls made. Default.
USE_MOCK_DATA=false  # Use real APIs when configured. Fall back to mock for unconfigured APIs.
```

### Behavior Matrix

| USE_MOCK_DATA | API Keys Set | Result |
|---------------|-------------|--------|
| `true` | Any | Mock data only. API keys ignored. |
| `false` | None | Mock data only (graceful fallback). |
| `false` | Some | Real data from configured APIs, mock for the rest. |
| `false` | All | Full real data, mock as final fallback on errors. |

The hybrid architecture means there is no configuration that breaks the app. Worst case, you see curated mock data for 18 songs. Best case, you search any song on Spotify and get real-time data from all three platforms.

---

## Rate Limits Summary

| API | Limit | Window | Implementation |
|-----|-------|--------|----------------|
| Spotify | 30 requests | 30 seconds | Token bucket in `rateLimit.ts` |
| YouTube | 100 requests | 1 hour | Token bucket in `rateLimit.ts` |
| Genius | 50 requests | 1 minute | Token bucket in `rateLimit.ts` |

Rate limiting is server-side only. It applies per Node.js process. In a Vercel serverless deployment, each function invocation gets its own rate limit state (buckets reset per cold start). For sustained production use, consider external rate limiting (Redis-backed or Vercel Edge Middleware).

---

## Caching

API responses are cached in-memory to reduce redundant calls:

| Cache | TTL | Max Entries | Purpose |
|-------|-----|-------------|---------|
| Search | 5 minutes | 200 | Identical searches within 5 min hit cache |
| Song Data | 30 minutes | 100 | Revisiting a song within 30 min hits cache |

Cache is per-process. On Vercel, each serverless function invocation starts with an empty cache. Frequently accessed songs will still benefit within a single warm function instance.

---

## Troubleshooting

**"API not working but keys are set"**
- Check `USE_MOCK_DATA` is set to `false`
- Restart the dev server after changing `.env.local`
- Check the terminal for API error logs (all clients log errors to console)

**"YouTube quota exceeded"**
- You hit the 10,000 unit daily limit
- The app falls back to mock data automatically
- Wait 24 hours or request a quota increase in Google Cloud Console

**"Spotify token error"**
- Verify Client ID and Client Secret are correct (no trailing spaces)
- Check that the app is still active in the Spotify Developer Dashboard

**"No audio preview available"**
- Not all Spotify tracks have preview URLs
- Preview availability depends on licensing and region
- The audio player only renders when `previewUrl` is non-null
