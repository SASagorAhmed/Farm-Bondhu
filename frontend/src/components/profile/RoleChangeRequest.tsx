import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useAuth, UserRole, formatUserRoleLabel } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRightLeft, Clock, CheckCircle, XCircle } from "lucide-react";

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: "buyer", label: "Buyer" },
  { value: "farmer", label: "Farmer" },
  { value: "vendor", label: "Vendor" },
  { value: "vet", label: "Veterinarian" },
];

const ROLE_COLORS: Record<string, string> = {
  buyer: "bg-blue-100 text-blue-800",
  farmer: "bg-green-100 text-green-800",
  vendor: "bg-orange-100 text-orange-800",
  vet: "bg-purple-100 text-purple-800",
  admin: "bg-red-100 text-red-800",
};

interface ExistingRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  details: { requested_role?: string; reason?: string };
  review_notes: string | null;
  created_at: string;
}

export default function RoleChangeRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<ExistingRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchExisting = async () => {
      const { data } = await api
        .from("approval_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("request_type", "role_change")
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setExisting(data[0] as any);
      }
      setLoading(false);
    };
    fetchExisting();
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !selectedRole || !reason.trim()) return;
    setSubmitting(true);

    const { error } = await api.from("approval_requests").insert({
      user_id: user.id,
      request_type: "role_change",
      details: { requested_role: selectedRole, reason: reason.trim(), current_role: user.primaryRole },
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Request Submitted", description: "Your role change request has been sent to admin for review." });
      // Refresh existing
      const { data } = await api
        .from("approval_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("request_type", "role_change")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setExisting(data[0] as any);
      setSelectedRole("");
      setReason("");
    }
    setSubmitting(false);
  };

  if (!user || loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const availableRoles = ALL_ROLES.filter((r) => r.value !== user.primaryRole);
  const hasPending = existing?.status === "pending";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          Change Role
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Current Role:</span>
          <Badge className={ROLE_COLORS[user.primaryRole]}>{formatUserRoleLabel(user)}</Badge>
        </div>

        {/* Show existing request status */}
        {existing && (
          <div className={`p-3 rounded-lg border ${
            existing.status === "pending" ? "border-yellow-300 bg-yellow-50" :
            existing.status === "approved" ? "border-green-300 bg-green-50" :
            "border-red-300 bg-red-50"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {existing.status === "pending" && <Clock className="h-4 w-4 text-yellow-600" />}
              {existing.status === "approved" && <CheckCircle className="h-4 w-4 text-green-600" />}
              {existing.status === "rejected" && <XCircle className="h-4 w-4 text-red-600" />}
              <span className="text-sm font-medium capitalize">{existing.status} Request</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Requested: <span className="font-medium capitalize">{(existing.details as any)?.requested_role}</span>
              {" · "}{new Date(existing.created_at).toLocaleDateString()}
            </p>
            {existing.review_notes && (
              <p className="text-xs text-muted-foreground mt-1">Admin notes: {existing.review_notes}</p>
            )}
          </div>
        )}

        {/* Show form if no pending request */}
        {!hasPending && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">New Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select desired role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Reason for change</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you want to change your role..."
                rows={3}
                maxLength={500}
                className="resize-none"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!selectedRole || !reason.trim() || submitting}
              className="w-full"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
              Submit Role Change Request
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
