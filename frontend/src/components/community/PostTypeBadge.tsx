import { Badge } from "@/components/ui/badge";
import { HelpCircle, MessageSquare, BookOpen, AlertTriangle, Lightbulb } from "lucide-react";

const POST_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  question: { label: "Question", color: "#3B82F6", icon: HelpCircle },
  discussion: { label: "Discussion", color: "#8B5CF6", icon: MessageSquare },
  experience: { label: "Experience", color: "#10B981", icon: BookOpen },
  help_request: { label: "Help Request", color: "#F43F5E", icon: AlertTriangle },
  knowledge_share: { label: "Knowledge", color: "#F59E0B", icon: Lightbulb },
};

export default function PostTypeBadge({ type }: { type: string }) {
  const config = POST_TYPE_CONFIG[type] || POST_TYPE_CONFIG.discussion;
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 gap-1" style={{ backgroundColor: `${config.color}1A`, color: config.color }}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
