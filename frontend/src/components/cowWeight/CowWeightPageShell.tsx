import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CowWeightPageShellProps {
  children: ReactNode;
  className?: string;
}

/** Full-width page wrapper — matches other dashboard pages (e.g. Animals). */
export default function CowWeightPageShell({ children, className }: CowWeightPageShellProps) {
  return (
    <div className={cn("space-y-6 w-full max-w-full overflow-hidden", className)}>
      {children}
    </div>
  );
}
