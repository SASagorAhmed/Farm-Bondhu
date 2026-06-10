import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { GraduationCap, PlayCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMyLearningCourses, learningCourseKeys } from "@/lib/learningCourseApi";
import { ICON_COLORS } from "@/lib/iconColors";

export default function MyCourses() {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useQuery({
    queryKey: learningCourseKeys.myCourses,
    queryFn: fetchMyLearningCourses,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold" style={{ color: ICON_COLORS.learning }}>My Course</h1>
        <p className="text-muted-foreground mt-1">Courses you enrolled in and can currently access.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading your courses...
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No enrolled courses yet.</p>
            <Button className="mt-4 text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => navigate("/learning/dashboard")}>
              Browse Courses
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden border-border/70 shadow-sm">
              <div className="aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="h-full w-full object-cover" />
                ) : (
                  <PlayCircle className="h-12 w-12" style={{ color: ICON_COLORS.learning }} />
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="border-0" style={{ backgroundColor: `${ICON_COLORS.learning}1A`, color: ICON_COLORS.learning }}>Active</Badge>
                  <Badge variant="outline">{course.video_count || 0} videos</Badge>
                </div>
                <div>
                  <h2 className="font-semibold text-lg leading-snug">{course.title}</h2>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{course.summary || course.description}</p>
                  {course.valid_until && <p className="mt-2 text-xs text-muted-foreground">Valid until {new Date(course.valid_until).toLocaleDateString()}</p>}
                </div>
                <Button className="w-full text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => navigate(`/learning/my-course/${course.id}`)}>
                  Continue Learning
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
