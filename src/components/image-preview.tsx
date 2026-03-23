"use client";

import type { ImageAttachment } from "@/hooks/use-image-upload";

interface ImagePreviewProps {
  images: ImageAttachment[];
  onRemove: (id: string) => void;
}

export function ImagePreview({ images, onRemove }: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {images.map((img) => (
        <div key={img.id} className="group relative">
          <img
            src={img.previewUrl}
            alt={img.name}
            className="h-16 w-16 rounded-lg object-cover ring-1 ring-zinc-200/60 dark:ring-zinc-700/60"
          />
          <button
            onClick={() => onRemove(img.id)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
            aria-label={`Remove ${img.name}`}
          >
            &times;
          </button>
          <span className="mt-0.5 block max-w-[64px] truncate text-[9px] text-zinc-400">
            {img.name}
          </span>
        </div>
      ))}
    </div>
  );
}
