"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";
import { Music } from "lucide-react";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackClassName?: string;
}

export default function SafeImage({
  src,
  alt,
  fallbackClassName,
  className,
  ...props
}: SafeImageProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`bg-gray-800 flex items-center justify-center ${fallbackClassName || className || ""}`}
      >
        <Music className="w-1/3 h-1/3 text-gray-600" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      unoptimized
      {...props}
    />
  );
}
