import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserPlus, Mail, Lock, User, Phone, MapPin, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const ROLES: { value: UserRole; label: string; icon: string; desc: string }[] = [
  { value: "farmer", label: "Farmer", icon: "🧑‍🌾", desc: "Manage farms & livestock" },
  { value: "buyer", label: "Buyer", icon: "🛒", desc: "Purchase products" },
  { value: "vendor", label: "Vendor", icon: "🏪", desc: "Sell products" },
  { value: "vet", label: "Veterinarian", icon: "👩‍⚕️", desc: "Provide animal care" },
];

export default function Signup() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { sendSignupOtp, completeSignupWithOtp, resendSignupOtp } = useAuth();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { toast } = useToast();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    const isVet = role === "vet";
    const result = await sendSignupOtp({
      name,
      email,
      password,
      role,
      phone,
      location,
      district: location,
      address: address || undefined,
      specialization: isVet ? specialization : undefined,
      experience_years: isVet && experienceYears !== "" ? Number(experienceYears) : undefined,
      consultation_fee: isVet && consultationFee !== "" ? Number(consultationFee) : undefined,
    });
    setLoading(false);
    if (result.success) {
      setStep(3);
      toast({
        title: "Code sent",
        description: `Check ${email} for a 6-digit verification code.`,
      });
    } else {
      toast({
        title: "Could not send code",
        description: result.error?.trim() || "Check the API connection and server settings, then try again.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      toast({ title: "Invalid code", description: "Enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const result = await completeSignupWithOtp(email, code);
    setLoading(false);
    if (result.success) {
      setRegistered(true);
      toast({ title: "Welcome!", description: "Your account is ready." });
      navigate(role === "vet" ? "/vet/profile" : "/", { replace: true });
    } else {
      toast({ title: "Verification failed", description: result.error || "Invalid or expired code.", variant: "destructive" });
    }
  };

  const handleResend = async () => {
    setLoading(true);
    const result = await resendSignupOtp(email);
    setLoading(false);
    if (result.success) {
      toast({ title: "Code resent", description: "Check your inbox again." });
    } else {
      toast({
        title: "Could not resend",
        description: result.error?.trim() || "Check the API connection and server settings, then try again.",
        variant: "destructive",
      });
    }
  };

  const fromLogin = (routeLocation.state as { from?: string })?.from === "login";
  const backTo = fromLogin ? "/login" : "/";
  const backLabel = fromLogin ? "Back to Sign In" : "Back to Home";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4 relative">
      <Link to={backTo} className="absolute top-4 left-4 flex items-center gap-1.5 text-primary-foreground/80 hover:text-primary-foreground transition-colors text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-4xl font-display font-bold text-primary-foreground">🐄 FarmBondhu</h1>
          </Link>
          <p className="text-primary-foreground/80 mt-2 font-body">Create a new account</p>
        </div>

        <Card className="shadow-elevated border-0 overflow-hidden">
          <div className="h-1 bg-gradient-hero" />
          <CardHeader className="text-center pb-2">
            <h2 className="text-2xl font-display font-bold text-foreground">Register</h2>
            {!registered && (
              <>
                <p className="text-muted-foreground text-sm">Step {step} of 3</p>
                <div className="flex gap-2 mt-2">
                  <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
                  <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
                  <div className={`h-1 flex-1 rounded-full ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
                </div>
              </>
            )}
          </CardHeader>
          <CardContent>
            {registered ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircle className="h-16 w-16 text-primary mx-auto" />
                <p className="text-foreground font-medium">You&apos;re signed in</p>
                <p className="text-muted-foreground text-sm">Taking you to the app…</p>
              </div>
            ) : step === 1 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">What type of user are you?</p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-card ${
                        role === r.value ? "border-primary bg-accent" : "border-border bg-card"
                      }`}
                    >
                      <span className="text-2xl">{r.icon}</span>
                      <p className="font-semibold text-card-foreground mt-1">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </button>
                  ))}
                </div>
                <Button onClick={() => role && setStep(2)} className="w-full bg-gradient-hero text-primary-foreground" size="lg" disabled={!role}>
                  Next Step
                </Button>
              </div>
            ) : step === 2 ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="s-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="s-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="s-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="s-password" type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-10" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="location" placeholder="Your district/area" value={location} onChange={(e) => setLocation(e.target.value)} className="pl-10" />
                  </div>
                </div>

                {role === "vet" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        placeholder="Village/road/address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialization">Specialization</Label>
                      <Input
                        id="specialization"
                        placeholder="Poultry, Dairy, General Veterinary etc."
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="experience_years">Experience (years)</Label>
                        <Input
                          id="experience_years"
                          type="number"
                          min={0}
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consultation_fee">Consultation Fee (BDT)</Label>
                        <Input
                          id="consultation_fee"
                          type="number"
                          min={0}
                          value={consultationFee}
                          onChange={(e) => setConsultationFee(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 bg-gradient-hero text-primary-foreground btn-shiny" disabled={loading}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {loading ? "Sending…" : "Send code"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  We sent a 6-digit code to <strong>{email}</strong>. Enter it below to finish registration.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-2xl tracking-[0.4em] font-mono"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground btn-shiny" disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying…" : "Verify & create account"}
                </Button>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleResend} disabled={loading}>
                    Resend code
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setStep(2); setOtp(""); }}>
                    Edit email or password
                  </Button>
                </div>
              </form>
            )}

            {!registered && (
              <div className="mt-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary font-semibold hover:underline">
                    Sign In
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
