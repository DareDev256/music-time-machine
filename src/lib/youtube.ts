import { YouTubeData } from "@/types";
import { checkYouTubeLimit } from "./rateLimit";
import { formatCompact } from "./formatNumber";
import { safeFetch } from "./safeFetch";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

async function youtubeFetch(endpoint: string, params: Record<string, string>) {
  if (!checkYouTubeLimit()) {
    throw new Error("YouTube rate limit exceeded");
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YouTube API key not configured");
  }

  const searchParams = new URLSearchParams({
    ...params,
    key: apiKey,
  });

  const response = await safeFetch(`${YOUTUBE_API_BASE}${endpoint}?${searchParams}`);

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }

  return response.json();
}

export async function searchYouTubeVideo(
  query: string
): Promise<{ videoId: string; title: string; thumbnail: string } | null> {
  try {
    const data = await youtubeFetch("/search", {
      part: "snippet",
      q: `${query} official music video`,
      type: "video",
      videoCategoryId: "10", // Music category
      maxResults: "1",
    });

    const item = data.items?.[0];
    if (!item) return null;

    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
    };
  } catch (error) {
    console.error("YouTube search error:", error);
    return null;
  }
}

export async function getYouTubeVideo(videoId: string): Promise<YouTubeData | null> {
  try {
    const data = await youtubeFetch("/videos", {
      part: "snippet,statistics",
      id: videoId,
    });

    const video = data.items?.[0];
    if (!video) return null;

    return {
      videoId: video.id,
      title: video.snippet.title,
      thumbnail:
        video.snippet.thumbnails.maxres?.url ||
        video.snippet.thumbnails.high?.url ||
        video.snippet.thumbnails.default?.url,
      publishedAt: video.snippet.publishedAt.split("T")[0],
      viewCount: formatCompact(video.statistics.viewCount),
      likeCount: formatCompact(video.statistics.likeCount),
      commentCount: formatCompact(video.statistics.commentCount),
      channelTitle: video.snippet.channelTitle,
      externalUrl: `https://youtube.com/watch?v=${video.id}`,
    };
  } catch (error) {
    console.error("YouTube video fetch error:", error);
    return null;
  }
}

export async function getYouTubeVideoBySearch(
  songTitle: string,
  artist: string
): Promise<YouTubeData | null> {
  try {
    // Search for the official music video
    const searchResult = await searchYouTubeVideo(`${artist} ${songTitle}`);
    if (!searchResult) return null;

    // Get full video details
    return getYouTubeVideo(searchResult.videoId);
  } catch (error) {
    console.error("YouTube search error:", error);
    return null;
  }
}

export function isYouTubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}
