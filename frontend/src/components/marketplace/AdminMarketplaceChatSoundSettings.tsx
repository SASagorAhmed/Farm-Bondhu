import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Save, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { ICON_COLORS } from "@/lib/iconColors";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { getChatSoundLabel } from "@/lib/marketplaceChatSounds";
import {
  fetchAdminChatSoundSettings,
  updateAdminChatSoundSettings,
  type ChatSoundCatalogItem,
} from "@/lib/marketplaceChatSoundApi";
import { previewChatSound } from "@/lib/marketplaceChatAlerts";

function catalogLabel(entry: ChatSoundCatalogItem, locale: "en" | "bn"): string {
  return locale === "bn" ? entry.labelBn : entry.labelEn;
}

export default function AdminMarketplaceChatSoundSettings() {
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const lang = locale === "bn" ? "bn" : "en";

  const { data, isLoading } = useQuery({
    queryKey: queryKeys().adminMarketplaceChatSound(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: fetchAdminChatSoundSettings,
  });

  const [defaultId, setDefaultId] = useState("");
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDefaultId(data.default_id);
    setEnabledIds(data.enabled_ids);
  }, [data]);

  const catalog = data?.catalog || [];
  const enabledSet = useMemo(() => new Set(enabledIds), [enabledIds]);

  const saveMutation = useMutation({
    mutationFn: () => updateAdminChatSoundSettings({ default_id: defaultId, enabled_ids: enabledIds }),
    onSuccess: (saved) => {
      setDefaultId(saved.default_id);
      setEnabledIds(saved.enabled_ids);
      queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceChatSound() });
      toast.success(t("admin.marketplace.soundSaved"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("admin.marketplace.soundSaveFailed"));
    },
  });

  const toggleEnabled = (id: string, checked: boolean) => {
    setEnabledIds((prev) => {
      const next = checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id);
      if (next.length === 0) return prev;
      if (!checked && defaultId === id) {
        setDefaultId(next[0]);
      }
      return next;
    });
  };

  const handlePreview = async (id: string) => {
    setPreviewingId(id);
    try {
      await previewChatSound(id);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleDefaultChange = (id: string) => {
    setDefaultId(id);
    void handlePreview(id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading sound settings…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Volume2 className="h-5 w-5" style={{ color: ICON_COLORS.marketplace }} />
          {t("admin.marketplace.soundTitle")}
        </CardTitle>
        <CardDescription>{t("admin.marketplace.soundDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 max-w-md">
          <Label htmlFor="default-sound">{t("admin.marketplace.soundDefault")}</Label>
          <Select value={defaultId} onValueChange={handleDefaultChange}>
            <SelectTrigger id="default-sound">
              <SelectValue placeholder={t("admin.marketplace.soundDefault")} />
            </SelectTrigger>
            <SelectContent>
              {enabledIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {getChatSoundLabel(id, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("admin.marketplace.soundDefaultHint")}</p>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.marketplace.soundName")}</TableHead>
                <TableHead className="w-[120px]">{t("admin.marketplace.soundPreview")}</TableHead>
                <TableHead className="w-[140px] text-right">{t("admin.marketplace.soundEnabled")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.map((entry) => {
                const enabled = enabledSet.has(entry.id);
                const isDefault = defaultId === entry.id;
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">{catalogLabel(entry, lang)}</div>
                      {isDefault && (
                        <span className="text-xs text-muted-foreground">{t("admin.marketplace.soundDefaultBadge")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={previewingId === entry.id}
                        onClick={() => void handlePreview(entry.id)}
                      >
                        {previewingId === entry.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span className="ml-1.5">{t("admin.marketplace.soundPreview")}</span>
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => toggleEnabled(entry.id, checked)}
                        aria-label={t("admin.marketplace.soundEnabled")}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !defaultId || enabledIds.length === 0}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("admin.marketplace.soundSave")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
