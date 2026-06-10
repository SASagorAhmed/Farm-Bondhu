import type { CommunityImageAttachment } from "@/lib/communityPostMediaApi";

type CommunityImageGridProps = {
  attachments?: CommunityImageAttachment[] | null;
  compact?: boolean;
};

export default function CommunityImageGrid({ attachments, compact = false }: CommunityImageGridProps) {
  const images = (attachments || []).filter((item) => item?.type === "image" && item.url).slice(0, 4);
  if (!images.length) return null;

  const singleHeight = compact ? "h-56" : "h-[22rem]";
  const tileHeight = compact ? "h-36" : "h-56";
  const smallTileHeight = compact ? "h-28" : "h-44";

  return (
    <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {images.map((image, index) => {
        const isLargeFirst = images.length === 3 && index === 0;
        return (
          <div
            key={`${image.url}-${index}`}
            className={`overflow-hidden bg-muted ${
              images.length === 1 ? singleHeight : isLargeFirst ? `row-span-2 ${tileHeight}` : smallTileHeight
            }`}
          >
            <img
              src={image.url}
              alt={image.filename || "Community post photo"}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}
