import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
  gradient?: string;
  iconColor?: string;
  index?: number;
  href?: string;
  onClick?: () => void;
}

export default function StatCard({ title, value, icon, trend, className, gradient, iconColor, index = 0, href, onClick }: StatCardProps) {
  const navigate = useNavigate();
  const isClickable = !!(href || onClick);

  const handleClick = () => {
    if (onClick) onClick();
    else if (href) navigate(href);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group",
          isClickable && "cursor-pointer",
          className
        )}
        onClick={isClickable ? handleClick : undefined}
      >
        <div className={cn("h-1", !iconColor && (gradient || "bg-gradient-hero"))} style={iconColor ? { background: `linear-gradient(to right, ${iconColor}, ${iconColor}80)` } : undefined} />
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-display font-bold text-card-foreground">{value}</p>
              {trend && (
                <p className={cn("text-xs font-medium", trend.value >= 0 ? "text-secondary" : "text-destructive")}>
                  {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              {iconColor ? (
                <div
                  className="h-11 w-11 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
                >
                  {icon}
                </div>
              ) : (
                <div className={cn(
                  "h-11 w-11 rounded-lg flex items-center justify-center text-primary-foreground transition-transform duration-300 group-hover:scale-110",
                  gradient || "bg-gradient-hero"
                )}>
                  {icon}
                </div>
              )}
              {isClickable && (
                <ArrowRight
                  className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
