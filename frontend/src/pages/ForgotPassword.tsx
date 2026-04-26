import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Mail, Lock, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await api.auth.sendPasswordResetOtp(email);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setStep(2);
      toast({
        title: "Check your email",
        description: "If an account exists for this address, we sent a 6-digit code.",
      });
    }
  };

  const handleResend = async () => {
    setLoading(true);
    const { error } = await api.auth.resendPasswordResetOtp(email);
    setLoading(false);
    if (error) {
      toast({ title: "Could not resend", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Code resent", description: "Check your inbox again." });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      toast({ title: "Invalid code", description: "Enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await api.auth.verifyPasswordResetOtp({
      email,
      otp: code,
      newPassword,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } else {
      setDone(true);
      toast({ title: "Password updated", description: "You can sign in with your new password." });
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
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
        </div>

        <Card className="shadow-elevated border-0 overflow-hidden">
          <div className="h-1 bg-gradient-hero" />
          <CardHeader className="text-center pb-2">
            <h2 className="text-2xl font-display font-bold text-foreground">Reset Password</h2>
            <p className="text-muted-foreground text-sm">Step {step} of 2</p>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircle className="h-16 w-16 text-primary mx-auto" />
                <p className="text-foreground font-medium">Password updated</p>
                <Link to="/login">
                  <Button variant="outline" className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              </div>
            ) : step === 1 ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <p className="text-muted-foreground text-sm text-center">
                  Enter your email. We&apos;ll send a 6-digit code to reset your password (via Brevo).
                </p>
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fp-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground" size="lg" disabled={loading}>
                  {loading ? "Sending…" : "Send code"}
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-primary hover:underline">
                    <ArrowLeft className="inline h-3 w-3 mr-1" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Code sent to <strong>{email}</strong>. Enter it below and choose a new password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="fp-otp">Verification code</Label>
                  <Input
                    id="fp-otp"
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
                <div className="space-y-2">
                  <Label htmlFor="fp-new">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fp-new"
                      type="password"
                      placeholder="••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-confirm">Confirm new password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fp-confirm"
                      type="password"
                      placeholder="••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground" size="lg" disabled={loading || otp.length !== 6}>
                  {loading ? "Updating…" : "Update password"}
                </Button>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleResend} disabled={loading}>
                    Resend code
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setStep(1); setOtp(""); }}>
                    Change email
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
