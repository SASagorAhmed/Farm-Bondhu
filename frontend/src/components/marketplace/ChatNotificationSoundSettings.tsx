import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Play, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ICON_COLORS } from "@/lib/iconColors";
import { DEFAULT_CHAT_SOUND_ID, getAllChatSoundIds, getChatSoundLabel } from "@/lib/marketplaceChatSounds";
import {
  fetchChatSoundPreference,
  updateChatSoundPreference,
} from "@/lib/marketplaceChatSoundApi";
import {
  disableChatSound,
  enableChatSound,
  getActiveChatSoundId,
  isSoundEnabledInStorage,
  loadChatSoundPreference,
  previewChatSound,
  setUserChatSoundId,
  subscribeChatSoundState,
  testChatSound,
} from "@/lib/marketplaceChatAlerts";

export default function ChatNotificationSoundSettings() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const lang = locale === "bn" ? "bn" : "en";

  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState(DEFAULT_CHAT_SOUND_ID);
  const [savingSound, setSavingSound] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const soundChoices = useMemo(() => getAllChatSoundIds(), []);

  const refresh = useCallback(() => {
    setSoundsEnabled(isSoundEnabledInStorage());
    setSelectedSoundId(getActiveChatSoundId());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeChatSoundState(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      try {
        await loadChatSoundPreference();
        const preference = await fetchChatSoundPreference().catch(() => null);
        const soundId = preference?.sound_id || getActiveChatSoundId() || DEFAULT_CHAT_SOUND_ID;
        setSelectedSoundId(soundId);
        setUserChatSoundId(soundId);
      } catch {
        setSelectedSoundId(getActiveChatSoundId());
      }
      refresh();
    })();
  }, [refresh, user?.id]);

  const handleToggleSounds = async (checked: boolean) => {
    if (checked) {
      setEnabling(true);
      try {
        const ok = await enableChatSound({
          requestNotifications: true,
          playTest: false,
        });
        if (!ok) {
          toast.error(t("chat.soundTestFailed"));
        } else {
          refresh();
        }
      } finally {
        setEnabling(false);
      }
      return;
    }

    disableChatSound();
    refresh();
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const ok = await testChatSound();
      if (ok) {
        toast.success(t("chat.soundTestOk"));
      } else {
        toast.error(t("chat.soundTestFailed"));
      }
    } finally {
      setTesting(false);
      refresh();
    }
  };

  const handlePreview = async (soundId: string) => {
    setPreviewingId(soundId);
    try {
      await previewChatSound(soundId);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleSoundSelect = async (soundId: string) => {
    if (soundId === selectedSoundId) {
      void handlePreview(soundId);
      return;
    }

    setSelectedSoundId(soundId);
    setSavingSound(true);
    try {
      await previewChatSound(soundId);
      const saved = await updateChatSoundPreference(soundId);
      setUserChatSoundId(saved.sound_id);
      toast.success(t("chat.soundSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chat.soundTestFailed"));
      refresh();
    } finally {
      setSavingSound(false);
    }
  };

  if (!user?.id) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Volume2 className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
          {t("chat.soundSettingsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">{t("chat.soundEnableButton")}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">{t("chat.soundEnableDesc")}</p>
          </div>
          <Switch
            checked={soundsEnabled}
            disabled={enabling}
            onCheckedChange={(checked) => void handleToggleSounds(checked)}
            aria-label={t("chat.soundEnableButton")}
          />
        </div>

        {soundsEnabled && (
          <>
            <div className="space-y-3">
              <div>
                <Label>{t("chat.soundChoose")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("chat.soundPickHint")}</p>
              </div>

              <RadioGroup
                value={selectedSoundId}
                onValueChange={(value) => void handleSoundSelect(value)}
                disabled={savingSound}
                className="space-y-2"
              >
                {soundChoices.map((id) => (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <RadioGroupItem value={id} id={`chat-sound-${id}`} />
                      <Label htmlFor={`chat-sound-${id}`} className="font-normal cursor-pointer truncate">
                        {getChatSoundLabel(id, lang)}
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={previewingId === id || savingSound}
                      onClick={() => void handlePreview(id)}
                    >
                      {previewingId === id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="sr-only">{t("admin.marketplace.soundPreview")}</span>
                    </Button>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testing || enabling}
                onClick={() => void handleTest()}
              >
                <Volume2 className="h-4 w-4 mr-1.5" />
                {testing ? "..." : t("chat.soundTestButton")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
