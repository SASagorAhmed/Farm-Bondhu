import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, readSession, API_BASE } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Briefcase, ImagePlus, Loader2, Send, X } from "lucide-react";
import LinkPreview, { type LinkPreviewData } from "@/components/community/LinkPreview";
import SharedPostEmbed, { type SharedPostData } from "@/components/community/SharedPostEmbed";
import { extractFirstUrl } from "@/lib/urlUtils";
import { useAdminPreviewMode } from "@/hooks/useAdminPreviewMode";
import {
  CATEGORY_LABELS,
  COMMUNITY_POST_MODES,
  HIRING_CATEGORY_GROUPS,
  HIRING_INTENTS,
  HIRING_TEMPLATE_COPY,
  type CommunityHiringIntent,
  type CommunityPostMode,
  autoCategoryForPostMode,
  resolveCategoryContexts,
} from "@/lib/communityCategories";
import {
  COMMUNITY_POST_IMAGE_LIMIT,
  COMMUNITY_POST_IMAGE_MIME_TYPES,
  type CommunityImageAttachment,
  uploadCommunityPostImage,
} from "@/lib/communityPostMediaApi";

type HiringDetails = {
  intent: CommunityHiringIntent;
  position: string;
  location: string;
  pay: string;
  skills: string;
  contact: string;
  deadline: string;
  availability: string;
};

type CommunityPostInsert = {
  user_id: string;
  post_type: string;
  post_intent: string;
  title: string;
  body: string;
  category: string;
  animal_type: string;
  priority: string;
  workspace_context: string[];
  hiring_details?: {
    intent: CommunityHiringIntent;
    position: string;
    location: string;
    pay: string;
    skills: string;
    contact: string;
    deadline?: string;
    availability?: string;
  };
  link_preview?: LinkPreviewData;
  shared_post_id?: string;
  attachments?: CommunityImageAttachment[];
};

type ImageDraft = {
  id: string;
  previewUrl: string;
  attachment?: CommunityImageAttachment;
  uploading: boolean;
  error?: string;
};

const emptyHiring: HiringDetails = {
  intent: "job_wanted",
  position: "",
  location: "",
  pay: "",
  skills: "",
  contact: "",
  deadline: "",
  availability: "",
};

const communitySelectItemClass =
  "focus:bg-teal-50 focus:text-teal-700 data-[state=checked]:text-teal-700 dark:focus:bg-teal-900/20 dark:focus:text-teal-300 dark:data-[state=checked]:text-teal-300";

export default function CreatePost() {
  const { user, hasRole, hasCapability } = useAuth();
  const { readOnly } = useAdminPreviewMode();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shareId = searchParams.get("share");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imageDraftsRef = useRef<ImageDraft[]>([]);

  const [mode, setMode] = useState<CommunityPostMode>("general");
  const selectedMode = COMMUNITY_POST_MODES.find((item) => item.value === mode) || COMMUNITY_POST_MODES[0];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [animalType, setAnimalType] = useState("");
  const [priority, setPriority] = useState("normal");
  const [hiring, setHiring] = useState<HiringDetails>(emptyHiring);
  const [hiringIntent, setHiringIntent] = useState<CommunityHiringIntent>("job_wanted");
  const [submitting, setSubmitting] = useState(false);

  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);
  const [sharedPost, setSharedPost] = useState<SharedPostData | null>(null);
  const [sharedPostLoading, setSharedPostLoading] = useState(false);
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);

  const hiringTemplate = HIRING_TEMPLATE_COPY[hiringIntent];
  const todayDateValue = useMemo(() => {
    const today = new Date();
    const offsetMs = today.getTimezoneOffset() * 60 * 1000;
    return new Date(today.getTime() - offsetMs).toISOString().slice(0, 10);
  }, []);
  const hiringCategories = useMemo(() => HIRING_CATEGORY_GROUPS[hiringIntent].flatMap((group) => group.categories), [hiringIntent]);
  const showTitle = mode === "question" || mode === "knowledge" || mode === "hiring" || mode === "help_request";
  const showAnimal = false;
  const canSellInMarketplace = hasCapability("can_sell") || hasCapability("can_manage_store") || hasRole("vendor");
  const canBuyInMarketplace = hasCapability("can_buy") || hasCapability("can_bulk_buy") || hasRole("buyer");

  const userContexts = useMemo(() => {
    const contexts = new Set<string>();
    if (hasCapability("can_book_human") || hasCapability("can_practice_human") || hasRole("doctor")) contexts.add("medibondhu");
    if (hasCapability("can_book_vet") || hasCapability("can_consult_as_vet") || hasRole("vet")) contexts.add("vetbondhu");
    if (hasCapability("can_buy") || hasCapability("can_bulk_buy") || hasRole("buyer")) contexts.add("marketplace_buyer");
    if (hasCapability("can_sell") || hasCapability("can_manage_store") || hasRole("vendor")) contexts.add("marketplace_seller");
    if (hasCapability("can_manage_farm") || hasRole("farmer")) contexts.add("farm");
    if (hasCapability("can_access_learning")) contexts.add("learning");
    return [...contexts];
  }, [hasCapability, hasRole]);

  useEffect(() => {
    const defaultHiringCategory = HIRING_INTENTS.find((item) => item.value === hiringIntent)?.defaultCategory;
    const nextCategory =
      mode === "hiring"
        ? defaultHiringCategory || hiringCategories[0] || "job_wanted"
        : autoCategoryForPostMode(mode, {
            canSell: canSellInMarketplace,
            canBuy: canBuyInMarketplace,
          });
    setCategory(nextCategory);
    setAnimalType("");
    setPriority(mode === "help_request" ? "urgent" : "normal");
    if (mode !== "hiring") setHiring(emptyHiring);
    else setHiring((prev) => ({ ...prev, intent: hiringIntent }));
  }, [mode, hiringIntent, hiringCategories, canSellInMarketplace, canBuyInMarketplace]);

  useEffect(() => {
    if (!shareId) return;
    const fetchShared = async () => {
      setSharedPostLoading(true);
      const { data } = await api
        .from("community_posts")
        .select("id, title, body, post_type, category, animal_type, created_at, user_id, reaction_count, comment_count, answer_count, share_count, attachments")
        .eq("id", shareId)
        .single();
      if (data) {
        const { data: profile } = await api.from("profiles").select("name, primary_role").eq("id", data.user_id).single();
        setSharedPost({
          ...data,
          author_name: profile?.name,
          author_role: profile?.primary_role,
        });
        setCategory(data.category || "general_discussion");
        setAnimalType(data.animal_type || "");
        setMode("general");
      }
      setSharedPostLoading(false);
    };
    void fetchShared();
  }, [shareId]);

  const fetchLinkPreview = useCallback(async (url: string) => {
    if (url === lastFetchedUrl) return;
    setLastFetchedUrl(url);
    setLinkLoading(true);
    try {
      const token = readSession()?.access_token;
      if (!token) {
        setLinkPreview({ url });
        setLinkLoading(false);
        return;
      }
      const r = await fetch(`${API_BASE}/v1/tools/link-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      const data = await r.json().catch(() => ({}));
      setLinkPreview(r.ok && data && !data.error ? (data as LinkPreviewData) : { url });
    } catch {
      setLinkPreview({ url });
    }
    setLinkLoading(false);
  }, [lastFetchedUrl]);

  useEffect(() => {
    const url = extractFirstUrl(body);
    if (url) {
      void fetchLinkPreview(url);
    } else {
      setLinkPreview(null);
      setLastFetchedUrl(null);
    }
  }, [body, fetchLinkPreview]);

  useEffect(() => {
    imageDraftsRef.current = imageDrafts;
  }, [imageDrafts]);

  useEffect(() => {
    return () => {
      for (const draft of imageDraftsRef.current) {
        if (draft.previewUrl.startsWith("blob:")) URL.revokeObjectURL(draft.previewUrl);
      }
    };
  }, []);

  const handleImageFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const currentCount = imageDrafts.length;
    const remaining = COMMUNITY_POST_IMAGE_LIMIT - currentCount;
    if (remaining <= 0) {
      toast({ title: "Photo limit reached", description: `You can add up to ${COMMUNITY_POST_IMAGE_LIMIT} photos.`, variant: "destructive" });
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast({ title: "Only 4 photos allowed", description: "Extra selected photos were skipped." });
    }
    for (const file of selected) {
      if (!COMMUNITY_POST_IMAGE_MIME_TYPES.includes(file.type)) {
        toast({ title: "Unsupported image", description: `${file.name} is not a PNG, JPG, JPEG, or WEBP image.`, variant: "destructive" });
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      setImageDrafts((prev) => [...prev, { id, previewUrl, uploading: true }]);
      try {
        const attachment = await uploadCommunityPostImage(file);
        setImageDrafts((prev) => prev.map((draft) => draft.id === id ? { ...draft, attachment, uploading: false } : draft));
      } catch (error) {
        setImageDrafts((prev) =>
          prev.map((draft) =>
            draft.id === id
              ? { ...draft, uploading: false, error: error instanceof Error ? error.message : "Image upload failed" }
              : draft,
          ),
        );
        toast({ title: "Image upload failed", description: error instanceof Error ? error.message : "Try another image.", variant: "destructive" });
      }
    }
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImageDraft = (id: string) => {
    setImageDrafts((prev) => {
      const target = prev.find((draft) => draft.id === id);
      if (target?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((draft) => draft.id !== id);
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    const uploadedAttachments = imageDrafts.map((draft) => draft.attachment).filter((item): item is CommunityImageAttachment => Boolean(item));
    if (imageDrafts.some((draft) => draft.uploading)) {
      toast({ title: "Photos still uploading", description: "Please wait until all selected photos finish uploading.", variant: "destructive" });
      return;
    }
    if (imageDrafts.some((draft) => draft.error)) {
      toast({ title: "Remove failed photos", description: "Please remove failed image uploads before publishing.", variant: "destructive" });
      return;
    }
    const finalTitle = mode === "hiring" ? hiring.position.trim() : title.trim();
    if (showTitle && !finalTitle) {
      toast({ title: "Title required", description: "Please add a title for this post.", variant: "destructive" });
      return;
    }
    if (!body.trim() && !finalTitle && uploadedAttachments.length === 0) {
      toast({ title: "Write something first", description: "Add a message before publishing.", variant: "destructive" });
      return;
    }
    if (mode === "hiring" && !hiring.position.trim()) {
      toast({ title: "Position required", description: "Add the hiring position title.", variant: "destructive" });
      return;
    }
    if (mode === "hiring" && hiringIntent === "hiring_someone" && hiring.deadline && hiring.deadline < todayDateValue) {
      toast({ title: "Choose a valid deadline", description: "Application deadline cannot be an older date.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const postTitle = finalTitle || body.trim().slice(0, 90) || "Photo post";
    const contexts = resolveCategoryContexts(category, mode === "hiring" ? ["community_hiring", ...userContexts] : userContexts);
    const insertData: CommunityPostInsert = {
      user_id: user.id,
      post_type: selectedMode.postType,
      post_intent: selectedMode.intent,
      title: postTitle,
      body: body.trim(),
      category,
      animal_type: showAnimal ? animalType : "other",
      priority,
      workspace_context: contexts,
    };
    if (mode === "hiring") {
      insertData.hiring_details = {
        intent: hiringIntent,
        position: hiring.position.trim(),
        location: hiring.location.trim(),
        pay: hiring.pay.trim(),
        skills: hiring.skills.trim(),
        contact: hiring.contact.trim(),
        deadline: hiringIntent === "hiring_someone" ? hiring.deadline : undefined,
        availability: hiringIntent === "job_wanted" ? hiring.availability.trim() : undefined,
      };
    }
    if (linkPreview && linkPreview.title) insertData.link_preview = linkPreview;
    if (sharedPost) insertData.shared_post_id = sharedPost.id;
    if (uploadedAttachments.length) insertData.attachments = uploadedAttachments;

    const { error } = await api.from("community_posts").insert(insertData);
    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (sharedPost) {
      const { data: origPost } = await api.from("community_posts").select("share_count").eq("id", sharedPost.id).single();
      if (origPost) {
        const shareCount = Number((origPost as { share_count?: number }).share_count || 0);
        await api.from("community_posts").update({ share_count: shareCount + 1 }).eq("id", sharedPost.id);
      }
    }
    setSubmitting(false);
    toast({ title: mode === "hiring" ? "Hiring post published" : "Post created!", description: "Your post is now live in the community." });
    navigate("/community");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-foreground">{sharedPost ? "Share this post" : "Create a community post"}</h1>
              <p className="text-sm text-muted-foreground mt-1">Start simple. Add structure only when the post needs it.</p>
            </div>

            {sharedPostLoading && <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {sharedPost && <SharedPostEmbed post={sharedPost} />}

            <div className="flex flex-wrap gap-2">
              {COMMUNITY_POST_MODES.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setMode(item.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === item.value
                      ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {mode === "hiring" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {HIRING_INTENTS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setHiringIntent(item.value);
                      setHiring((h) => ({ ...h, intent: item.value, position: "" }));
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      hiringIntent === item.value
                        ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-900/20 dark:text-teal-200"
                        : "border-border bg-muted/20 text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  </button>
                ))}
              </div>
            )}

            {showTitle && (
              <Input
                placeholder={mode === "hiring" ? hiringTemplate.titlePlaceholder : "Add a title"}
                value={mode === "hiring" ? hiring.position : title}
                onChange={(e) => mode === "hiring" ? setHiring((h) => ({ ...h, position: e.target.value })) : setTitle(e.target.value)}
                maxLength={200}
                className="rounded-lg"
              />
            )}

            <div>
              <Textarea
                placeholder={mode === "hiring" ? hiringTemplate.bodyPlaceholder : "What do you want to share?"}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={5000}
                className="rounded-lg"
              />
              {(linkLoading || linkPreview) && <LinkPreview data={linkPreview} loading={linkLoading} />}
            </div>

            {imageDrafts.length > 0 && (
              <div className={`grid gap-2 overflow-hidden rounded-xl ${imageDrafts.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {imageDrafts.map((draft, index) => {
                  const isLargeFirst = imageDrafts.length === 3 && index === 0;
                  return (
                    <div
                      key={draft.id}
                      className={`relative overflow-hidden rounded-xl border border-border bg-muted/40 ${
                        imageDrafts.length === 1 ? "h-72" : isLargeFirst ? "row-span-2 h-full min-h-72" : "h-36"
                      }`}
                    >
                      <img src={draft.previewUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImageDraft(draft.id)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-background"
                        aria-label="Remove photo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {(draft.uploading || draft.error) && (
                        <div className="absolute inset-x-0 bottom-0 bg-background/90 px-3 py-2 text-xs">
                          {draft.uploading ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" /> Uploading photo...
                            </span>
                          ) : (
                            <span className="text-destructive">{draft.error}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept={COMMUNITY_POST_IMAGE_MIME_TYPES.join(",")}
                multiple
                className="sr-only"
                onChange={(e) => void handleImageFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageDrafts.length >= COMMUNITY_POST_IMAGE_LIMIT}
              >
                <ImagePlus className="h-4 w-4 mr-1.5" />
                Add photos
              </Button>
              <span className="text-xs text-muted-foreground">
                {imageDrafts.length}/{COMMUNITY_POST_IMAGE_LIMIT}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mode === "hiring" && (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Hiring type" /></SelectTrigger>
                  <SelectContent>
                    {HIRING_CATEGORY_GROUPS[hiringIntent].map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.categories.map((key) => (
                          <SelectItem key={key} value={key} className={communitySelectItemClass}>
                            {CATEGORY_LABELS[key] || key}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {mode === "hiring" && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="h-4 w-4 text-teal-600" />
                  {hiringTemplate.detailsTitle}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input placeholder={hiringTemplate.locationPlaceholder} value={hiring.location} onChange={(e) => setHiring((h) => ({ ...h, location: e.target.value }))} />
                  <Input placeholder={hiringTemplate.payPlaceholder} value={hiring.pay} onChange={(e) => setHiring((h) => ({ ...h, pay: e.target.value }))} />
                  <Input placeholder={hiringTemplate.skillsPlaceholder} value={hiring.skills} onChange={(e) => setHiring((h) => ({ ...h, skills: e.target.value }))} />
                  <Input placeholder={hiringTemplate.contactPlaceholder} value={hiring.contact} onChange={(e) => setHiring((h) => ({ ...h, contact: e.target.value }))} />
                  {hiringIntent === "job_wanted" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Availability / start time</label>
                      <Input placeholder={hiringTemplate.datePlaceholder} value={hiring.availability} onChange={(e) => setHiring((h) => ({ ...h, availability: e.target.value }))} />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Application deadline</label>
                      <Input type="date" min={todayDateValue} value={hiring.deadline} onChange={(e) => setHiring((h) => ({ ...h, deadline: e.target.value }))} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate("/community")} className="rounded-full">Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || readOnly} className="bg-teal-500 hover:bg-teal-600 text-white rounded-full px-6">
                {submitting ? "Posting..." : <><Send className="h-4 w-4 mr-1.5" /> Publish Post</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
