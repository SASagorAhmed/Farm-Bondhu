import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AdminUserAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

function initialsFromName(name?: string | null) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AdminUserAvatar({
  name,
  avatarUrl,
  logoUrl,
  className,
  fallbackClassName,
}: AdminUserAvatarProps) {
  const src = avatarUrl || logoUrl || undefined;
  const initials = initialsFromName(name);

  return (
    <Avatar className={cn("h-9 w-9", className)}>
      {src ? <AvatarImage src={src} alt={name || "User"} /> : null}
      <AvatarFallback className={cn("bg-muted text-muted-foreground text-xs font-semibold", fallbackClassName)}>
        {initials || <User className="h-4 w-4" />}
      </AvatarFallback>
    </Avatar>
  );
}
