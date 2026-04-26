import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function AccessDenied() {
  const { user } = useAuth();
  const homeRoute = user ? getDefaultRoute(user.primaryRole) : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="shadow-elevated border-0 overflow-hidden">
          <div className="h-1.5 bg-destructive" />
          <CardContent className="p-8 text-center space-y-5">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Access Denied</h2>
              <p className="text-muted-foreground mt-2">
                You don't have permission to access this page. This feature may require additional capabilities or a different account role.
              </p>
            </div>
            <Link to={homeRoute}>
              <Button className="bg-gradient-hero text-primary-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
