import { YouTubeData } from "@/types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

async function youtubeFetch(endpoint: string, params: Record<string, string>) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YouTube API key not configured");
  }

  const searchParams = new URLSearchParams({
    ...params,
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}${endpoint}?${searchParams}`);

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
      viewCount: formatCount(video.statistics.viewCount),
      likeCount: formatCount(video.statistics.likeCount),
      commentCount: formatCount(video.statistics.commentCount),
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

function formatCount(count: string | undefined): string {
  if (!count) return "N/A";
  const num = parseInt(count, 10);
  if (isNaN(num)) return count;

  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

export function isYouTubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}
