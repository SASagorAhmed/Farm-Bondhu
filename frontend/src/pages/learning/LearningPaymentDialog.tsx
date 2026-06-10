import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ICON_COLORS } from "@/lib/iconColors";
import type { LearningCourse, LearningPaymentPayload } from "@/lib/learningCourseApi";

const PAYMENT_METHODS = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "bank", label: "Bank" },
  { value: "cash_manual", label: "Cash/manual" },
];

type Props = {
  course: LearningCourse | null;
  open: boolean;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: LearningPaymentPayload) => Promise<void>;
};

function priceLabel(course: LearningCourse | null) {
  if (!course) return "";
  return `${course.currency || "BDT"} ${Number(course.price || 0).toLocaleString()}`;
}

function senderFieldCopy(method: string) {
  if (method === "bank") return { label: "Bank account / reference", placeholder: "Account number or bank note" };
  if (method === "cash_manual") return { label: "Contact number", placeholder: "01XXXXXXXXX" };
  return { label: "Payment number", placeholder: "01XXXXXXXXX" };
}

export function LearningPaymentDialog({ course, open, submitting = false, onOpenChange, onSubmit }: Props) {
  const [paymentMethod, setPaymentMethod] = useState("bkash");
  const [paymentSender, setPaymentSender] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const senderCopy = senderFieldCopy(paymentMethod);

  useEffect(() => {
    if (!open) return;
    setPaymentMethod("bkash");
    setPaymentSender("");
    setPaymentNote("");
  }, [open, course?.id]);

  const submit = async () => {
    if (!course) return;
    if (!paymentSender.trim()) {
      toast({ title: `${senderCopy.label} is required`, description: "Enter the payment information for the selected method.", variant: "destructive" });
      return;
    }
    await onSubmit({
      payment_method: paymentMethod,
      payment_sender: paymentSender.trim(),
      payment_note: paymentNote.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: ICON_COLORS.learning }} />
            Mock Course Payment
          </DialogTitle>
          <DialogDescription>
            Complete this mock payment to unlock the course immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Summary</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{course?.title || "Paid course"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose a payment method, enter your payment number, then pay to unlock instantly.</p>
              </div>
              <p className="shrink-0 font-bold" style={{ color: ICON_COLORS.learning }}>{priceLabel(course)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{senderCopy.label}</Label>
              <Input value={paymentSender} onChange={(e) => setPaymentSender(e.target.value)} placeholder={senderCopy.placeholder} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Optional payment note" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button className="text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Processing..." : `Pay ${priceLabel(course)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
