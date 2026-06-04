import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ICON_COLORS } from "@/lib/iconColors";

const VB = ICON_COLORS.vetbondhu;

export default function VetBondhuAccessDenied() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-lg w-full rounded-2xl border-border shadow-sm overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: VB }} />
        <CardContent className="p-8 text-center space-y-4">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${VB}18` }}>
            <ShieldAlert className="h-7 w-7" style={{ color: VB }} />
          </span>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">VetBondhu access denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your VetBondhu access is currently restricted. Please contact FarmBondhu support for help.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild variant="outline">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild className="text-white" style={{ backgroundColor: VB }}>
              <Link to="/support">Contact support</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
