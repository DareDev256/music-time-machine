import { Metadata } from "next";
import { getSongData } from "@/lib/dataFetcher";
import SongPageClient from "./SongPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const song = await getSongData(id);

  if (!song) {
    return {
      title: "Song Not Found | Music Time Machine",
    };
  }

  return {
    title: `${song.title} by ${song.artist} | Music Time Machine`,
    description: `Explore ${song.title} by ${song.artist} across Spotify, YouTube, Billboard, and Genius. View streaming stats, chart history, and cultural context.`,
    openGraph: {
      title: `${song.title} by ${song.artist}`,
      description: `Track ${song.title} by ${song.artist} across the music ecosystem.`,
      images: song.albumArt ? [{ url: song.albumArt }] : [],
      type: "music.song",
    },
    twitter: {
      card: "summary_large_image",
      title: `${song.title} by ${song.artist}`,
      description: `Track ${song.title} by ${song.artist} across the music ecosystem.`,
      images: song.albumArt ? [song.albumArt] : [],
    },
  };
}

export default function SongPage({ params }: PageProps) {
  return <SongPageClient params={params} />;
}
