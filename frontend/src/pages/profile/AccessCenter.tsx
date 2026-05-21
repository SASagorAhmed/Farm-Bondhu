import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, API_BASE, readSession } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Tractor, Stethoscope, Store, Building2,
  CheckCircle, Clock, XCircle, ArrowRight, Shield, ArrowLeft, Trash2,
  Power, PowerOff, PauseCircle,
} from "lucide-react";
import AccessRequestForm from "@/components/profile/AccessRequestForm";

interface AccessCard {
  type: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  requirements: string[];
  capability: string;
}

const ACCESS_CARDS: AccessCard[] = [
  {
    type: "farm_management_access",
    title: "Farm Management",
    description: "Access full farm ERP — manage farms, animals, feed, health, production, and reports.",
    icon: Tractor,
    iconColor: "hsl(var(--primary))",
    requirements: ["Farm ownership or operation details", "Location information", "Animal type and capacity"],
    capability: "can_manage_farm",
  },
  {
    type: "vet_service_access",
    title: "Vet Consultation Services",
    description: "Book chat, voice, and video consultations with verified veterinarians for your animals.",
    icon: Stethoscope,
    iconColor: "hsl(160, 84%, 39%)",
    requirements: ["Animal types you manage", "Location for service area", "Contact information"],
    capability: "can_book_vet",
  },
  {
    type: "human_doctor_access",
    title: "MediBondhu Human Doctors",
    description: "Book outpatient slots with verified physicians — separate from animal VetBondhu care.",
    icon: Stethoscope,
    iconColor: "hsl(188, 84%, 45%)",
    requirements: ["Valid profile", "Contact information"],
    capability: "can_book_human",
  },
  {
    type: "seller_access",
    title: "Seller / Vendor Access",
    description: "Open your own shop on the marketplace — list products, manage orders, and grow your business.",
    icon: Store,
    iconColor: "hsl(25, 95%, 53%)",
    requirements: ["Business or farm details", "Product categories", "Contact and payment info"],
    capability: "can_sell",
  },
  {
    type: "business_buyer_access",
    title: "Business / Wholesale Buyer",
    description: "Access bulk purchasing, wholesale pricing, and B2B features for large-scale orders.",
    icon: Building2,
    iconColor: "hsl(262, 83%, 58%)",
    requirements: ["Business registration details", "Expected order volume", "Delivery location"],
    capability: "can_bulk_buy",
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Under Review", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

interface RequestRecord {
  id: string;
  request_type: string;
  status: string;
  created_at: string;
  details: Record<string, string> | null;
}

interface CapabilityRecord {
  id: string;
  capability_code: string;
  is_enabled: boolean;
}

export default function AccessCenter() {
  const { user, refreshProfile, hasCapability, hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [farmerLandingSaving, setFarmerLandingSaving] = useState(false);

  useEffect(() => {
    const requestType = searchParams.get("request");
    if (requestType && ACCESS_CARDS.some(c => c.type === requestType)) {
      setActiveForm(requestType);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchData = async () => {
    if (!user) return;
    const [reqRes, capRes] = await Promise.all([
      api
        .from("approval_requests")
        .select("id, request_type, status, created_at, details")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      api
        .from("user_capabilities")
        .select("id, capability_code, is_enabled")
        .eq("user_id", user.id),
    ]);
    setRequests((reqRes.data as RequestRecord[]) || []);
    const rawCaps = (Array.isArray(capRes.data) ? capRes.data : []) as Record<string, unknown>[];
    if (capRes.error) {
      toast({
        title: "Could not load access settings",
        description: capRes.error.message,
        variant: "destructive",
      });
    }
    setCapabilities(
      rawCaps.map((c) => ({
        id: `${String(c.user_id ?? user.id)}:${String(c.capability_code ?? "")}`,
        capability_code: String(c.capability_code ?? ""),
        is_enabled: Boolean(c.is_enabled),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const statusMap: Record<string, string> = {};
  for (const r of requests) {
    if (!statusMap[r.request_type]) {
      statusMap[r.request_type] = r.status;
    }
  }

  const capabilityMap: Record<string, CapabilityRecord> = {};
  for (const c of capabilities) {
    capabilityMap[c.capability_code] = c;
  }

  const handleRequestSubmit = async (type: string, payload: Record<string, string>) => {
    if (!user) return;
    const { error } = await api.from("approval_requests").insert({
      user_id: user.id,
      request_type: type,
      details: payload,
      status: "pending",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request Submitted", description: "Your access request is under review." });
    setActiveForm(null);
    fetchData();
  };

  const handleWithdraw = async (requestId: string) => {
    if (!user) return;
    setWithdrawing(requestId);
    const { error } = await api
      .from("approval_requests")
      .delete()
      .eq("id", requestId)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Request Withdrawn", description: "Your access request has been cancelled." });
      await fetchData();
    }
    setWithdrawing(null);
  };

  const handleToggleCapability = async (capabilityCode: string, newEnabled: boolean) => {
    if (!user) return;
    setToggling(capabilityCode);

    const { error } = await api.from("user_capabilities").upsert({
      user_id: user.id,
      capability_code: capabilityCode,
      is_enabled: newEnabled,
    });

    if (error) {
      toast({
        title: "Could not update access",
        description: error.message || "Request failed.",
        variant: "destructive",
      });
      await fetchData();
      await refreshProfile();
    } else {
      toast({
        title: newEnabled ? "Access enabled" : "Access disabled",
        description: newEnabled
          ? "Workspace is now visible in your sidebar."
          : "Workspace hidden from your sidebar. You can re-enable anytime.",
      });
      await fetchData();
      await refreshProfile();
    }
    setToggling(null);
  };

  const handleFarmerMediLanding = async (checked: boolean) => {
    const token = readSession()?.access_token;
    if (!user || !token) {
      toast({ title: "Error", description: "Not signed in", variant: "destructive" });
      return;
    }
    setFarmerLandingSaving(true);
    try {
      const r = await fetch(`${API_BASE}/v1/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ farmer_open_medibondhu: checked }),
      });
      const text = await r.text();
      let body: { error?: string } = {};
      try {
        body = text ? (JSON.parse(text) as { error?: string }) : {};
      } catch {
        /* ignore */
      }
      if (!r.ok) {
        toast({
          title: "Error",
          description: body.error || `Could not save preference (${r.status})`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Preference saved",
        description: checked ? "You will land on MediBondhu after sign-in." : "You will land on your dashboard after sign-in.",
      });
      await refreshProfile();
    } finally {
      setFarmerLandingSaving(false);
    }
  };

  if (activeForm) {
    const card = ACCESS_CARDS.find((c) => c.type === activeForm);
    return (
      <AccessRequestForm
        type={activeForm}
        title={card?.title || ""}
        onSubmit={(payload) => handleRequestSubmit(activeForm, payload)}
        onCancel={() => setActiveForm(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Access Center</h1>
            <p className="text-muted-foreground mt-1">Request access to additional FarmBondhu features and modules.</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ACCESS_CARDS.map((card, i) => {
          const cap = capabilityMap[card.capability];
          const roleDefault = !cap && hasCapability(card.capability); // active via role_permissions
          const hasCapEnabled = cap?.is_enabled === true || roleDefault;
          const hasCapDisabled = cap && !cap.is_enabled;
          const isFarmerDoctorAccess = card.capability === "can_book_human" && hasRole("farmer");
          const requestStatus = isFarmerDoctorAccess ? undefined : statusMap[card.type];
          const isPending = requestStatus === "pending";
          const isRejected = requestStatus === "rejected";
          const pendingRequest = isPending ? requests.find(r => r.request_type === card.type && r.status === "pending") : null;

          // Determine card state
          const canRequest = !isFarmerDoctorAccess && !cap && !roleDefault && !requestStatus;

          return (
            <motion.div key={card.type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={`h-full transition-all duration-200 ${
                hasCapEnabled ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20" :
                hasCapDisabled ? "border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/20" : ""
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.iconColor}15` }}>
                        <card.icon className="h-5 w-5" style={{ color: card.iconColor }} />
                      </div>
                      <CardTitle className="text-base">{card.title}</CardTitle>
                    </div>
                    {hasCapEnabled && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" /> Active
                      </Badge>
                    )}
                    {hasCapDisabled && (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <PauseCircle className="h-3 w-3 mr-1" /> Paused
                      </Badge>
                    )}
                    {isPending && (
                      <Badge className={STATUS_CONFIG.pending.color}>
                        <Clock className="h-3 w-3 mr-1" /> {STATUS_CONFIG.pending.label}
                      </Badge>
                    )}
                    {isRejected && !cap && (
                      <Badge className={STATUS_CONFIG.rejected.color}>
                        <XCircle className="h-3 w-3 mr-1" /> {STATUS_CONFIG.rejected.label}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-2">{card.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Requirements - show only when no capability yet */}
                  {!cap && !isFarmerDoctorAccess && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Requirements:</p>
                      <ul className="space-y-1">
                        {card.requirements.map((req, j) => (
                          <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* State: No request yet */}
                  {canRequest && (
                    <Button size="sm" className="w-full" onClick={() => setActiveForm(card.type)}>
                      Request Access <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}

                  {/* Farmer + human doctor access: no request workflow, simple direct enable/disable */}
                  {isFarmerDoctorAccess && !hasCapEnabled && !hasCapDisabled && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground text-center">
                        Doctor booking is available for farmers. Enable it anytime.
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleToggleCapability(card.capability, true)}
                        disabled={toggling === card.capability}
                      >
                        <Power className="h-3.5 w-3.5 mr-1" />
                        {toggling === card.capability ? "Enabling..." : "Enable Access"}
                      </Button>
                    </div>
                  )}

                  {/* State: Pending */}
                  {isPending && pendingRequest && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground text-center">
                        Submitted {new Date(pendingRequest.created_at).toLocaleDateString()}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleWithdraw(pendingRequest.id)}
                        disabled={withdrawing === pendingRequest.id}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {withdrawing === pendingRequest.id ? "Withdrawing..." : "Withdraw Request"}
                      </Button>
                    </div>
                  )}

                  {/* State: Rejected */}
                  {isRejected && !cap && (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setActiveForm(card.type)}>
                      Re-apply
                    </Button>
                  )}

                  {/* State: Approved & Enabled */}
                  {hasCapEnabled && (
                    <div className="space-y-2">
                      <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">✓ You have full access to this module.</p>
                      {card.capability === "can_book_human" && (
                        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-left">
                          <div className="space-y-0.5 pr-2 min-w-0">
                            <Label htmlFor={`medi-landing-${card.type}`} className="text-sm font-medium cursor-pointer">
                              Open MediBondhu after sign-in
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              When off, you start on your dashboard. This does not turn off MediBondhu access.
                            </p>
                          </div>
                          <Switch
                            id={`medi-landing-${card.type}`}
                            checked={user?.farmerOpenMedibondhu !== false}
                            onCheckedChange={(v) => void handleFarmerMediLanding(v)}
                            disabled={farmerLandingSaving}
                            className="shrink-0 mt-0.5"
                          />
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-muted-foreground"
                        onClick={() => handleToggleCapability(card.capability, false)}
                        disabled={toggling === card.capability}
                      >
                        <PowerOff className="h-3.5 w-3.5 mr-1" />
                        {toggling === card.capability ? "Disabling..." : "Disable Access"}
                      </Button>
                    </div>
                  )}

                  {/* State: Approved & Disabled */}
                  {hasCapDisabled && (
                    <div className="space-y-2">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center font-medium">Access is paused. Re-enable anytime.</p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleToggleCapability(card.capability, true)}
                        disabled={toggling === card.capability}
                      >
                        <Power className="h-3.5 w-3.5 mr-1" />
                        {toggling === card.capability ? "Enabling..." : "Enable Access"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
