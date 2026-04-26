import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const REASONS = [
  "Spam",
  "Abusive content",
  "Fake medical advice",
  "Unsafe animal treatment",
  "Fake product promotion",
  "Other",
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  commentId?: string;
}

export default function ReportDialog({ open, onOpenChange, postId, commentId }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;
    setSubmitting(true);
    const { error } = await api.from("community_reports").insert({
      post_id: postId || null,
      comment_id: commentId || null,
      reported_by: user.id,
      reason: `${reason}${details ? `: ${details}` : ""}`,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: "Failed to submit report", variant: "destructive" });
    } else {
      toast({ title: "Report submitted", description: "Thank you. Our team will review this." });
      onOpenChange(false);
      setReason("");
      setDetails("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>Choose a reason and optional details, then submit for review.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
            <SelectContent>
              {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="Additional details (optional)" value={details} onChange={e => setDetails(e.target.value)} maxLength={500} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting} className="bg-destructive text-destructive-foreground">
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
