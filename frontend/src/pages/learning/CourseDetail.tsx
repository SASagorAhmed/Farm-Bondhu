import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, Lock, PlayCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  enrollFreeCourse,
  fetchLearningCourseDetail,
  learningCourseKeys,
  requestPaidCourseAccess,
  type LearningCourse,
  type LearningPaymentPayload,
} from "@/lib/learningCourseApi";
import { ICON_COLORS } from "@/lib/iconColors";
import { LearningPaymentDialog } from "./LearningPaymentDialog";

function priceLabel(course: LearningCourse) {
  if (course.access_type === "free") return "Free";
  return `${course.currency || "BDT"} ${Number(course.price || 0).toLocaleString()}`;
}

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["learning-course-detail", courseId],
    queryFn: () => fetchLearningCourseDetail(courseId || ""),
    enabled: Boolean(courseId),
  });

  const videos = useMemo(() => data?.videos || [], [data?.videos]);

  const startFree = async () => {
    if (!courseId) return;
    try {
      await enrollFreeCourse(courseId);
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.myCourses });
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.courses });
      await refetch();
      toast({ title: "Course added", description: "Opening your course player." });
      navigate(`/learning/my-course/${courseId}`);
    } catch (error) {
      toast({ title: "Could not start course", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };

  const payForCourse = async (payload: LearningPaymentPayload) => {
    if (!courseId) return;
    setSubmittingPayment(true);
    try {
      await requestPaidCourseAccess(courseId, payload);
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.courses });
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.myCourses });
      await refetch();
      setPaymentOpen(false);
      toast({ title: "Payment complete", description: "Opening your course player." });
      navigate(`/learning/my-course/${courseId}`);
    } catch (error) {
      toast({ title: "Could not submit payment", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading course details...</div>;
  }

  if (!data?.course) {
    return <Card><CardContent className="py-16 text-center text-muted-foreground">Course not found.</CardContent></Card>;
  }

  const { course } = data;
  const needsFreeEnrollment = course.access_type === "free" && !course.enrollment_status;
  const canContinue = Boolean(course.can_play && !needsFreeEnrollment);
  const locked = course.access_type === "paid" && !course.can_play;

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card className="overflow-hidden border-border/70">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="aspect-video bg-muted/50">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <PlayCircle className="h-16 w-16" style={{ color: ICON_COLORS.learning }} />
              </div>
            )}
          </div>
          <CardContent className="flex flex-col justify-center space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0" style={{ backgroundColor: `${ICON_COLORS.learning}1A`, color: ICON_COLORS.learning }}>{priceLabel(course)}</Badge>
              <Badge variant="outline">{videos.length} videos</Badge>
              {course.can_play ? <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" /> Unlocked</Badge> : <Badge variant="outline"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight md:text-3xl">{course.title}</h1>
              <p className="mt-2 text-muted-foreground">{course.summary || "Learn step-by-step with FarmBondhu courses."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {needsFreeEnrollment ? (
                <Button className="text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => void startFree()}>
                  Start Course
                </Button>
              ) : canContinue ? (
                <Button className="text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => navigate(`/learning/my-course/${course.id}`)}>
                  Continue Learning
                </Button>
              ) : locked ? (
                <Button className="text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => setPaymentOpen(true)}>
                  Pay
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => navigate("/learning/dashboard")}>Back to Dashboard</Button>
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="border-border/70">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" style={{ color: ICON_COLORS.learning }} />
              <h2 className="font-semibold">Course Description</h2>
            </div>
            <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {course.description || course.summary || "No description added yet."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-0">
            <div className="border-b border-border p-3">
              <h2 className="font-semibold">Course Playlist</h2>
              <p className="text-xs text-muted-foreground">{videos.length} videos included</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {videos.map((video, index) => (
                <div key={video.id} className="flex gap-3 border-b border-border/60 p-3 last:border-b-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {video.video_url ? index + 1 : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{video.is_preview ? "Preview available" : video.video_url ? "Unlocked lesson" : "Unlock to watch"}</p>
                  </div>
                </div>
              ))}
              {videos.length === 0 && <p className="p-4 text-sm text-muted-foreground">No videos in this course yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <LearningPaymentDialog
        course={course}
        open={paymentOpen}
        submitting={submittingPayment}
        onOpenChange={setPaymentOpen}
        onSubmit={payForCourse}
      />
    </div>
  );
}
