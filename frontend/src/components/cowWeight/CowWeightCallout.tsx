import { cn } from "@/lib/utils";
import { cowWeightCallout, cowWeightCalloutFarmStyle } from "@/components/cowWeight/cowWeightCalloutStyles";

interface CowWeightCalloutProps {
  children: React.ReactNode;
  className?: string;
}

export default function CowWeightCallout({ children, className }: CowWeightCalloutProps) {
  return (
    <p className={cn(cowWeightCallout, className)} style={cowWeightCalloutFarmStyle}>
      {children}
    </p>
  );
}
