import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BookOpen, Lock, PlayCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  enrollFreeCourse,
  fetchLearningCourses,
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

export default function LearningDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentCourse, setPaymentCourse] = useState<LearningCourse | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const { data: courses = [], isLoading } = useQuery({
    queryKey: learningCourseKeys.courses,
    queryFn: fetchLearningCourses,
  });

  const startCourse = async (course: LearningCourse) => {
    try {
      if (course.access_type === "free" && !course.enrollment_status) {
        await enrollFreeCourse(course.id);
        await queryClient.invalidateQueries({ queryKey: learningCourseKeys.myCourses });
        await queryClient.invalidateQueries({ queryKey: learningCourseKeys.courses });
        toast({ title: "Course added", description: "You can continue from My Course." });
        navigate(`/learning/my-course/${course.id}`);
        return;
      }
      navigate(`/learning/my-course/${course.id}`);
    } catch (error) {
      toast({ title: "Could not start course", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };

  const openCourseDetail = (course: LearningCourse) => {
    navigate(`/learning/courses/${course.id}`);
  };

  const requestAccess = async (payload: LearningPaymentPayload) => {
    if (!paymentCourse) return;
    setSubmittingPayment(true);
    try {
      await requestPaidCourseAccess(paymentCourse.id, payload);
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.courses });
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.myCourses });
      navigate(`/learning/my-course/${paymentCourse.id}`);
      setPaymentCourse(null);
      toast({ title: "Payment complete", description: "Course added to My Course." });
    } catch (error) {
      toast({ title: "Could not submit payment", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold" style={{ color: ICON_COLORS.learning }}>Course Dashboard</h1>
        <p className="text-muted-foreground mt-1">Browse free and paid farm learning courses.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading courses...
        </div>
      ) : courses.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />No courses published yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const locked = course.access_type === "paid" && !course.can_play;
            return (
              <Card key={course.id} className="overflow-hidden border-border/70 shadow-sm">
                <button
                  type="button"
                  onClick={() => openCourseDetail(course)}
                  className="group flex aspect-video w-full items-center justify-center overflow-hidden bg-muted/50 text-left focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2"
                  aria-label={`Open ${course.title} details`}
                >
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                  ) : (
                    <PlayCircle className="h-12 w-12 transition-transform duration-200 group-hover:scale-110" style={{ color: ICON_COLORS.learning }} />
                  )}
                </button>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="border-0" style={{ backgroundColor: `${ICON_COLORS.learning}1A`, color: ICON_COLORS.learning }}>{priceLabel(course)}</Badge>
                    <Badge variant="outline">{course.video_count || 0} videos</Badge>
                    {locked && <Badge variant="outline"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>}
                  </div>
                  <button type="button" onClick={() => openCourseDetail(course)} className="block w-full rounded-md text-left focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2">
                    <h2 className="font-semibold text-lg leading-snug transition-colors hover:text-orange-600">{course.title}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{course.summary || course.description}</p>
                  </button>
                  <div className="flex gap-2">
                    {locked ? (
                      <>
                        <Button variant="outline" className="flex-1" onClick={() => navigate(`/learning/courses/${course.id}`)}>Preview</Button>
                        <Button
                          className="flex-1 text-white"
                          style={{ backgroundColor: ICON_COLORS.learning }}
                          onClick={() => setPaymentCourse(course)}
                        >
                          Pay
                        </Button>
                      </>
                    ) : (
                      <Button className="w-full text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => void startCourse(course)}>
                        Start Course
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <LearningPaymentDialog
        course={paymentCourse}
        open={Boolean(paymentCourse)}
        submitting={submittingPayment}
        onOpenChange={(open) => {
          if (!open) setPaymentCourse(null);
        }}
        onSubmit={requestAccess}
      />
    </div>
  );
}
