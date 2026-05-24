import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COW_WEIGHT_THEME } from "@/lib/cowWeight/cowWeightTheme";
import type { ScanStepId } from "@/lib/cowWeight/types";

interface ScanStepperProps {
  current: ScanStepId;
  labels: string[];
}

export default function ScanStepper({ current, labels }: ScanStepperProps) {
  return (
    <ol className="flex flex-wrap gap-1 sm:gap-2 justify-between mb-4">
      {labels.map((label, i) => {
        const step = (i + 1) as ScanStepId;
        const done = step < current;
        const active = step === current;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-1 text-xs sm:text-sm px-2 py-1.5 rounded-md flex-1 min-w-[52px] justify-center",
              done && "bg-secondary/20 text-secondary",
              !active && !done && "text-muted-foreground bg-muted/40"
            )}
            style={
              active
                ? { backgroundColor: COW_WEIGHT_THEME.farm, color: "#ffffff", fontWeight: 500 }
                : undefined
            }
          >
            {done ? <Check className="h-4 w-4 shrink-0" /> : <span className="font-mono text-sm">{step}</span>}
            <span className="truncate hidden sm:inline">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
