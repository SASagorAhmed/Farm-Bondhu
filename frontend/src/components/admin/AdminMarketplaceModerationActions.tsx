import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CheckCircle, Lock, LockOpen, Trash2, UserX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminGreenbondhuConfirmDialog } from "@/components/admin/AdminGreenbondhuConfirmDialog";
import {
  moderateAdminBuyer,
  moderateAdminSeller,
  type ModerationAction,
} from "@/lib/adminMarketplaceApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSuperAdmin, useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryClient";

const statusColors: Record<string, string> = {
  active: "bg-secondary/15 text-secondary",
  suspended: "bg-destructive/15 text-destructive",
  deleted: "bg-muted text-muted-foreground",
};

type ModerationConfig = {
  action: ModerationAction;
  labelKey: string;
  descriptionKey: string;
  destructive?: boolean;
  icon: ReactNode;
  superAdminOnly?: boolean;
};

type Props = {
  role: "buyer" | "seller";
  userId: string;
  status: string;
  marketplaceBlocked: boolean;
  onDeleted?: () => void;
};

export function AdminMarketplaceModerationActions({
  role,
  userId,
  status,
  marketplaceBlocked,
  onDeleted,
}: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ModerationConfig | null>(null);

  const mutation = useMutation({
    mutationFn: ({ action, confirmPhrase }: { action: ModerationAction; confirmPhrase: string }) =>
      role === "buyer"
        ? moderateAdminBuyer(userId, action, confirmPhrase)
        : moderateAdminSeller(userId, action, confirmPhrase),
    onSuccess: (result, variables) => {
      const isRestoreAction = variables.action === "unblock" || variables.action === "activate";
      toast.success(
        isRestoreAction
          ? t("adminModeration.unblockSuccess")
          : result.message || t("adminModeration.success")
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceBuyers() });
      void queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceSellers() });
      void queryClient.invalidateQueries({ queryKey: ["admin-buyer-detail", userId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-seller-detail", userId] });
      setPending(null);
      if (result.deleted) onDeleted?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || t("adminModeration.error"));
    },
  });

  const actions: ModerationConfig[] = [
    status === "active"
      ? {
          action: "suspend",
          labelKey: "adminModeration.suspend",
          descriptionKey: "adminModeration.suspendDesc",
          icon: <Ban className="h-4 w-4" />,
        }
      : {
          action: "activate",
          labelKey: "adminModeration.activate",
          descriptionKey: "adminModeration.activateDesc",
          icon: <CheckCircle className="h-4 w-4" />,
        },
    marketplaceBlocked
      ? {
          action: "unblock",
          labelKey: "adminModeration.unblock",
          descriptionKey: "adminModeration.unblockDesc",
          icon: <LockOpen className="h-4 w-4" />,
        }
      : {
          action: "block",
          labelKey: "adminModeration.block",
          descriptionKey: "adminModeration.blockDesc",
          icon: <Lock className="h-4 w-4" />,
        },
    {
      action: "remove_marketplace_access",
      labelKey: "adminModeration.removeAccess",
      descriptionKey: "adminModeration.removeAccessDesc",
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      action: "soft_delete",
      labelKey: "adminModeration.softDelete",
      descriptionKey: "adminModeration.softDeleteDesc",
      destructive: true,
      icon: <UserX className="h-4 w-4" />,
    },
    {
      action: "permanent_delete",
      labelKey: "adminModeration.permanentDelete",
      descriptionKey: "adminModeration.permanentDeleteDesc",
      destructive: true,
      superAdminOnly: true,
      icon: <Trash2 className="h-4 w-4" />,
    },
  ];

  const visibleActions = actions.filter(
    (a) => !a.superAdminOnly || isSuperAdmin(user)
  );

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={statusColors[status] || "bg-muted text-muted-foreground"}>{status}</Badge>
        {marketplaceBlocked ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
            {t("adminModeration.marketplaceBlocked")}
          </Badge>
        ) : null}
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("adminModeration.actionsTitle")}
      </p>
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action) => (
          <Button
            key={action.action}
            type="button"
            size="sm"
            variant={action.destructive ? "destructive" : "outline"}
            className="gap-1.5"
            onClick={() => setPending(action)}
            disabled={mutation.isPending}
          >
            {action.icon}
            {t(action.labelKey)}
          </Button>
        ))}
      </div>

      <AdminGreenbondhuConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending ? t(pending.labelKey) : ""}
        description={pending ? t(pending.descriptionKey) : ""}
        actionLabel={pending ? t(pending.labelKey) : t("adminModeration.confirm")}
        destructive={pending?.destructive}
        loading={mutation.isPending}
        onConfirm={(confirmPhrase) => {
          if (!pending) return;
          mutation.mutate({ action: pending.action, confirmPhrase });
        }}
      />
    </div>
  );
}
