import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FastForward, Gauge, Lock, Maximize, Pause, Play, RefreshCw, Rewind, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  enrollFreeCourse,
  fetchLearningCourseDetail,
  learningCourseKeys,
  requestPaidCourseAccess,
  type LearningPaymentPayload,
  type LearningCourseVideo,
} from "@/lib/learningCourseApi";
import { ICON_COLORS } from "@/lib/iconColors";
import { LearningPaymentDialog } from "./LearningPaymentDialog";

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function CoursePlayer() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState("1");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["learning-course-detail", courseId],
    queryFn: () => fetchLearningCourseDetail(courseId || ""),
    enabled: Boolean(courseId),
  });

  const videos = useMemo(() => data?.videos || [], [data?.videos]);
  const playable = videos.filter((video) => Boolean(video.video_url));
  const selectedVideo = useMemo<LearningCourseVideo | null>(() => {
    return videos.find((video) => video.id === selectedVideoId) || playable[0] || videos[0] || null;
  }, [playable, selectedVideoId, videos]);

  useEffect(() => {
    if (!selectedVideoId && selectedVideo?.id) setSelectedVideoId(selectedVideo.id);
  }, [selectedVideo?.id, selectedVideoId]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = Number(playbackRate);
  }, [playbackRate, selectedVideo?.id]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = muted || volume === 0;
  }, [muted, selectedVideo?.id, volume]);

  useEffect(() => {
    setIsPlaying(false);
    setControlsVisible(true);
    setIsSeeking(false);
    setCurrentTime(0);
    setDuration(0);
  }, [selectedVideo?.id]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === playerContainerRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsHideTimeoutRef.current) clearTimeout(controlsHideTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (controlsHideTimeoutRef.current) clearTimeout(controlsHideTimeoutRef.current);

    if (!isPlaying || isSeeking) {
      setControlsVisible(true);
      return;
    }

    controlsHideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  }, [isPlaying, isSeeking]);

  const showControls = () => {
    if (controlsHideTimeoutRef.current) clearTimeout(controlsHideTimeoutRef.current);
    setControlsVisible(true);

    if (!isPlaying || isSeeking) return;
    controlsHideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  };

  const hideControls = () => {
    if (controlsHideTimeoutRef.current) clearTimeout(controlsHideTimeoutRef.current);
    if (!isSeeking) setControlsVisible(false);
  };

  const startFree = async () => {
    if (!courseId) return;
    try {
      await enrollFreeCourse(courseId);
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.myCourses });
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.courses });
      await refetch();
      toast({ title: "Course added", description: "You can continue from My Course." });
      navigate("/learning/my-course");
    } catch (error) {
      toast({ title: "Could not start course", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };

  const requestAccess = async (payload: LearningPaymentPayload) => {
    if (!courseId) return;
    setSubmittingPayment(true);
    try {
      await requestPaidCourseAccess(courseId, payload);
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.courses });
      await queryClient.invalidateQueries({ queryKey: learningCourseKeys.myCourses });
      await refetch();
      setPaymentOpen(false);
      toast({ title: "Payment complete", description: "Course added to My Course." });
      navigate("/learning/my-course");
    } catch (error) {
      toast({ title: "Could not submit payment", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const skipVideo = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : video.currentTime + seconds;
    const nextTime = Math.min(Math.max(video.currentTime + seconds, 0), duration);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const syncVideoTime = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime || 0);
  };

  const syncVideoDuration = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setCurrentTime(video.currentTime || 0);
  };

  const seekVideo = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    const video = videoRef.current;
    setCurrentTime(nextTime);
    if (video) video.currentTime = nextTime;
    showControls();
  };

  const changeVolume = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
    showControls();
  };

  const toggleMute = () => {
    if (muted || volume === 0) {
      setMuted(false);
      if (volume === 0) setVolume(1);
      showControls();
      return;
    }
    setMuted(true);
    showControls();
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    showControls();
    if (video.paused || video.ended) {
      try {
        await video.play();
      } catch {
        toast({ title: "Could not play video", description: "Try pressing play again.", variant: "destructive" });
      }
      return;
    }
    video.pause();
  };

  const toggleFullscreen = async () => {
    const player = playerContainerRef.current;
    if (!player) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await player.requestFullscreen();
    } catch {
      toast({ title: "Fullscreen unavailable", description: "Your browser could not open fullscreen mode.", variant: "destructive" });
    }
  };

  const handlePlayerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [role='combobox']")) return;
    if (event.key === " " && target.closest("button")) return;
    showControls();

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      skipVideo(-30);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      skipVideo(30);
    } else if (event.key === " ") {
      event.preventDefault();
      void togglePlayback();
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading course...</div>;
  }

  if (!data?.course) {
    return <Card><CardContent className="py-16 text-center text-muted-foreground">Course not found.</CardContent></Card>;
  }

  const { course } = data;
  const locked = course.access_type === "paid" && !course.can_play;
  const selectedLocked = selectedVideo && !selectedVideo.video_url;
  const controlsVisibilityClass = controlsVisible ? "opacity-100" : "pointer-events-none opacity-0";

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-border/70">
            <div
              ref={playerContainerRef}
              tabIndex={0}
              onKeyDown={handlePlayerKeyDown}
              onMouseMove={showControls}
              onMouseLeave={hideControls}
              onTouchStart={showControls}
              onFocusCapture={() => {
                setControlsVisible(true);
                showControls();
              }}
              className={`group relative flex aspect-video items-center justify-center overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 ${controlsVisible || !isPlaying ? "" : "cursor-none"}`}
              aria-label="Course video player"
            >
              {selectedVideo?.video_url ? (
                <>
                  <video
                    ref={videoRef}
                    key={selectedVideo.id}
                    src={selectedVideo.video_url}
                    className="h-full w-full"
                    poster={course.thumbnail_url || undefined}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onVolumeChange={(event) => {
                      setMuted(event.currentTarget.muted);
                      setVolume(event.currentTarget.volume);
                    }}
                    onLoadedMetadata={syncVideoDuration}
                    onDurationChange={syncVideoDuration}
                    onTimeUpdate={syncVideoTime}
                  />
                  <div className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/30 via-transparent to-black/20 transition-opacity duration-200 ${controlsVisibilityClass}`}>
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => void togglePlayback()}
                      className="pointer-events-auto h-14 w-14 rounded-full text-white shadow-lg sm:h-16 sm:w-16"
                      style={{ backgroundColor: ICON_COLORS.learning }}
                      aria-label={isPlaying ? "Pause video" : "Play video"}
                    >
                      {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
                    </Button>
                  </div>
                  <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pb-2 pt-8 text-white transition-opacity duration-200 ${controlsVisibilityClass}`}>
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.1}
                      value={duration ? Math.min(currentTime, duration) : 0}
                      onChange={seekVideo}
                      onPointerDown={() => {
                        setIsSeeking(true);
                        showControls();
                      }}
                      onPointerUp={() => {
                        setIsSeeking(false);
                        showControls();
                      }}
                      onPointerCancel={() => {
                        setIsSeeking(false);
                        showControls();
                      }}
                      disabled={!duration}
                      aria-label="Seek video"
                      className="h-5 w-full cursor-pointer appearance-none bg-transparent accent-orange-500 disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-orange-500 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/35 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/35 [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                      style={{ accentColor: ICON_COLORS.learning }}
                    />
                    <div className="mt-2 flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => void togglePlayback()}
                        className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                        aria-label={isPlaying ? "Pause video" : "Play video"}
                      >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => skipVideo(-10)}
                        className="h-8 gap-1 px-2 text-xs font-semibold text-white hover:bg-white/15 hover:text-white"
                        aria-label="Back 10 seconds"
                      >
                        <Rewind className="h-4 w-4" /> 10s
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => skipVideo(10)}
                        className="h-8 gap-1 px-2 text-xs font-semibold text-white hover:bg-white/15 hover:text-white"
                        aria-label="Forward 10 seconds"
                      >
                        10s <FastForward className="h-4 w-4" />
                      </Button>
                      <span className="ml-1 shrink-0 text-xs font-medium tabular-nums text-white/90">
                        {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
                      </span>
                      <div className="flex-1" />
                      <div className="flex items-center gap-1 text-white">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={toggleMute}
                          className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                          aria-label={muted || volume === 0 ? "Unmute video" : "Mute video"}
                        >
                          {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={muted ? 0 : volume}
                          onChange={changeVolume}
                          onPointerDown={showControls}
                          onPointerUp={showControls}
                          aria-label="Volume"
                          className="hidden h-4 w-20 cursor-pointer appearance-none bg-transparent accent-orange-500 sm:block [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-orange-500 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/35 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/35 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                          style={{ accentColor: ICON_COLORS.learning }}
                        />
                      </div>
                      <div className="flex items-center gap-1 text-white">
                        <Gauge className="hidden h-4 w-4 text-white/80 sm:block" />
                        <Select value={playbackRate} onValueChange={setPlaybackRate}>
                          <SelectTrigger className="h-8 w-[74px] border-white/20 bg-white/10 text-xs text-white hover:bg-white/15 focus:ring-orange-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["0.5", "0.75", "1", "1.25", "1.5", "1.75", "2"].map((speed) => (
                              <SelectItem key={speed} value={speed}>{speed}x</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => void toggleFullscreen()}
                        className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                        aria-label={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
                      >
                        <Maximize className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-white/80 px-6">
                  <Lock className="h-12 w-12 mx-auto mb-3" />
                  <p className="font-semibold">{locked ? "This paid course is locked" : "This video is not available"}</p>
                  <p className="text-sm text-white/60 mt-1">Preview videos can play before access. Full videos unlock after enrollment.</p>
                </div>
              )}
            </div>
            {selectedVideo?.video_url && (
              <div className="border-t border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Use keyboard left/right to skip 30 seconds.</p>
              </div>
            )}
          </Card>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className="border-0" style={{ backgroundColor: `${ICON_COLORS.learning}1A`, color: ICON_COLORS.learning }}>
                {course.access_type === "free" ? "Free" : `${course.currency || "BDT"} ${Number(course.price || 0).toLocaleString()}`}
              </Badge>
              {course.can_play ? <Badge variant="secondary">Unlocked</Badge> : <Badge variant="outline">Locked</Badge>}
              {course.valid_until && <Badge variant="outline">Valid until {new Date(course.valid_until).toLocaleDateString()}</Badge>}
            </div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground mt-2 whitespace-pre-line">{course.description || course.summary}</p>
            {!course.can_play && (
              <div className="mt-4 flex gap-2">
                {course.access_type === "free" ? (
                  <Button className="text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => void startFree()}>Start Free Course</Button>
                ) : (
                  <Button
                    className="text-white"
                    style={{ backgroundColor: ICON_COLORS.learning }}
                    onClick={() => setPaymentOpen(true)}
                  >
                    Pay
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <Card className="border-border/70">
          <CardContent className="p-0">
            <div className="border-b border-border p-3">
              <h2 className="font-semibold">Playlist</h2>
              <p className="text-xs text-muted-foreground">{videos.length} videos</p>
            </div>
            <div className="max-h-[620px] overflow-y-auto">
              {videos.map((video, index) => {
                const active = selectedVideo?.id === video.id;
                const videoLocked = !video.video_url;
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => setSelectedVideoId(video.id)}
                    className={`flex w-full gap-3 p-3 text-left hover:bg-muted/60 ${active ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {videoLocked ? <Lock className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{video.is_preview ? "Preview" : videoLocked ? "Locked" : "Playable"}</p>
                    </div>
                  </button>
                );
              })}
              {videos.length === 0 && <p className="p-4 text-sm text-muted-foreground">No videos in this course yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedLocked && course.can_play && <p className="text-xs text-muted-foreground">This video is hidden by admin or missing an upload URL.</p>}
      <LearningPaymentDialog
        course={course}
        open={paymentOpen}
        submitting={submittingPayment}
        onOpenChange={setPaymentOpen}
        onSubmit={requestAccess}
      />
    </div>
  );
}
