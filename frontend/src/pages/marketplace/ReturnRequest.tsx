import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useOrders } from "@/contexts/OrderContext";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";

const RETURN_REASONS = [
  "Wrong item received",
  "Item damaged or defective",
  "Item does not match description",
  "Missing parts or accessories",
  "Product quality issue",
  "Changed my mind",
  "Other",
];

export default function ReturnRequest() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getOrder, requestReturn } = useOrders();
  const order = getOrder(orderId || "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  if (!order || order.status !== "delivered") {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">This order is not eligible for return.</p>
        <Button variant="ghost" onClick={() => navigate("/orders")} className="mt-4">Back to Orders</Button>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!reason) { toast.error("Please select a reason"); return; }
    requestReturn(order.id, reason, note);
    toast.success("Return request submitted successfully!");
    navigate(`/orders/${order.id}`);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto overflow-hidden">
      <Button variant="ghost" onClick={() => navigate(`/orders/${order.id}`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to Order</Button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Request Return / Refund</h1>
        <p className="text-muted-foreground mt-1">Order #{order.id.slice(0, 10).toUpperCase()}</p>
      </motion.div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${ICON_COLORS.marketplace})` }} />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <RotateCcw className="h-5 w-5" style={{ color: ICON_COLORS.finance }} />
            Why are you returning this order?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {RETURN_REASONS.map(r => (
              <label key={r} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${reason === r ? "border-2 bg-accent/30" : "border-border hover:bg-accent/10"}`} style={reason === r ? { borderColor: ICON_COLORS.finance } : undefined}>
                <RadioGroupItem value={r} />
                <span className="text-sm text-foreground">{r}</span>
              </label>
            ))}
          </RadioGroup>

          <div>
            <Label>Additional Details (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Describe the issue in more detail..." rows={3} />
          </div>

          {/* Items being returned */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Items to return:</p>
            {order.items.map(item => (
              <div key={item.productId} className="flex items-center gap-3 p-2 rounded bg-accent/20">
                <div className="h-8 w-8 rounded bg-accent/30 flex items-center justify-center shrink-0">
                  <img src={item.image} alt={item.name} className="h-5 w-5 object-contain opacity-50" />
                </div>
                <span className="text-sm text-foreground flex-1">{item.name} × {item.qty}</span>
                <span className="text-sm font-medium text-foreground">৳{(item.price * item.qty).toLocaleString()}</span>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">Refund amount: <span className="font-bold" style={{ color: ICON_COLORS.marketplace }}>৳{order.total.toLocaleString()}</span></p>
          </div>

          <Button onClick={handleSubmit} className="w-full text-white" style={{ backgroundColor: ICON_COLORS.finance }} disabled={!reason}>
            <RotateCcw className="h-4 w-4 mr-2" />Submit Return Request
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
