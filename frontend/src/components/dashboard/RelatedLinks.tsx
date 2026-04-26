import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface RelatedLink {
  label: string;
  url: string;
  color: string;
}

interface RelatedLinksProps {
  links: RelatedLink[];
}

export default function RelatedLinks({ links }: RelatedLinksProps) {
  const navigate = useNavigate();

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Related:</span>
      {links.map((link) => (
        <Button
          key={link.url}
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 px-2"
          style={{ color: link.color }}
          onClick={() => navigate(link.url)}
        >
          {link.label}
          <ArrowRight className="h-3 w-3" />
        </Button>
      ))}
    </div>
  );
}
