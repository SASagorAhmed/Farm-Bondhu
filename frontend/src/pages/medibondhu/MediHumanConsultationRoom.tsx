import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { readSession, API_BASE } from "@/api/client";
import { acceptMediOnlineVisit, isMediPatientWaitingForDoctor, mediHumanJson } from "@/lib/medibondhuHuman";
import { subscribeMediHumanAppointments } from "@/lib/medibondhuAppointmentRealtime";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Maximize2,
  MessageSquare,
  Minimize2,
  PhoneOff,
  Send,
  Stethoscope,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { withApiTiming } from "@/lib/perfMetrics";
import { ICON_COLORS } from "@/lib/iconColors";

const MB = ICON_COLORS.medibondhu;

type RoomBootstrap = {
  appointment: Record<string, unknown> & {
    id?: string;
    status?: string;
    consultation_type?: string;
    chief_complaint?: string | null;
    doctor_name?: string | null;
    leave_deadline_at?: string | null;
    left_user_id?: string | null;
  };
  messages: Array<{
    id: string;
    sender_id: string;
    sender_name?: string | null;
    message: string;
    created_at: string;
  }>;
  participants: unknown[];
  permissions: {
    isPatient: boolean;
    isDoctor: boolean;
    canJoinVideo: boolean;
    slotWithinWindow?: boolean;
    zegoRoomId: string;
  };
};

const TERMINAL = new Set(["completed", "cancelled", "rejected"]);

const isTerminal = (status?: string | null) =>
  !!status && TERMINAL.has(String(status).toLowerCase());

const getZegoJoinErrorMessage = (err: unknown) => {
  const message = String((err as { message?: unknown })?.message || "");
  const codeFromObject = String((err as { code?: unknown })?.code || "");
  const raw = (() => {
    try {
      return JSON.stringify(err || {});
    } catch {
      return "";
    }
  })();
  const combined = `${codeFromObject} ${message} ${raw}`;
  const codeMatch = combined.match(/\b(20014|50119)\b/);
  if (codeMatch) {
    return `Call authentication failed (code ${codeMatch[1]}). Check ZEGOCLOUD_APP_ID and ZEGOCLOUD_SERVER_SECRET, then restart backend.`;
  }
  return "Failed to start call. Please retry after verifying backend and Zego configuration.";
};

export default function MediHumanConsultationRoom() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<RoomBootstrap["messages"]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [leaveGraceSeconds, setLeaveGraceSeconds] = useState<number | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const bookingRef = useRef<RoomBootstrap["appointment"] | null>(null);
  const stageShellRef = useRef<HTMLDivElement>(null);
  const zegoContainerRef = useRef<HTMLDivElement>(null);
  const zegoInstanceRef = useRef<{ destroy: () => void } | null>(null);
  const zegoAttemptRef = useRef(0);
  const skipLeaveHookRef = useRef(false);
  const finalizeBusyRef = useRef(false);
  const hasFinalizedRef = useRef(false);
  const lastLeftParticipantIdRef = useRef<string | null>(null);
  const localLeaveDeadlineRef = useRef<Date | null>(null);
  const terminalNavHandledRef = useRef(false);
  const doctorAcceptStartedRef = useRef(false);
  const roomQueryKey = useMemo(
    () => queryKeys().medibondhuHumanConsultationRoom(appointmentId),
    [appointmentId]
  );

  const patchRoomAppointment = useCallback(
    (patch: Partial<RoomBootstrap["appointment"]>) => {
      qc.setQueryData<RoomBootstrap | undefined>(roomQueryKey, (prev) =>
        prev?.appointment
          ? { ...prev, appointment: { ...prev.appointment, ...patch } }
          : prev
      );
      bookingRef.current = bookingRef.current ? { ...bookingRef.current, ...patch } : bookingRef.current;
    },
    [qc, roomQueryKey]
  );

  useEffect(() => {
    doctorAcceptStartedRef.current = false;
  }, [appointmentId]);

  const enterStageFullscreen = useCallback(async () => {
    const node = stageShellRef.current;
    if (!node) return;
    try {
      if (node.requestFullscreen) {
        await node.requestFullscreen();
      }
      setIsStageFullscreen(true);
    } catch {
      setIsStageFullscreen(true);
    }
  }, []);

  const exitStageFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* CSS fallback still exits below */
    }
    setIsStageFullscreen(false);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsStageFullscreen(document.fullscreenElement === stageShellRef.current);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exitStageFullscreen();
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exitStageFullscreen]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const backHref = () => "/medibondhu/consultations";

  const {
    data: roomBootstrap,
    isLoading,
    error: bootstrapError,
  } = useQuery({
    queryKey: roomQueryKey,
    enabled: Boolean(appointmentId),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    refetchInterval: (q) => {
      const st = String(
        ((q.state.data as RoomBootstrap | undefined)?.appointment?.status as string | undefined) ||
          bookingRef.current?.status ||
          ""
      ).toLowerCase();
      if (!st || isTerminal(st)) return false;
      return 3000;
    },
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!appointmentId) throw new Error("Missing appointment");
      const token = readSession()?.access_token;
      const res = await withApiTiming(
        "/v1/medibondhu/appointments/:id/room-bootstrap",
        () =>
          fetch(
            `${API_BASE}/v1/medibondhu/appointments/${appointmentId}/room-bootstrap?message_limit=160`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          )
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: RoomBootstrap;
        error?: string;
      };
      if (!res.ok || !body.data?.appointment) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Consultation not found or video is unavailable."
        );
      }
      const ap = body.data.appointment as RoomBootstrap["appointment"];
      bookingRef.current = ap;
      if (Array.isArray(body.data.messages)) {
        setMessages(body.data.messages);
      }
      setRoomError(null);
      return body.data;
    },
  });

  const appt = roomBootstrap?.appointment;
  const permissionDoctor = Boolean(roomBootstrap?.permissions?.isDoctor);
  const listBack = permissionDoctor ? "/medibondhu/doctor/dashboard" : backHref();

  const destroyZegoInstance = useCallback(() => {
    zegoAttemptRef.current += 1;
    skipLeaveHookRef.current = true;
    const instance = zegoInstanceRef.current;
    zegoInstanceRef.current = null;
    if (instance) {
      try {
        instance.destroy();
      } catch {
        /* Zego can throw while tearing down detached internal DOM nodes. */
      }
    }
    window.setTimeout(() => {
      skipLeaveHookRef.current = false;
    }, 1000);
  }, []);

  useEffect(() => {
    bookingRef.current = appt ?? null;
  }, [appt]);

  const terminalNow = useMemo(() => isTerminal(appt?.status), [appt?.status]);

  const handleTerminalAppointmentStatus = useCallback(
    (nextStatus: string) => {
      const st = String(nextStatus || "").toLowerCase();
      if (!appointmentId || !isTerminal(st)) return;
      if (terminalNavHandledRef.current) return;
      terminalNavHandledRef.current = true;
      hasFinalizedRef.current = true;
      finalizeBusyRef.current = false;
      localLeaveDeadlineRef.current = null;
      lastLeftParticipantIdRef.current = null;
      setLeaveGraceSeconds(null);
      patchRoomAppointment({ status: st, leave_deadline_at: null, left_user_id: null });
      destroyZegoInstance();
      void qc.invalidateQueries({ queryKey: roomQueryKey });
      void qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanWaitingRoom(appointmentId) });
      void qc.invalidateQueries({ queryKey: ["medibondhu-human-appt-feed"] });
      void qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-feed"] });
      void qc.invalidateQueries({
        queryKey: queryKeys().medibondhuHumanAppointmentDetail(appointmentId),
      });
      if (st === "completed") toast.success("Consultation ended.");
      else toast.info("This appointment is closed.");
      navigate(listBack, { replace: true });
    },
    [appointmentId, destroyZegoInstance, listBack, navigate, patchRoomAppointment, qc, roomQueryKey]
  );

  /** Online visits stay pending/confirmed until the doctor accepts; patients use the waiting room. */
  useEffect(() => {
    const online = String(appt?.consultation_type || "").toLowerCase() === "online";
    if (!appointmentId || terminalNow || !online || permissionDoctor) return;
    if (!isMediPatientWaitingForDoctor(appt?.status)) return;
    navigate(`/medibondhu/waiting/${appointmentId}`, { replace: true });
  }, [appointmentId, appt?.consultation_type, appt?.status, navigate, permissionDoctor, terminalNow]);

  /** Doctor opening the room accepts the visit (pending/confirmed → in_progress), like VetBondhu join. */
  useEffect(() => {
    if (!appointmentId || !permissionDoctor || terminalNow) return;
    const online = String(appt?.consultation_type || "").toLowerCase() === "online";
    if (!online || !isMediPatientWaitingForDoctor(appt?.status)) return;
    if (doctorAcceptStartedRef.current) return;
    doctorAcceptStartedRef.current = true;
    void (async () => {
      const accepted = await acceptMediOnlineVisit(appointmentId, { currentStatus: appt?.status });
      if (!accepted.ok) {
        doctorAcceptStartedRef.current = false;
        const msg = accepted.error || "Unable to start visit";
        setRoomError(msg);
        toast.error(msg);
        return;
      }
      setRoomError(null);
      await qc.invalidateQueries({ queryKey: roomQueryKey });
      void qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-feed"] });
      void qc.invalidateQueries({ queryKey: ["medibondhu-human-appt-feed"] });
    })();
  }, [appointmentId, appt?.consultation_type, appt?.status, permissionDoctor, qc, roomQueryKey, terminalNow]);

  useEffect(() => {
    if (!appointmentId) return;
    return subscribeMediHumanAppointments({
      channelKey: `medi-human-room-${appointmentId}`,
      appointmentId,
      onEvent: (_eventType, row) => {
        const nextStatus = String(row.status || "").toLowerCase();
        if (isTerminal(nextStatus)) {
          handleTerminalAppointmentStatus(nextStatus);
          return;
        }
        void qc.invalidateQueries({ queryKey: roomQueryKey });
        void qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanWaitingRoom(appointmentId) });
      },
    });
  }, [appointmentId, handleTerminalAppointmentStatus, qc, roomQueryKey]);

  useEffect(() => {
    if (!appointmentId) return;
    if (!terminalNow) {
      terminalNavHandledRef.current = false;
      return;
    }
    handleTerminalAppointmentStatus(String(appt?.status || ""));
  }, [appointmentId, appt?.status, handleTerminalAppointmentStatus, terminalNow]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canJoinRoom = Boolean(roomBootstrap?.permissions?.canJoinVideo && !terminalNow);

  const endVisit = useCallback(async (nextStatus: "completed" | "cancelled") => {
    if (!appointmentId || finalizeBusyRef.current) return;
    finalizeBusyRef.current = true;
    try {
      const { res, body } = await mediHumanJson(`/appointments/${appointmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, leave_deadline_at: null, left_user_id: null }),
      });
      if (!res.ok)
        throw new Error(String((body as { error?: string }).error || res.status));
      hasFinalizedRef.current = true;
      setLeaveGraceSeconds(null);
      localLeaveDeadlineRef.current = null;
      lastLeftParticipantIdRef.current = null;
      handleTerminalAppointmentStatus(nextStatus);
    } catch (e) {
      toast.error((e as Error).message || "Could not end visit");
    } finally {
      finalizeBusyRef.current = false;
    }
  }, [appointmentId, handleTerminalAppointmentStatus]);

  const completeVisit = useCallback(async () => {
    await endVisit("completed");
  }, [endVisit]);

  const cancelVisit = useCallback(async () => {
    await endVisit("cancelled");
  }, [endVisit]);

  const resetGraceUiWhenNoLeaveDeadline = useCallback(() => {
    localLeaveDeadlineRef.current = null;
    lastLeftParticipantIdRef.current = null;
    setLeaveGraceSeconds(null);
  }, []);

  const markLeaveGraceInDb = useCallback(async () => {
    if (!appointmentId || !user?.id) return;
    const current = bookingRef.current;
    if (!current || isTerminal(current.status)) return;
    const deadlineDate = new Date(Date.now() + 20_000);
    const deadline = deadlineDate.toISOString();
    lastLeftParticipantIdRef.current = user.id;
    localLeaveDeadlineRef.current = deadlineDate;
    setLeaveGraceSeconds(20);
    patchRoomAppointment({ leave_deadline_at: deadline, left_user_id: user.id });
    const { res, body } = await mediHumanJson(`/appointments/${appointmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ leave_deadline_at: deadline, left_user_id: user.id }),
    });
    if (!res.ok) {
      toast.error(String((body as { error?: string }).error || "Could not start leave timer"));
    }
  }, [appointmentId, patchRoomAppointment, user?.id]);

  const clearLeaveGraceInDb = useCallback(async () => {
    if (!appointmentId) return;
    const { res } = await mediHumanJson(`/appointments/${appointmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ leave_deadline_at: null, left_user_id: null }),
    });
    if (res.ok) {
      patchRoomAppointment({ leave_deadline_at: null, left_user_id: null });
      resetGraceUiWhenNoLeaveDeadline();
    }
  }, [appointmentId, patchRoomAppointment, resetGraceUiWhenNoLeaveDeadline]);

  const finalizeVisitAfterGrace = useCallback(async () => {
    if (!appointmentId || finalizeBusyRef.current || hasFinalizedRef.current) return;
    finalizeBusyRef.current = true;
    try {
      const { res, body } = await mediHumanJson(`/appointments/${appointmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed", leave_deadline_at: null, left_user_id: null }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      hasFinalizedRef.current = true;
      resetGraceUiWhenNoLeaveDeadline();
      await qc.invalidateQueries({ queryKey: roomQueryKey });
      void qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-feed"] });
      void qc.invalidateQueries({ queryKey: ["medibondhu-human-appt-feed"] });
      toast.success("Consultation ended.");
    } catch (e) {
      toast.error((e as Error).message || "Could not complete visit");
    } finally {
      finalizeBusyRef.current = false;
    }
  }, [appointmentId, qc, resetGraceUiWhenNoLeaveDeadline, roomQueryKey]);

  const beginGraceLeave = useCallback(
    async (navigateAway = false) => {
      if (!appointmentId) return;
      const current = bookingRef.current;
      if (!current || current.status !== "in_progress" || isTerminal(current.status)) {
        if (navigateAway) navigate(listBack);
        return;
      }
      await markLeaveGraceInDb();
      toast.info("You left the room. Rejoin within 20 seconds or consultation will auto-complete.");
      void qc.invalidateQueries({ queryKey: roomQueryKey });
      if (navigateAway) navigate(listBack);
    },
    [appointmentId, listBack, markLeaveGraceInDb, navigate, qc, roomQueryKey]
  );

  useEffect(() => {
    if (appt?.status !== "in_progress" || appt.leave_deadline_at) return;
    resetGraceUiWhenNoLeaveDeadline();
  }, [appt?.leave_deadline_at, appt?.status, resetGraceUiWhenNoLeaveDeadline]);

  useEffect(() => {
    const deadlineFromDb = appt?.leave_deadline_at
      ? new Date(appt.leave_deadline_at)
      : null;
    const effectiveDeadline = deadlineFromDb ?? localLeaveDeadlineRef.current;
    const leftUserId = appt?.left_user_id ?? lastLeftParticipantIdRef.current;
    if (!effectiveDeadline || !leftUserId) {
      setLeaveGraceSeconds(null);
      return;
    }

    lastLeftParticipantIdRef.current = String(leftUserId);
    localLeaveDeadlineRef.current = effectiveDeadline;
    const updateRemaining = () => {
      const ms = effectiveDeadline.getTime() - Date.now();
      const sec = Math.max(0, Math.ceil(ms / 1000));
      setLeaveGraceSeconds(sec);
      if (sec === 0 && !hasFinalizedRef.current && !finalizeBusyRef.current) {
        void finalizeVisitAfterGrace();
      }
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [appt?.leave_deadline_at, appt?.left_user_id, finalizeVisitAfterGrace]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user || !appointmentId) return;
    if (terminalNow) {
      toast.error("Messaging is disabled for closed appointments.");
      return;
    }
    const txt = newMessage.trim();
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender_id: user.id,
        sender_name: user.name,
        message: txt,
        created_at: new Date().toISOString(),
      },
    ]);
    setNewMessage("");
    const { res, body } = await mediHumanJson<{ data?: { id: string } }>(
      `/appointments/${appointmentId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ message: txt }),
      }
    );
    const errText = typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "";
    if (!res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      toast.error(errText || "Failed to send");
      setNewMessage(txt);
      return;
    }
    void qc.invalidateQueries({
      queryKey: queryKeys().medibondhuHumanConsultationRoom(appointmentId),
    });
  }, [appointmentId, newMessage, qc, terminalNow, user]);

  useEffect(() => {
    if (!appointmentId || !user?.id) return;
    if (hasFinalizedRef.current) return;
    if (!canJoinRoom) return;
    const container = zegoContainerRef.current;
    if (!container) return;

    zegoAttemptRef.current += 1;
    const attemptId = zegoAttemptRef.current;
    let cancelled = false;

    const zegoRoomId = String(roomBootstrap?.permissions?.zegoRoomId || `medi-human-${appointmentId}`);

    const run = async () => {
      if (zegoInstanceRef.current) {
        destroyZegoInstance();
      }

      try {
        const accessToken = readSession()?.access_token;
        if (!accessToken) {
          toast.error("Not authenticated");
          return;
        }
        const tk = await fetch(`${API_BASE}/v1/tools/zego-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            roomId: zegoRoomId,
            userName: user.name || "Participant",
          }),
        });
        if (!tk.ok) {
          const err = await tk.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Token failed");
        }
        const { token, appID } = (await tk.json()) as {
          token: string;
          appID: string | number;
        };
        if (cancelled || attemptId !== zegoAttemptRef.current) return;

        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
        if (cancelled || attemptId !== zegoAttemptRef.current) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          Number(appID),
          String(token),
          zegoRoomId,
          String(user.id),
          String(user.name || "User")
        );
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        zp.joinRoom({
          container,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnCameraWhenJoining: false,
          turnOnMicrophoneWhenJoining: false,
          showPreJoinView: false,
          showScreenSharingButton: true,
          showTextChat: true,
          showUserList: true,
          showLayoutButton: true,
          showRoomDetailsButton: true,
          showFullscreenButton: true,
          showSwitchCameraButton: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showTurnOffRemoteCameraButton: true,
          showTurnOffRemoteMicrophoneButton: true,
          showMoreButton: true,
          autoHideFooter: false,
          showRotatingScreenButton: true,
          showRoomTimer: true,
          showNonVideoUser: true,
          showOnlyAudioUser: true,
          videoScreenConfig: {
            objectFit: "cover",
            localMirror: true,
            pullStreamMirror: false,
          },
          screenSharingConfig: {
            onError: () => "Screen sharing may require a desktop browser. Please use laptop/desktop if this phone does not support it.",
          },
          onJoinRoom: () => {
            const current = bookingRef.current;
            const sameUserLeft =
              user?.id &&
              (lastLeftParticipantIdRef.current === user.id ||
                String(current?.left_user_id || "") === String(user.id));
            if (current?.leave_deadline_at && sameUserLeft) {
              void clearLeaveGraceInDb();
              toast.success("Rejoined consultation.");
            }
          },
          onLeaveRoom: () => {
            if (skipLeaveHookRef.current) return;
            zegoInstanceRef.current = null;
            void beginGraceLeave(false);
          },
        });
      } catch (err: unknown) {
        console.error("MediBondhu Zego init error:", err);
        toast.error(getZegoJoinErrorMessage(err));
      }
    };

    void run();

    return () => {
      cancelled = true;
      destroyZegoInstance();
    };
  }, [
    appointmentId,
    beginGraceLeave,
    canJoinRoom,
    clearLeaveGraceInDb,
    destroyZegoInstance,
    roomBootstrap?.permissions?.zegoRoomId,
    user?.id,
    user?.name,
  ]);

  const leaveOnly = () => {
    void beginGraceLeave(true);
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (bootstrapError instanceof Error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
        <p className="text-sm text-muted-foreground max-w-md">{bootstrapError.message}</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate(listBack)}>
          Back
        </Button>
      </div>
    );
  }

  if (isLoading || !appt) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Clock className="h-8 w-8 animate-spin" style={{ color: MB }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button type="button" variant="ghost" size="icon" onClick={leaveOnly} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: MB }}
          >
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-foreground text-sm truncate">
              {String(appt.doctor_name || "MediBondhu doctor")}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge className="text-xs" style={{ backgroundColor: `${MB}18`, color: MB }}>
                Online teleconsult
              </Badge>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3" /> {fmt(elapsed)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {permissionDoctor && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="rounded-lg"
              disabled={terminalNow}
              onClick={() => void completeVisit()}
            >
              <PhoneOff className="h-4 w-4 mr-1" />
              End &amp; complete
            </Button>
          )}
          {!permissionDoctor && (
            <Button type="button" variant="destructive" size="sm" className="rounded-lg" onClick={() => void cancelVisit()}>
              <PhoneOff className="h-4 w-4 mr-1" />
              End consultation
            </Button>
          )}
        </div>
      </div>

      {roomError && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2">{roomError}</p>
      )}

      {leaveGraceSeconds !== null && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: `${MB}55`, backgroundColor: `${MB}12`, color: MB }}
        >
          Rejoin within <span className="font-bold">{leaveGraceSeconds}</span>s or this consultation will end automatically.
        </div>
      )}

      {!canJoinRoom && !terminalNow && (
        <p className="text-sm rounded-lg border px-3 py-2 bg-muted/30 text-muted-foreground">
          {permissionDoctor && isMediPatientWaitingForDoctor(appt?.status)
            ? "Starting the visit… Video will connect in a moment."
            : permissionDoctor
              ? "Visit is not active yet. Refresh or return to the dashboard and use Join video again."
              : isMediPatientWaitingForDoctor(appt?.status)
                ? "Waiting for your doctor to start the visit. You will be connected automatically."
                : "Video is not available for this appointment right now."}
          {roomBootstrap?.permissions?.slotWithinWindow === false &&
            String(appt?.status || "").toLowerCase() === "in_progress" && (
              <span className="block mt-1 text-xs">
                Note: You are outside the originally scheduled slot time, but the visit can still proceed.
              </span>
            )}
        </p>
      )}

      <div
        className="consultation-room-grid grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        <div className="lg:col-span-2">
          <Card className="consultation-video-card shadow-card overflow-hidden h-full rounded-xl border-border">
            <div className="h-1" style={{ backgroundColor: MB }} />
            <CardContent className="p-0 h-full">
              <div
                ref={stageShellRef}
                className={`medibondhu-zego-stage consultation-zego-stage ${isStageFullscreen ? "consultation-zego-stage-fullscreen" : ""}`}
                style={{ borderColor: `${MB}33` }}
              >
                <div className="consultation-zego-stage-toolbar">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0 rounded-full bg-background/90 p-0"
                    style={{ borderColor: `${MB}55`, color: MB }}
                    aria-label={isStageFullscreen ? "Close fullscreen" : "Open fullscreen"}
                    onClick={() => void (isStageFullscreen ? exitStageFullscreen() : enterStageFullscreen())}
                  >
                    {isStageFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="consultation-zego-frame">
                  <div ref={zegoContainerRef} className="consultation-zego-sdk-root" />
                </div>
                {isStageFullscreen && (
                  <Button
                    type="button"
                    size="icon"
                    className="consultation-zego-floating-close h-10 w-10 rounded-full p-0 text-white"
                    style={{ backgroundColor: MB }}
                    aria-label="Close fullscreen"
                    onClick={() => void exitStageFullscreen()}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <div
            className="consultation-mobile-help-strip"
            style={{ borderColor: `${MB}35`, backgroundColor: `${MB}10`, color: MB }}
          >
            Controls stay in the bottom call bar. Use More for extra options; screen share may need a desktop browser.
          </div>
        </div>

        <div className="consultation-chat-panel lg:col-span-1">
          <Card className="consultation-chat-card shadow-card overflow-hidden h-full flex flex-col rounded-xl border-border">
            <div className="h-1" style={{ backgroundColor: MB }} />
            <div className="p-3 border-b border-border flex items-center gap-2">
              <MessageSquare className="h-4 w-4" style={{ color: MB }} />
              <span className="font-display font-bold text-sm text-foreground">Chat</span>
            </div>

            <div className="consultation-chat-messages flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 240 }}>
              {appt.chief_complaint ? (
                <div className="text-center py-2">
                  <Badge
                    style={{ backgroundColor: `${MB}14`, color: MB }}
                    className="text-xs max-w-[95%] whitespace-normal"
                  >
                    Chief complaint · {String(appt.chief_complaint).slice(0, 120)}
                    {String(appt.chief_complaint).length > 120 ? "…" : ""}
                  </Badge>
                </div>
              ) : null}

              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                        isMe ? "rounded-br-sm text-white" : "rounded-bl-sm bg-accent"
                      }`}
                      style={isMe ? { backgroundColor: MB } : undefined}
                    >
                      {!isMe && (
                        <p className="text-xs font-semibold mb-0.5" style={{ color: MB }}>
                          {msg.sender_name || "Participant"}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <p
                        className={`text-[10px] mt-1 ${isMe ? "text-white/70" : "text-muted-foreground"}`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="consultation-chat-input p-3 border-t border-border">
              {terminalNow && (
                <p className="mb-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  This consultation has ended. Chat history remains available in read-only mode.
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  aria-label="Chat message"
                  placeholder="Type a message…"
                  value={newMessage}
                  disabled={terminalNow}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
                  className="flex-1 rounded-lg"
                />
                <Button
                  type="button"
                  size="icon"
                  className="shrink-0 rounded-lg text-white"
                  style={{ backgroundColor: MB }}
                  disabled={!newMessage.trim() || terminalNow}
                  onClick={() => void sendMessage()}
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
