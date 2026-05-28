import { memo } from "react";
import Image from "next/image";

type PreviewProps = {
  url: string;
  description?: string;
  priority?: boolean;
  onClick?: () => void;
};

export const Preview = memo(
  ({ url, description, priority, onClick }: PreviewProps) => {
    const caption = description || "No description available yet.";

    return (
      <button
        className="group hover:-translate-y-0.5 mb-4 inline-block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-2xl border bg-card p-1.5 shadow-sm transition-all duration-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onClick}
        type="button"
      >
        <Image
          alt={caption}
          className="h-auto w-full rounded-xl transition duration-300 group-hover:scale-[1.02]"
          height={630}
          priority={priority}
          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          src={url}
          unoptimized
          width={630}
        />
      </button>
    );
  }
);

Preview.displayName = "Preview";
