import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "lucide-react";
import { submitConversationReport } from "@/lib/marketplaceChatReportApi";
import { toast } from "sonner";

const REASONS = [
  "Harassment or abuse",
  "Scam or fraud",
  "Off-platform contact attempt",
  "Misleading product information",
  "Other",
];

interface ChatConversationReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onSubmitted?: () => void;
}

export default function ChatConversationReportDialog({
  open,
  onOpenChange,
  conversationId,
  onSubmitted,
}: ChatConversationReportDialogProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    const result = await submitConversationReport(conversationId, reason, details);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.message);
      if (result.alreadyReported) onSubmitted?.();
      return;
    }

    toast.success("Report submitted — our team will review this conversation.");
    onSubmitted?.();
    onOpenChange(false);
    setReason("");
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report conversation
          </DialogTitle>
          <DialogDescription>
            Tell us what happened. FarmBondhu support will review this chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Additional details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
