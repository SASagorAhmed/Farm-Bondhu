import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Legacy route for Supabase magic-link recovery. Password reset is now OTP-based on /forgot-password.
 */
export default function ResetPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="shadow-elevated border-0 overflow-hidden">
          <div className="h-1 bg-gradient-hero" />
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-xl font-display font-bold text-foreground">Password reset</h2>
            <p className="text-muted-foreground text-sm">
              We use a 6-digit email code (sent through Brevo) instead of a magic link. Use Forgot password to get a code and set a new password.
            </p>
            <Link to="/forgot-password">
              <Button className="w-full bg-gradient-hero text-primary-foreground">Go to Forgot password</Button>
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
