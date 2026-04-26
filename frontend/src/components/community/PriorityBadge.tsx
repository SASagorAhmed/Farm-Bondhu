import { Badge } from "@/components/ui/badge";

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: "#6B7280" },
  important: { label: "Important", color: "#F59E0B" },
  urgent: { label: "Urgent", color: "#F43F5E" },
  expert_needed: { label: "Expert Needed", color: "#8B5CF6" },
};

export default function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "normal") return null;
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  return (
    <Badge variant="secondary" className="text-[10px] h-5 px-1.5" style={{ backgroundColor: `${config.color}1A`, color: config.color }}>
      {config.label}
    </Badge>
  );
}
