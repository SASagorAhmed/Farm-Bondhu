import { ExternalLink, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDomain } from "@/lib/urlUtils";

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
}

interface LinkPreviewProps {
  data: LinkPreviewData | null;
  loading?: boolean;
  compact?: boolean;
}

export default function LinkPreview({ data, loading, compact }: LinkPreviewProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 overflow-hidden bg-muted/20 mt-3">
        <Skeleton className="h-32 w-full" />
        <div className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }

  if (!data?.url) return null;

  const domain = data.domain || getDomain(data.url);
  const hasImage = !!data.image;
  const hasMetadata = data.title || data.description;

  if (!hasMetadata) {
    return (
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg border border-border/60 bg-muted/20 text-sm text-primary hover:bg-muted/40 transition-colors"
      >
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{data.url}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </a>
    );
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block mt-3 rounded-xl border border-border/60 overflow-hidden bg-muted/20 hover:bg-muted/30 transition-colors group"
    >
      {hasImage && !compact && (
        <div className="w-full h-40 sm:h-48 overflow-hidden bg-muted">
          <img
            src={data.image}
            alt={data.title || "Link preview"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      <div className={`p-3 ${compact && hasImage ? "flex gap-3" : ""}`}>
        {compact && hasImage && (
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
            <img
              src={data.image}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <Globe className="h-3 w-3" />
            <span className="uppercase tracking-wide">{domain}</span>
          </div>
          {data.title && (
            <h4 className={`font-semibold text-foreground leading-snug ${compact ? "text-sm line-clamp-1" : "text-sm line-clamp-2"}`}>
              {data.title}
            </h4>
          )}
          {data.description && (
            <p className={`text-muted-foreground mt-0.5 leading-relaxed ${compact ? "text-xs line-clamp-1" : "text-xs line-clamp-2"}`}>
              {data.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
