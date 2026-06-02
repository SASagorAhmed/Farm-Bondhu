import { Package, Flag } from "lucide-react";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import { ICON_COLORS } from "@/lib/iconColors";
import type { ChatMentionTagDefinition, ChatMentionTagId } from "@/lib/marketplaceChatMentions";

interface ChatMentionTagSuggestProps {
  open: boolean;
  tags: ChatMentionTagDefinition[];
  highlightIndex: number;
  onSelect: (tag: ChatMentionTagDefinition) => void;
  onHighlightChange: (index: number) => void;
}

function tagAccentColor(id: ChatMentionTagId): string {
  return id === "report" ? ICON_COLORS.admin : MARKETPLACE_THEME.primary;
}

function TagIcon({ id }: { id: ChatMentionTagId }) {
  const color = tagAccentColor(id);
  if (id === "report") {
    return <Flag className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />;
  }
  return <Package className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />;
}

export default function ChatMentionTagSuggest({
  open,
  tags,
  highlightIndex,
  onSelect,
  onHighlightChange,
}: ChatMentionTagSuggestProps) {
  if (!open) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg"
      role="listbox"
      aria-label="Mention tags"
    >
      {tags.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">No matching tags</p>
      ) : (
        tags.map((tag, index) => (
          <button
            key={tag.id}
            type="button"
            role="option"
            aria-selected={index === highlightIndex}
            onMouseEnter={() => onHighlightChange(index)}
            onClick={() => onSelect(tag)}
            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
              index === highlightIndex ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <TagIcon id={tag.id} />
            <div className="min-w-0">
              <p className="font-medium">
                <span style={{ color: tagAccentColor(tag.id) }}>{tag.token}</span>
                <span className="text-muted-foreground font-normal"> — {tag.label}</span>
              </p>
              <p className="text-xs text-muted-foreground truncate">{tag.description}</p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function tagHighlightStyle(id: ChatMentionTagId): { color: string; backgroundColor: string } {
  if (id === "report") {
    return { color: ICON_COLORS.admin, backgroundColor: `${ICON_COLORS.admin}1A` };
  }
  return { color: MARKETPLACE_THEME.primary, backgroundColor: `${MARKETPLACE_THEME.primary}1A` };
}

export { tagHighlightStyle };
