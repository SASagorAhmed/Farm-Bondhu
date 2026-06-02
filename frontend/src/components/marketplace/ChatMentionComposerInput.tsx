import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import ChatMentionTagSuggest, { tagHighlightStyle } from "@/components/marketplace/ChatMentionTagSuggest";
import {
  detectNewlyCompletedMentionTag,
  filterMentionTags,
  findActiveMentionQuery,
  insertMentionTag,
  MARKETPLACE_CHAT_MENTION_TAGS,
  splitTextWithMentionTags,
  type ChatMentionTagDefinition,
  type ChatMentionTagId,
} from "@/lib/marketplaceChatMentions";
import { cn } from "@/lib/utils";

interface ChatMentionComposerInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionTagCompleted?: (tagId: ChatMentionTagId, text: string) => void;
  mentionTags?: ChatMentionTagDefinition[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function ChatMentionComposerInput({
  value,
  onChange,
  onMentionTagCompleted,
  mentionTags = MARKETPLACE_CHAT_MENTION_TAGS,
  disabled,
  placeholder,
  className,
  id,
  name,
  onKeyDown,
}: ChatMentionComposerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef(value);
  const activeRangeRef = useRef<{ start: number; end: number } | null>(null);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [filteredTags, setFilteredTags] = useState<ChatMentionTagDefinition[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const updateSuggestState = useCallback(
    (text: string, cursorIndex: number) => {
      const active = findActiveMentionQuery(text, cursorIndex, mentionTags);
      if (active) {
        activeRangeRef.current = { start: active.start, end: active.end };
        const tags = filterMentionTags(active.query, mentionTags);
        setFilteredTags(tags);
        setSuggestOpen(true);
        setHighlightIndex(0);
      } else {
        activeRangeRef.current = null;
        setSuggestOpen(false);
        setFilteredTags([]);
      }
    },
    [mentionTags]
  );

  const applyTagInsert = useCallback(
    (tag: ChatMentionTagDefinition) => {
      const range = activeRangeRef.current;
      if (!range) return;
      const { text, cursor } = insertMentionTag(value, range, tag);
      prevValueRef.current = text;
      onChange(text);
      onMentionTagCompleted?.(tag.id, text);
      setSuggestOpen(false);
      activeRangeRef.current = null;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(cursor, cursor);
      });
    },
    [onChange, onMentionTagCompleted, value]
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    const cursor = event.target.selectionStart ?? next.length;
    updateSuggestState(next, cursor);
    onChange(next);

    for (const tag of mentionTags) {
      if (detectNewlyCompletedMentionTag(prevValueRef.current, next, tag.id)) {
        onMentionTagCompleted?.(tag.id, next);
      }
    }
    prevValueRef.current = next;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestOpen && filteredTags.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIndex((i) => (i + 1) % filteredTags.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((i) => (i - 1 + filteredTags.length) % filteredTags.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyTagInsert(filteredTags[highlightIndex] ?? filteredTags[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggestOpen(false);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div className="relative flex-1 min-w-0 overflow-visible">
      <ChatMentionTagSuggest
        open={suggestOpen}
        tags={filteredTags}
        highlightIndex={highlightIndex}
        onSelect={applyTagInsert}
        onHighlightChange={setHighlightIndex}
      />
      {value ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-0 flex h-10 w-full items-center overflow-hidden rounded-md border border-transparent bg-background px-3 py-2 text-base md:text-sm whitespace-pre",
            disabled && "opacity-50"
          )}
        >
          {splitTextWithMentionTags(value, mentionTags).map((segment, index) =>
            segment.type === "tag" && segment.tagId ? (
              <span
                key={`${index}-${segment.value}`}
                className="rounded-sm font-semibold"
                style={tagHighlightStyle(segment.tagId)}
              >
                {segment.value}
              </span>
            ) : (
              <span key={`${index}-text`} className="text-foreground">
                {segment.value}
              </span>
            )
          )}
        </div>
      ) : null}
      <Input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => updateSuggestState(value, e.currentTarget.selectionStart ?? value.length)}
        onSelect={(e) => updateSuggestState(value, e.currentTarget.selectionStart ?? value.length)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "relative z-[1] bg-transparent text-transparent caret-foreground placeholder:text-muted-foreground selection:bg-primary/20 selection:text-transparent",
          className
        )}
        autoComplete="off"
      />
    </div>
  );
}
