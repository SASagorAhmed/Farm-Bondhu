import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MarketplaceBanner,
  createMarketplaceBanner as create,
  deleteMarketplaceBanner as deleteBanner,
  fetchAdminMarketplaceBanners as fetchAdmin,
  updateMarketplaceBanner as update,
  uploadMarketplaceBannerImage,
} from "@/lib/marketplaceBannersApi";
import {
  MARKETPLACE_BANNER_DESTINATIONS,
  getBannerDestinationLabel,
  parseBannerLinkToDestination,
  resolveBannerLinkUrl,
} from "@/lib/marketplaceBannerDestinations";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function invalidateBannerQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceBanners() });
  queryClient.invalidateQueries({ queryKey: queryKeys().marketplaceBanners() });
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatBannerDuration(seconds: number | null | undefined): string {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "5s";
  return `${n}s`;
}

function formatBannerSchedule(banner: MarketplaceBanner): string {
  const now = Date.now();
  const startsAt = banner.starts_at ? new Date(banner.starts_at).getTime() : null;
  const endsAt = banner.ends_at ? new Date(banner.ends_at).getTime() : null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  if (endsAt != null && endsAt < now) return "Expired";
  if (startsAt != null && startsAt > now) return `Starts ${fmt(banner.starts_at!)}`;
  if (startsAt != null && endsAt != null) return `${fmt(banner.starts_at!)} – ${fmt(banner.ends_at!)}`;
  if (startsAt != null) return `From ${fmt(banner.starts_at!)}`;
  if (endsAt != null) return `Until ${fmt(banner.ends_at!)}`;
  return "Always";
}

type FormState = {
  imageUrl: string;
  altText: string;
  destination: string;
  customUrl: string;
  sortOrder: number;
  displaySeconds: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  imageUrl: "",
  altText: "",
  destination: "none",
  customUrl: "",
  sortOrder: 0,
  displaySeconds: 5,
  startsAt: "",
  endsAt: "",
  isActive: true,
};

export default function AdminMarketplaceBanners() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceBanner | null>(null);

  const { data: banners = [], isLoading, isError, error } = useQuery({
    queryKey: queryKeys().adminMarketplaceBanners(),
    queryFn: fetchAdmin,
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
  });

  const sorted = useMemo(
    () => [...banners].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [banners],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (b: MarketplaceBanner) => {
    const parsed = parseBannerLinkToDestination(b.link_url);
    setEditingId(b.id);
    setForm({
      imageUrl: b.image_url || "",
      altText: b.alt_text?.trim() || "",
      destination: parsed.destination,
      customUrl: parsed.customUrl,
      sortOrder: b.sort_order ?? 0,
      displaySeconds: b.display_seconds ?? 5,
      startsAt: toDatetimeLocalValue(b.starts_at),
      endsAt: toDatetimeLocalValue(b.ends_at),
      isActive: b.is_active !== false,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const linkUrl = resolveBannerLinkUrl(form.destination, form.customUrl);
      if (form.destination === "custom" && !linkUrl) {
        throw new Error("Enter a valid custom URL.");
      }
      if (!form.imageUrl.trim()) {
        throw new Error("Add a banner image.");
      }
      const displaySeconds = Number(form.displaySeconds);
      if (!Number.isFinite(displaySeconds) || !Number.isInteger(displaySeconds) || displaySeconds < 3 || displaySeconds > 120) {
        throw new Error("Display time must be between 3 and 120 seconds.");
      }
      const startsAt = fromDatetimeLocalValue(form.startsAt);
      const endsAt = fromDatetimeLocalValue(form.endsAt);
      if (form.startsAt.trim() && !startsAt) {
        throw new Error("Invalid start date/time.");
      }
      if (form.endsAt.trim() && !endsAt) {
        throw new Error("Invalid end date/time.");
      }
      if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
        throw new Error("End date/time must be after start date/time.");
      }

      const base = {
        image_url: form.imageUrl.trim(),
        alt_text: form.altText.trim() || null,
        link_url: linkUrl,
        sort_order: form.sortOrder,
        display_seconds: displaySeconds,
        starts_at: startsAt,
        ends_at: endsAt,
        is_active: form.isActive,
      };

      if (editingId) {
        return update(editingId, base);
      }
      return create(base);
    },
    onSuccess: () => {
      toast.success(editingId ? "Banner updated." : "Banner created.");
      invalidateBannerQueries(queryClient);
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      toast.success("Banner deleted.");
      invalidateBannerQueries(queryClient);
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => update(id, { is_active }),
    onSuccess: () => {
      invalidateBannerQueries(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadMarketplaceBannerImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#6366F1] to-[#0EA5E9]" />
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg font-display">Browse banners</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Carousel images on the marketplace home (3:1 aspect ratio recommended).
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 shrink-0"
            style={{ backgroundColor: ICON_COLORS.admin }}
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Add banner
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-14 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading banners…
            </div>
          )}
          {!isLoading && isError && (
            <p className="text-center text-sm text-destructive py-10 px-4">
              {error instanceof Error ? error.message : "Could not load banners."}
            </p>
          )}
          {!isLoading && !isError && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Preview</TableHead>
                    <TableHead>Alt & link</TableHead>
                    <TableHead className="w-20 text-right">Duration</TableHead>
                    <TableHead className="w-40">Schedule</TableHead>
                    <TableHead className="w-24 text-right">Order</TableHead>
                    <TableHead className="w-28 text-center">Active</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="w-[168px] max-w-full rounded-md border border-border bg-muted/30 overflow-hidden">
                          <div className="relative w-full aspect-[3/1]">
                            {b.image_url ? (
                              <img
                                src={b.image_url}
                                alt={b.alt_text || ""}
                                className="absolute inset-0 size-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-4 max-w-xs">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {b.alt_text?.trim() || "(no alt text)"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {getBannerDestinationLabel(b.link_url)}
                        </p>
                      </TableCell>
                      <TableCell className="align-middle text-right tabular-nums text-sm text-foreground">
                        {formatBannerDuration(b.display_seconds)}
                      </TableCell>
                      <TableCell className="align-middle text-xs text-muted-foreground">
                        {formatBannerSchedule(b)}
                      </TableCell>
                      <TableCell className="align-middle text-right tabular-nums text-sm text-foreground">
                        {b.sort_order ?? 0}
                      </TableCell>
                      <TableCell className="align-middle text-center">
                        <Switch
                          checked={b.is_active !== false}
                          disabled={toggleMutation.isPending && toggleMutation.variables?.id === b.id}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: b.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="align-middle text-right space-x-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(b)}
                          aria-label="Edit banner"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(b)}
                          aria-label="Delete banner"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {sorted.length === 0 && (
                <p className="text-center text-muted-foreground py-10 text-sm">No banners yet.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => (!o ? closeDialog() : setDialogOpen(o))}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? "Edit banner" : "New banner"}</DialogTitle>
            <DialogDescription>
              Upload a wide image (3:1 works best), set accessibility text, and choose where taps go.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Banner image</Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-full max-w-[280px] rounded-md border border-border bg-muted/30 overflow-hidden">
                  <div className="relative w-full aspect-[3/1]">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground text-[11px]">
                        <ImagePlus className="h-6 w-6 opacity-70" />
                        Preview
                      </div>
                    )}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    id="admin-marketplace-banner-file"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage}
                    onClick={() =>
                      document.getElementById("admin-marketplace-banner-file")?.click()
                    }
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="banner-alt">Alt text</Label>
              <Input
                id="banner-alt"
                value={form.altText}
                onChange={(ev) => setForm((prev) => ({ ...prev, altText: ev.target.value }))}
                placeholder="Short description for screen readers"
              />
            </div>

            <div className="grid gap-2">
              <Label>Destination</Label>
              <Select
                value={form.destination}
                onValueChange={(v) => setForm((prev) => ({ ...prev, destination: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a destination" />
                </SelectTrigger>
                <SelectContent>
                  {MARKETPLACE_BANNER_DESTINATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.destination === "custom" && (
              <div className="grid gap-2">
                <Label htmlFor="banner-custom-url">Custom URL</Label>
                <Input
                  id="banner-custom-url"
                  value={form.customUrl}
                  onChange={(ev) => setForm((prev) => ({ ...prev, customUrl: ev.target.value }))}
                  placeholder="/marketplace/… or https://…"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="banner-sort">Sort order</Label>
              <Input
                id="banner-sort"
                type="number"
                inputMode="numeric"
                value={Number.isFinite(form.sortOrder) ? form.sortOrder : 0}
                onChange={(ev) =>
                  setForm((prev) => ({
                    ...prev,
                    sortOrder: ev.target.value === "" ? 0 : Number(ev.target.value),
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">Lower numbers appear first.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="banner-display-seconds">Display time (seconds)</Label>
              <Input
                id="banner-display-seconds"
                type="number"
                inputMode="numeric"
                min={3}
                max={120}
                value={Number.isFinite(form.displaySeconds) ? form.displaySeconds : 5}
                onChange={(ev) =>
                  setForm((prev) => ({
                    ...prev,
                    displaySeconds: ev.target.value === "" ? 5 : Number(ev.target.value),
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                3–120 seconds on screen before the next slide.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="banner-starts-at">Start date/time (optional)</Label>
              <Input
                id="banner-starts-at"
                type="datetime-local"
                value={form.startsAt}
                onChange={(ev) => setForm((prev) => ({ ...prev, startsAt: ev.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="banner-ends-at">End date/time (optional)</Label>
              <Input
                id="banner-ends-at"
                type="datetime-local"
                value={form.endsAt}
                onChange={(ev) => setForm((prev) => ({ ...prev, endsAt: ev.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank for no schedule limit. End must be after start when both are set.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Active</p>
                <p className="text-[11px] text-muted-foreground">Inactive banners are hidden on the storefront.</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending}
              style={{ backgroundColor: ICON_COLORS.admin }}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this banner?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the banner from the marketplace carousel. You can add a replacement later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
