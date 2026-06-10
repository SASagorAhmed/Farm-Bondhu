import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  GraduationCap,
  LayoutList,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  deleteAdminLearningCourse,
  deleteAdminLearningGuide,
  deleteAdminLearningVideo,
  fetchAdminLearningCourses,
  fetchAdminLearningEnrollments,
  fetchAdminLearningGuides,
  fetchAdminLearningVideos,
  grantLearningEnrollment,
  reorderAdminLearningVideos,
  saveAdminLearningCourse,
  saveAdminLearningGuide,
  saveAdminLearningVideo,
  updateLearningEnrollment,
  uploadLearningThumbnail,
  uploadLearningVideoFile,
  type LearningCourse,
  type LearningCourseVideo,
  type LearningEnrollment,
  type LearningGuide,
} from "@/lib/learningCourseApi";

type Section = "courses" | "articles" | "enrollments";

const LEARNING = ICON_COLORS.learning;
const MAX_VIDEO_UPLOAD_BYTES = 95 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_LABEL = "95 MB";
const EMPTY_GUIDE = { title: "", summary: "", content: "", category: "disease", animal_type: "chicken", is_published: true };
const EMPTY_COURSE: Partial<LearningCourse> = {
  title: "",
  summary: "",
  description: "",
  category: "feeding",
  animal_type: "general",
  thumbnail_url: "",
  access_type: "free",
  price: 0,
  currency: "BDT",
  is_published: false,
  sort_order: 0,
};
const EMPTY_VIDEO: Partial<LearningCourseVideo> = {
  title: "",
  description: "",
  video_url: "",
  duration_seconds: 0,
  sort_order: 0,
  is_preview: false,
  is_published: true,
};

const CATEGORIES = ["disease", "medicine", "vaccination", "feeding", "business", "general"];
const ANIMAL_TYPES = ["general", "chicken", "duck", "turkey", "cow", "goat", "pigeon", "sheep", "fish"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function formatPrice(course: Partial<LearningCourse>) {
  if (course.access_type !== "paid") return "Free";
  return `${course.currency || "BDT"} ${Number(course.price || 0).toLocaleString()}`;
}

function enrollmentPaymentLabel(enrollment: LearningEnrollment) {
  const amount = Number(enrollment.payment_amount || enrollment.course_price || 0);
  return `${enrollment.payment_currency || enrollment.course_currency || "BDT"} ${amount.toLocaleString()}`;
}

function paymentMethodLabel(value?: string | null) {
  const labels: Record<string, string> = {
    bkash: "bKash",
    nagad: "Nagad",
    rocket: "Rocket",
    bank: "Bank",
    cash_manual: "Cash/manual",
  };
  return labels[String(value || "")] || value || "Manual";
}

export default function AdminLearning() {
  const [section, setSection] = useState<Section>("courses");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  const [guides, setGuides] = useState<LearningGuide[]>([]);
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [videos, setVideos] = useState<LearningCourseVideo[]>([]);
  const [enrollments, setEnrollments] = useState<LearningEnrollment[]>([]);

  const [courseSearch, setCourseSearch] = useState("");
  const [courseBuilderOpen, setCourseBuilderOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseForm, setCourseForm] = useState<Partial<LearningCourse>>(EMPTY_COURSE);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState<Partial<LearningCourseVideo>>(EMPTY_VIDEO);

  const [editingGuideId, setEditingGuideId] = useState<string | null>(null);
  const [guideForm, setGuideForm] = useState(EMPTY_GUIDE);

  const [grantCourseId, setGrantCourseId] = useState("");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantValidUntil, setGrantValidUntil] = useState("");

  const selectedVideos = useMemo(
    () => videos.filter((video) => video.course_id === selectedCourseId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [selectedCourseId, videos]
  );
  const selectedVideo = selectedVideoId ? selectedVideos.find((video) => video.id === selectedVideoId) || null : null;
  const filteredCourses = courses.filter((course) =>
    [course.title, course.summary, course.category, course.animal_type].join(" ").toLowerCase().includes(courseSearch.toLowerCase())
  );

  const loadVideos = async (courseId: string) => {
    if (!courseId) {
      setVideos([]);
      setSelectedVideoId("");
      return;
    }
    const rows = await fetchAdminLearningVideos(courseId).catch(() => []);
    setVideos(rows);
    setSelectedVideoId(rows[0]?.id || "");
  };

  const selectCourse = async (course: LearningCourse) => {
    setSection("courses");
    setCourseBuilderOpen(true);
    setSelectedCourseId(course.id);
    setCourseForm(course);
    setEditingVideoId(null);
    setVideoForm({ ...EMPTY_VIDEO, course_id: course.id, sort_order: 0 });
    await loadVideos(course.id);
  };

  const fetchAll = async (preferredCourseId?: string) => {
    setLoading(true);
    const [guideRows, courseRows, enrollmentRows] = await Promise.all([
      fetchAdminLearningGuides().catch(() => []),
      fetchAdminLearningCourses().catch(() => []),
      fetchAdminLearningEnrollments().catch(() => []),
    ]);
    setGuides(guideRows);
    setCourses(courseRows);
    setEnrollments(enrollmentRows);

    const nextCourse = courseRows.find((course) => course.id === preferredCourseId) || courseRows.find((course) => course.id === selectedCourseId) || courseRows[0];
    if (nextCourse) {
      setCourseBuilderOpen(true);
      setSelectedCourseId(nextCourse.id);
      setCourseForm(nextCourse);
      const videoRows = await fetchAdminLearningVideos(nextCourse.id).catch(() => []);
      setVideos(videoRows);
      setSelectedVideoId(videoRows[0]?.id || "");
    } else {
      setSelectedCourseId("");
      setCourseForm(EMPTY_COURSE);
      setVideos([]);
      setSelectedVideoId("");
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchAll();
    // Initial admin builder load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewCourse = () => {
    setSection("courses");
    setCourseBuilderOpen(true);
    setSelectedCourseId("");
    setCourseForm(EMPTY_COURSE);
    setVideos([]);
    setSelectedVideoId("");
    setEditingVideoId(null);
    setVideoForm(EMPTY_VIDEO);
  };

  const saveCourse = async (publish?: boolean) => {
    if (!String(courseForm.title || "").trim()) {
      toast({ title: "Course title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...courseForm,
        id: selectedCourseId || undefined,
        is_published: publish === undefined ? Boolean(courseForm.is_published) : publish,
      };
      const saved = await saveAdminLearningCourse(payload);
      toast({ title: saved.is_published ? "Course published" : "Course saved as draft" });
      await fetchAll(saved.id);
    } catch (error) {
      toast({ title: "Course save failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeCourse = async () => {
    if (!selectedCourseId) return;
    if (!window.confirm("Delete this course with all videos and enrollments?")) return;
    await deleteAdminLearningCourse(selectedCourseId);
    toast({ title: "Course deleted" });
    await fetchAll();
  };

  const resetVideoForm = () => {
    setSelectedVideoId("");
    setEditingVideoId(null);
    setVideoForm({ ...EMPTY_VIDEO, course_id: selectedCourseId, sort_order: selectedVideos.length });
  };

  const editVideo = (video: LearningCourseVideo) => {
    setSelectedVideoId(video.id);
    setEditingVideoId(video.id);
    setVideoForm(video);
  };

  const saveVideo = async () => {
    if (!selectedCourseId) return toast({ title: "Save the course first", variant: "destructive" });
    if (!String(videoForm.title || "").trim()) return toast({ title: "Video title is required", variant: "destructive" });
    setSaving(true);
    try {
      const saved = await saveAdminLearningVideo({
        ...videoForm,
        id: editingVideoId || undefined,
        course_id: selectedCourseId,
        sort_order: Number(videoForm.sort_order ?? selectedVideos.length),
      });
      toast({ title: editingVideoId ? "Video updated" : "Video added" });
      resetVideoForm();
      await loadVideos(selectedCourseId);
      setSelectedVideoId(saved.id);
    } catch (error) {
      toast({ title: "Video save failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadVideoFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Upload failed", description: "Please choose a valid video file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      toast({ title: "Video is too large", description: `Please upload a video under ${MAX_VIDEO_UPLOAD_LABEL}.`, variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadLearningVideoFile(file, setUploadProgress);
      setVideoForm((prev) => ({ ...prev, video_url: uploaded.url, cloudinary_public_id: uploaded.publicId }));
      toast({ title: "Video uploaded", description: "Cloudinary URL is ready to save." });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Try a smaller video or check Cloudinary settings.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const uploadThumbnailFile = async (file?: File) => {
    if (!file) return;
    setThumbnailUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await uploadLearningThumbnail(dataUrl);
      setCourseForm((prev) => ({ ...prev, thumbnail_url: uploaded.url }));
      toast({ title: "Thumbnail uploaded", description: "The course thumbnail URL is ready to save." });
    } catch (error) {
      toast({ title: "Thumbnail upload failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setThumbnailUploading(false);
    }
  };

  const deleteVideo = async (videoId: string) => {
    await deleteAdminLearningVideo(videoId);
    toast({ title: "Video deleted" });
    await loadVideos(selectedCourseId);
    resetVideoForm();
  };

  const moveVideo = async (index: number, direction: -1 | 1) => {
    const next = [...selectedVideos];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    await reorderAdminLearningVideos(next.map((video, sortOrder) => ({ id: video.id, sort_order: sortOrder })));
    await loadVideos(selectedCourseId);
  };

  const saveArticle = async () => {
    if (!guideForm.title.trim()) return toast({ title: "Article title is required", variant: "destructive" });
    await saveAdminLearningGuide({ ...guideForm, id: editingGuideId || undefined });
    toast({ title: editingGuideId ? "Article updated" : "Article created" });
    setEditingGuideId(null);
    setGuideForm(EMPTY_GUIDE);
    await fetchAll(selectedCourseId);
  };

  const editArticle = (guide: LearningGuide) => {
    setEditingGuideId(guide.id);
    setGuideForm({
      title: guide.title,
      summary: guide.summary,
      content: guide.content,
      category: guide.category,
      animal_type: guide.animal_type,
      is_published: guide.is_published,
    });
  };

  const deleteArticle = async (guideId: string) => {
    await deleteAdminLearningGuide(guideId);
    toast({ title: "Article deleted" });
    await fetchAll(selectedCourseId);
  };

  const grantAccess = async () => {
    if (!grantCourseId || !grantUserId) return toast({ title: "Course and user id are required", variant: "destructive" });
    await grantLearningEnrollment({ course_id: grantCourseId, user_id: grantUserId, valid_until: grantValidUntil || null });
    toast({ title: "Course access granted" });
    setGrantUserId("");
    setGrantValidUntil("");
    setEnrollments(await fetchAdminLearningEnrollments());
  };

  const updateEnrollmentStatus = async (enrollment: LearningEnrollment, status: LearningEnrollment["status"]) => {
    await updateLearningEnrollment(enrollment.id, { status });
    toast({ title: `Enrollment ${status}` });
    setEnrollments(await fetchAdminLearningEnrollments());
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const renderSidebar = () => (
    <aside className="space-y-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learning Admin</p>
          <h2 className="font-semibold">Course Builder</h2>
        </div>
        <Button size="sm" className="text-white" style={{ backgroundColor: LEARNING }} onClick={startNewCourse}>
          <Plus className="h-4 w-4 mr-1" /> Course
        </Button>
      </div>

      <div className="grid gap-2">
        {[
          { id: "courses" as Section, label: "Courses", icon: GraduationCap },
          { id: "articles" as Section, label: "Articles", icon: FileText },
          { id: "enrollments" as Section, label: "Enrollments", icon: Users },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${section === item.id ? "text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
            style={section === item.id ? { backgroundColor: LEARNING } : undefined}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)} placeholder="Search courses..." className="pl-9" />
        </div>
        <div className="space-y-2">
          {filteredCourses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => void selectCourse(course)}
              className={`w-full rounded-xl border p-3 text-left transition hover:border-orange-300 ${selectedCourseId === course.id && section === "courses" ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "border-border/70"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-sm font-medium">{course.title}</p>
                <Badge variant={course.is_published ? "default" : "outline"} className="text-[10px]">{course.is_published ? "Published" : "Draft"}</Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{formatPrice(course)} · {course.video_count || 0} videos</p>
            </button>
          ))}
          {filteredCourses.length === 0 && <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">No courses found.</p>}
        </div>
      </div>
    </aside>
  );

  const renderCourseBuilder = () => (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="border-border/70">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl">{selectedCourseId ? "Edit Course" : "Add New Course"}</CardTitle>
                <p className="text-sm text-muted-foreground">Add title and description first, then set price, videos, and publish.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCourseId && <Button variant="outline" onClick={removeCourse} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>}
                <Button variant="outline" disabled={saving} onClick={() => void saveCourse(false)}>Save Draft</Button>
                <Button disabled={saving} className="text-white" style={{ backgroundColor: LEARNING }} onClick={() => void saveCourse(true)}>Publish</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" style={{ color: LEARNING }} />
                <h3 className="font-semibold">Course Basics</h3>
              </div>
              <Input value={String(courseForm.title || "")} onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Course title" />
              <Textarea value={String(courseForm.summary || "")} onChange={(e) => setCourseForm((prev) => ({ ...prev, summary: e.target.value }))} placeholder="Short summary" rows={2} />
              <Textarea value={String(courseForm.description || "")} onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Full course description" rows={4} />
              <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Label>Thumbnail image</Label>
                    <p className="text-xs text-muted-foreground">Recommended 16:9 ratio, e.g. 1280x720.</p>
                  </div>
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {thumbnailUploading ? "Uploading..." : "Upload thumbnail"}
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" disabled={thumbnailUploading} onChange={(e) => void uploadThumbnailFile(e.target.files?.[0])} />
                  </label>
                </div>
                {courseForm.thumbnail_url && (
                  <div className="overflow-hidden rounded-xl border border-border bg-background">
                    <div className="aspect-video bg-muted">
                      <img src={String(courseForm.thumbnail_url)} alt="Course thumbnail preview" className="h-full w-full object-cover" />
                    </div>
                  </div>
                )}
                <Input value={String(courseForm.thumbnail_url || "")} onChange={(e) => setCourseForm((prev) => ({ ...prev, thumbnail_url: e.target.value }))} placeholder="Thumbnail URL (optional manual fallback)" />
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Pricing</h3>
                  <p className="text-xs text-muted-foreground">Free courses unlock immediately. Paid courses need admin enrollment validity.</p>
                </div>
                <Badge className="border-0" style={{ backgroundColor: `${LEARNING}1A`, color: LEARNING }}>{formatPrice(courseForm)}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={String(courseForm.access_type || "free")} onValueChange={(value) => setCourseForm((prev) => ({ ...prev, access_type: value as "free" | "paid" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
                </Select>
                <Input type="number" value={Number(courseForm.price || 0)} disabled={courseForm.access_type !== "paid"} onChange={(e) => setCourseForm((prev) => ({ ...prev, price: Number(e.target.value) }))} placeholder="Price" />
                <Input value={String(courseForm.currency || "BDT")} onChange={(e) => setCourseForm((prev) => ({ ...prev, currency: e.target.value }))} placeholder="Currency" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={Boolean(courseForm.is_published)} onCheckedChange={(value) => setCourseForm((prev) => ({ ...prev, is_published: value }))} />
                <Label>{courseForm.is_published ? "Published" : "Draft"}</Label>
              </div>
            </section>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Playlist</CardTitle>
                <p className="text-sm text-muted-foreground">Upload videos, edit details, mark preview clips, and reorder anytime.</p>
              </div>
              <Button type="button" variant="outline" disabled={!selectedCourseId} onClick={resetVideoForm}><Plus className="h-4 w-4 mr-1" /> New Video</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCourseId ? (
              <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">Save the course first, then add videos.</p>
            ) : (
              <>
                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{editingVideoId ? "Edit Video" : "Add Video"}</h3>
                    {editingVideoId && <Button size="sm" variant="ghost" onClick={resetVideoForm}>Cancel edit</Button>}
                  </div>
                  <div className="grid gap-3">
                    <Input value={String(videoForm.title || "")} onChange={(e) => setVideoForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Video title" />
                    <Textarea value={String(videoForm.description || "")} onChange={(e) => setVideoForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Video description" rows={2} />
                    <div className="flex gap-2">
                      <Input value={String(videoForm.video_url || "")} onChange={(e) => setVideoForm((prev) => ({ ...prev, video_url: e.target.value }))} placeholder="Video URL or upload to Cloudinary" />
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted">
                        <Upload className="h-4 w-4" /> {uploading ? `Uploading ${uploadProgress ?? 0}%` : "Upload"}
                        <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={(e) => void uploadVideoFile(e.target.files?.[0])} />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Videos upload through FarmBondhu to Cloudinary. Maximum size: {MAX_VIDEO_UPLOAD_LABEL}.
                    </p>
                    {uploadProgress !== null && (
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, backgroundColor: LEARNING }} />
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-3">
                      <Input type="number" value={Number(videoForm.duration_seconds || 0)} onChange={(e) => setVideoForm((prev) => ({ ...prev, duration_seconds: Number(e.target.value) }))} placeholder="Duration seconds" />
                      <div className="flex items-center gap-2 rounded-md border px-3">
                        <Switch checked={Boolean(videoForm.is_preview)} onCheckedChange={(value) => setVideoForm((prev) => ({ ...prev, is_preview: value }))} />
                        <Label>Preview</Label>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border px-3">
                        <Switch checked={videoForm.is_published !== false} onCheckedChange={(value) => setVideoForm((prev) => ({ ...prev, is_published: value }))} />
                        <Label>Published</Label>
                      </div>
                    </div>
                    <Button disabled={saving || uploading} className="w-fit text-white" style={{ backgroundColor: LEARNING }} onClick={() => void saveVideo()}>
                      {editingVideoId ? "Update Video" : "Add To Playlist"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedVideos.map((video, index) => (
                    <div key={video.id} className={`flex items-center gap-3 rounded-xl border p-3 ${selectedVideoId === video.id ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "border-border/70"}`}>
                      <button type="button" onClick={() => setSelectedVideoId(video.id)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <PlayCircle className="h-5 w-5" style={{ color: LEARNING }} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">{video.title}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant={video.is_preview ? "secondary" : "outline"} className="text-[10px]">{video.is_preview ? "Preview video" : "Locked content"}</Badge>
                          <Badge variant={video.is_published ? "default" : "outline"} className="text-[10px]">{video.is_published ? "Published" : "Hidden video"}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => void moveVideo(index, -1)}><ChevronUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" disabled={index === selectedVideos.length - 1} onClick={() => void moveVideo(index, 1)}><ChevronDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => editVideo(video)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void deleteVideo(video.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {selectedVideos.length === 0 && <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">No videos yet. Upload your first lesson.</p>}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="border-border/70">
          <CardHeader><CardTitle className="text-base">Course Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={courseForm.is_published ? "default" : "outline"}>{courseForm.is_published ? "Published" : "Draft"}</Badge>
              <Badge className="border-0" style={{ backgroundColor: `${LEARNING}1A`, color: LEARNING }}>{formatPrice(courseForm)}</Badge>
              <Badge variant="outline">{selectedVideos.length} videos</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{courseForm.title || "New untitled course"}</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70">
          <CardHeader><CardTitle className="text-base">Player Preview</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="aspect-video bg-black">
              {selectedVideo?.video_url ? (
                <video key={selectedVideo.id} src={selectedVideo.video_url} controls className="h-full w-full" />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-white/70">
                  Select or upload a video
                </div>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {selectedVideos.map((video, index) => (
                <button key={video.id} type="button" onClick={() => setSelectedVideoId(video.id)} className={`flex w-full gap-2 p-3 text-left text-sm hover:bg-muted ${selectedVideoId === video.id ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>
                  <span className="line-clamp-2">{video.title}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );

  const renderArticles = () => (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card className="border-border/70">
        <CardHeader><CardTitle className="text-base">{editingGuideId ? "Edit Article" : "New Article"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={guideForm.title} onChange={(e) => setGuideForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Article title" />
          <Textarea value={guideForm.summary} onChange={(e) => setGuideForm((prev) => ({ ...prev, summary: e.target.value }))} placeholder="Summary" rows={2} />
          <Textarea value={guideForm.content} onChange={(e) => setGuideForm((prev) => ({ ...prev, content: e.target.value }))} placeholder="Article content" rows={8} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={guideForm.category} onValueChange={(value) => setGuideForm((prev) => ({ ...prev, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category} className="capitalize">{category}</SelectItem>)}</SelectContent></Select>
            <Select value={guideForm.animal_type} onValueChange={(value) => setGuideForm((prev) => ({ ...prev, animal_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ANIMAL_TYPES.map((animal) => <SelectItem key={animal} value={animal} className="capitalize">{animal}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex items-center gap-2"><Switch checked={guideForm.is_published} onCheckedChange={(value) => setGuideForm((prev) => ({ ...prev, is_published: value }))} /><Label>Published</Label></div>
          <div className="flex gap-2">
            <Button className="text-white" style={{ backgroundColor: LEARNING }} onClick={() => void saveArticle()}>{editingGuideId ? "Update Article" : "Create Article"}</Button>
            {editingGuideId && <Button variant="outline" onClick={() => { setEditingGuideId(null); setGuideForm(EMPTY_GUIDE); }}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/70">
        <CardHeader><CardTitle className="text-base">Articles</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {guides.map((guide) => (
                <TableRow key={guide.id}>
                  <TableCell><p className="font-medium">{guide.title}</p><p className="text-xs text-muted-foreground">{guide.category} · {guide.animal_type}</p></TableCell>
                  <TableCell><Badge variant={guide.is_published ? "default" : "outline"}>{guide.is_published ? "Published" : "Draft"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => editArticle(guide)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void deleteArticle(guide.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderEnrollments = () => (
    <div className="space-y-4">
      <Card className="border-border/70">
        <CardHeader><CardTitle className="text-base">Grant Paid Access</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={grantCourseId} onValueChange={setGrantCourseId}>
            <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="User ID" />
          <Input type="date" value={grantValidUntil} onChange={(e) => setGrantValidUntil(e.target.value)} />
          <Button className="text-white" style={{ backgroundColor: LEARNING }} onClick={() => void grantAccess()}>Grant</Button>
        </CardContent>
      </Card>
      <Card className="border-border/70">
        <CardHeader><CardTitle className="text-base">Payment & Enrollment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Course</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead>Valid Until</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell><p className="font-medium">{enrollment.user_name || enrollment.user_id}</p><p className="text-xs text-muted-foreground">{enrollment.user_email}</p></TableCell>
                  <TableCell>{enrollment.course_title}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={enrollment.payment_status === "approved" ? "default" : enrollment.payment_status === "submitted" ? "secondary" : "outline"} className="text-[10px]">
                          {enrollment.payment_status || "unpaid"}
                        </Badge>
                        <span className="font-medium">{enrollmentPaymentLabel(enrollment)}</span>
                      </div>
                      <p className="text-muted-foreground">
                        {paymentMethodLabel(enrollment.payment_method)}
                        {enrollment.payment_reference ? ` · ${enrollment.payment_reference}` : ""}
                      </p>
                      <p className="text-muted-foreground">Sender: {enrollment.payment_sender || "Not provided"}</p>
                      {enrollment.payment_submitted_at && <p className="text-muted-foreground">Submitted {new Date(enrollment.payment_submitted_at).toLocaleString()}</p>}
                      {enrollment.payment_note && <p className="line-clamp-2 text-muted-foreground">Note: {enrollment.payment_note}</p>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={enrollment.status === "active" ? "default" : enrollment.status === "pending" ? "secondary" : "outline"}>{enrollment.status}</Badge></TableCell>
                  <TableCell className="text-sm">{enrollment.valid_until ? new Date(enrollment.valid_until).toLocaleDateString() : "No expiry"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => void updateEnrollmentStatus(enrollment, "active")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => void updateEnrollmentStatus(enrollment, "cancelled")}>Revoke</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-display font-bold">
            <LayoutList className="h-7 w-7" style={{ color: LEARNING }} />
            Learning Course Builder
          </h1>
          <p className="text-muted-foreground mt-1">Create a course, set price, upload playlist videos, preview, then publish.</p>
        </div>
        <Button className="w-fit text-white" style={{ backgroundColor: LEARNING }} onClick={startNewCourse}>
          <Plus className="h-4 w-4 mr-1" /> Add Course
        </Button>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {renderSidebar()}
        <main>
          {section === "courses" && (courseBuilderOpen ? renderCourseBuilder() : (
            <Card className="border-dashed border-orange-200">
              <CardContent className="py-16 text-center">
                <GraduationCap className="mx-auto mb-3 h-12 w-12" style={{ color: LEARNING }} />
                <h2 className="text-xl font-semibold">Create your first course</h2>
                <p className="mt-2 text-sm text-muted-foreground">Start with title and description, then add pricing and videos.</p>
                <Button className="mt-4 text-white" style={{ backgroundColor: LEARNING }} onClick={startNewCourse}>Add Course</Button>
              </CardContent>
            </Card>
          ))}
          {section === "articles" && renderArticles()}
          {section === "enrollments" && renderEnrollments()}
        </main>
      </div>
    </div>
  );
}
