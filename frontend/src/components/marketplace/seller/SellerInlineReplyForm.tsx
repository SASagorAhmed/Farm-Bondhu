import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

interface Props {
  initialValue?: string;
  submitLabel?: string;
  editLabel?: string;
  maxLength?: number;
  onSubmit: (text: string) => Promise<boolean>;
  compact?: boolean;
}

export default function SellerInlineReplyForm({
  initialValue = "",
  submitLabel = "Post reply",
  editLabel = "Edit reply",
  maxLength = 1000,
  onSubmit,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(!initialValue);
  const [text, setText] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  if (!open && initialValue) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {editLabel}
      </Button>
    );
  }

  if (!open && !initialValue) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Reply
      </Button>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    const ok = await onSubmit(text.trim());
    setSubmitting(false);
    if (ok) {
      if (initialValue) setOpen(false);
      else setText("");
    }
  };

  return (
    <div className={`space-y-2 ${compact ? "" : "mt-2"}`}>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={compact ? 2 : 3}
        maxLength={maxLength}
        placeholder="Write a professional, helpful response…"
      />
      <div className="flex gap-2 justify-end flex-wrap">
        {(initialValue || compact) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setText(initialValue); }}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="text-white"
          style={{ backgroundColor: MARKETPLACE_THEME.primary }}
          disabled={submitting || !text.trim()}
          onClick={handleSubmit}
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
