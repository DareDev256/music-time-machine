"use client";

import Image from "next/image";
import { YouTubeData } from "@/types";
import PlatformCard, { StatRow } from "./PlatformCard";
import { formatDate } from "@/lib/formatDate";

const SHORT_DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

interface YouTubeCardProps {
  data: YouTubeData;
}

// Simple YouTube icon
const YouTubeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export default function YouTubeCard({ data }: YouTubeCardProps) {

  return (
    <PlatformCard
      title="YouTube"
      icon={<YouTubeIcon />}
      color="#FF0000"
      externalUrl={data.externalUrl}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-video rounded-lg overflow-hidden mb-4 group">
        <Image
          src={data.thumbnail}
          alt={data.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white ml-1"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      <StatRow label="Total Views" value={data.viewCount} />
      <StatRow label="Likes" value={data.likeCount} />
      <StatRow label="Comments" value={data.commentCount} />
      <StatRow label="Published" value={formatDate(data.publishedAt, SHORT_DATE)} />
      <StatRow label="Channel" value={data.channelTitle} />
    </PlatformCard>
  );
}
