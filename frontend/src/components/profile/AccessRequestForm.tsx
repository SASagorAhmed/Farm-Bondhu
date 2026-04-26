import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  type: string;
  title: string;
  onSubmit: (payload: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

const FORM_FIELDS: Record<string, { label: string; key: string; type: "text" | "textarea" | "select"; options?: string[]; required?: boolean }[]> = {
  farm_management_access: [
    { label: "Full Name", key: "full_name", type: "text", required: true },
    { label: "Phone Number", key: "phone", type: "text", required: true },
    { label: "Location / District", key: "location", type: "text", required: true },
    { label: "Are you a farm owner?", key: "is_farm_owner", type: "select", options: ["Yes", "No", "Planning to start"], required: true },
    { label: "Farm Name", key: "farm_name", type: "text" },
    { label: "Farm Type", key: "farm_type", type: "select", options: ["Poultry", "Dairy / Cattle", "Goat", "Sheep", "Mixed", "Other"] },
    { label: "Estimated Animal Capacity", key: "capacity", type: "text" },
    { label: "Reason for Request", key: "reason", type: "textarea", required: true },
  ],
  vet_service_access: [
    { label: "Full Name", key: "full_name", type: "text", required: true },
    { label: "Phone Number", key: "phone", type: "text", required: true },
    { label: "Location / District", key: "location", type: "text", required: true },
    { label: "Animal Types You Own", key: "animal_types", type: "text", required: true },
    { label: "Expected Consultation Frequency", key: "frequency", type: "select", options: ["Rarely", "Monthly", "Weekly", "Daily"] },
    { label: "Reason for Request", key: "reason", type: "textarea", required: true },
  ],
  seller_access: [
    { label: "Full Name / Business Name", key: "business_name", type: "text", required: true },
    { label: "Phone Number", key: "phone", type: "text", required: true },
    { label: "Location", key: "location", type: "text", required: true },
    { label: "Seller Type", key: "seller_type", type: "select", options: ["Individual Farmer", "Farm Business", "Feed Supplier", "Medicine Supplier", "Equipment Vendor", "Other"], required: true },
    { label: "Products You Want to Sell", key: "products", type: "textarea", required: true },
    { label: "Business Registration (if any)", key: "registration", type: "text" },
  ],
  business_buyer_access: [
    { label: "Business Name", key: "business_name", type: "text", required: true },
    { label: "Contact Person", key: "contact_person", type: "text", required: true },
    { label: "Phone Number", key: "phone", type: "text", required: true },
    { label: "Location", key: "location", type: "text", required: true },
    { label: "Expected Monthly Order Volume", key: "volume", type: "text", required: true },
    { label: "Business Type", key: "business_type", type: "select", options: ["Restaurant", "Hotel", "Wholesale", "Processing Plant", "Retail Chain", "Other"], required: true },
    { label: "Additional Details", key: "details", type: "textarea" },
  ],
};

export default function AccessRequestForm({ type, title, onSubmit, onCancel }: Props) {
  const fields = FORM_FIELDS[type] || [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(values);
    setSubmitting(false);
  };

  const setValue = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }));

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Access Center
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Request {title} Access</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                  <Label htmlFor={field.key}>
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.type === "text" && (
                    <Input
                      id={field.key}
                      value={values[field.key] || ""}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      required={field.required}
                      className="mt-1"
                    />
                  )}
                  {field.type === "textarea" && (
                    <Textarea
                      id={field.key}
                      value={values[field.key] || ""}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      required={field.required}
                      className="mt-1"
                      rows={3}
                    />
                  )}
                  {field.type === "select" && field.options && (
                    <Select value={values[field.key] || ""} onValueChange={(v) => setValue(field.key, v)} required={field.required}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
