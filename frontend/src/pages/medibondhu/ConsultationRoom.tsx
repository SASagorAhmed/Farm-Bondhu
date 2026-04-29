import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, readSession, API_BASE } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Send, MessageSquare, Stethoscope, Clock,
  ArrowLeft, FileText, PhoneOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { withApiTiming } from "@/lib/perfMetrics";

const MB = "#12C2D6";
const TERMINAL_BOOKING_STATUSES = new Set(["completed", "cancelled"]);

const isTerminalBookingStatus = (status?: string | null) =>
  !!status && TERMINAL_BOOKING_STATUSES.has(status);

const canEnterActiveRoom = (booking: any, currentUserId?: string) => {
  if (!booking || booking.status !== "in_progress") return false;
  if (isTerminalBookingStatus(booking.status)) return false;
  const hasLeaveDeadline = Boolean(booking.leave_deadline_at);
  if (!hasLeaveDeadline) return true;
  // During grace window, keep both participants in room so both can
  // observe synchronized countdown and terminal status update.
  return true;
};

const getMessagesSignature = (items: any[]) =>
  items
    .map((msg) => `${msg.id}:${msg.created_at}:${msg.message}`)
    .join("|");

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

const patchConsultationCaches = (
  prev: any,
  targetBookingId: string,
  nextStatus: "completed" | "cancelled"
) => {
  if (!prev) return prev;
  const patchRow = (row: any) =>
    row?.id === targetBookingId
      ? { ...row, status: nextStatus, leave_deadline_at: null, left_user_id: null }
      : row;
  if (Array.isArray(prev)) {
    return prev.map(patchRow);
  }
  if (Array.isArray(prev.consultations)) {
    return {
      ...prev,
      consultations: prev.consultations.map(patchRow),
    };
  }
  return prev;
};

export default function ConsultationRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const consultationsPath = location.pathname.startsWith("/vet/")
    ? "/vet/consultations"
    : "/medibondhu/consultations";
  const queryClient = useQueryClient();
  const [booking, setBooking] = useState<any>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [leaveGraceSeconds, setLeaveGraceSeconds] = useState<number | null>(null);
  const [zegoRetryTick, setZegoRetryTick] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesSignatureRef = useRef("");
  const bookingStatusRef = useRef<string | null>(null);
  const hasHandledTerminalStatusRef = useRef(false);

  // ZegoCloud
  const zegoContainerRef = useRef<HTMLDivElement>(null);
  const zegoInstanceRef = useRef<any>(null);
  /** True while React/Zego is destroying the instance so `onLeaveRoom` does not PATCH + navigate. */
  const skipZegoLeaveHookRef = useRef(false);
  /** True only after Zego reports a successful room join. */
  const hasJoinedZegoRoomRef = useRef(false);
  /** Prevent duplicate finalize writes from leave + click races. */
  const finalizeInFlightRef = useRef(false);
  const hasFinalizedRef = useRef(false);
  const lastLeftParticipantIdRef = useRef<string | null>(null);
  const localLeaveDeadlineRef = useRef<Date | null>(null);
  const zegoInitInFlightRef = useRef(false);
  const zegoInitStatusRef = useRef<"idle" | "bootstrapping" | "joined" | "failed">("idle");
  const zegoRetryCountRef = useRef(0);
  const zegoRetryTimerRef = useRef<number | null>(null);
  const isDestroyingZegoRef = useRef(false);
  const hasExitGraceStartedRef = useRef(false);
  const zegoRoomKeyRef = useRef<string | null>(null);
  const zegoJoinedRoomKeyRef = useRef<string | null>(null);
  const zegoInitAttemptRef = useRef(0);
  const isMountedRef = useRef(true);
  const bookingRef = useRef<any>(null);
  const isUnmountingRef = useRef(false);
  const markLeaveGraceInDbRef = useRef<(() => Promise<void>) | null>(null);
  const clearLeaveGraceTimerRef = useRef<(() => void) | null>(null);
  const clearLeaveGraceInDbRef = useRef<(() => Promise<void>) | null>(null);
  const finalizeConsultationRef = useRef<((source: "sdk_leave" | "grace_timeout") => Promise<void>) | null>(null);

  useEffect(() => {
    bookingRef.current = booking;
  }, [booking]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isUnmountingRef.current = true;
      if (zegoRetryTimerRef.current) {
        window.clearTimeout(zegoRetryTimerRef.current);
        zegoRetryTimerRef.current = null;
      }
    };
  }, []);

  const clearZegoRetryTimer = useCallback(() => {
    if (zegoRetryTimerRef.current) {
      window.clearTimeout(zegoRetryTimerRef.current);
      zegoRetryTimerRef.current = null;
    }
  }, []);

  const normalizedConsultMethod = useMemo(
    () => String(booking?.consultation_method ?? "").toLowerCase(),
    [booking?.consultation_method]
  );

  const { data: roomBootstrap, isLoading: bookingLoading } = useQuery({
    queryKey: queryKeys().consultationRoom(bookingId),
    enabled: Boolean(bookingId),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    // Reliability fallback: if realtime misses an update, both sides still
    // observe terminal status and close the room.
    refetchInterval: (q) => {
      const status = String((q.state.data as any)?.booking?.status || bookingRef.current?.status || "");
      if (!status) return 3000;
      if (status === "completed" || status === "cancelled") return false;
      return 3000;
    },
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const token = readSession()?.access_token;
      const res = await withApiTiming("/v1/medibondhu/bookings/:id/room-bootstrap", () =>
        fetch(`${API_BASE}/v1/medibondhu/bookings/${bookingId}/room-bootstrap?message_limit=160`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: { booking?: any; messages?: any[] };
      };
      if (!res.ok || !body.data?.booking) {
        setRoomError("Consultation not found or you do not have access.");
        return null;
      }
      setRoomError(null);
      return body.data;
    },
  });
  useEffect(() => {
    if (!roomBootstrap?.booking) return;
    bookingStatusRef.current = roomBootstrap.booking.status ?? null;
    setBooking((prev: any) => {
      if (
        prev &&
        prev.id === roomBootstrap.booking.id &&
        prev.status === roomBootstrap.booking.status &&
        String(prev.leave_deadline_at || "") === String(roomBootstrap.booking.leave_deadline_at || "") &&
        String(prev.left_user_id || "") === String(roomBootstrap.booking.left_user_id || "")
      ) {
        return prev;
      }
      return roomBootstrap.booking;
    });
    if (Array.isArray(roomBootstrap.messages)) {
      messagesSignatureRef.current = getMessagesSignature(roomBootstrap.messages);
      setMessages(roomBootstrap.messages);
    }
  }, [roomBootstrap]);

  useEffect(() => {
    if (!booking || hasHandledTerminalStatusRef.current) return;
    if (booking.status === "cancelled" || booking.status === "completed") {
      hasHandledTerminalStatusRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["medibondhu-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["vet-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["vet-dashboard-bookings"] });
      if (booking.status === "completed") {
        toast.success("Your consultation successfully completed.");
      } else {
        toast.info("Consultation cancelled.");
      }
      navigate(consultationsPath);
      return;
    }
  }, [booking, consultationsPath, navigate, user?.id]);

  // Realtime subscription (best effort; polling remains authoritative fallback).
  useEffect(() => {
    if (!bookingId) return;
    const channel = api
      .channel(`room-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "consultation_messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === payload.new.id)) return prev;
            const nextMessages = [...prev, payload.new];
            messagesSignatureRef.current = getMessagesSignature(nextMessages);
            return nextMessages;
          });
          queryClient.setQueryData(["consultation-room-messages", bookingId || "unknown"], (prev: any) => {
            const current = Array.isArray(prev) ? prev : [];
            if (current.some((msg: any) => msg.id === payload.new.id)) return current;
            return [...current, payload.new];
          });
        }
      )
      .subscribe();

    return () => { api.removeChannel(channel); };
  }, [bookingId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const clearLeaveGraceTimer = useCallback(() => {
    setLeaveGraceSeconds(null);
    lastLeftParticipantIdRef.current = null;
    localLeaveDeadlineRef.current = null;
  }, []);
  useEffect(() => {
    clearLeaveGraceTimerRef.current = clearLeaveGraceTimer;
  }, [clearLeaveGraceTimer]);

  /** Clear local grace state when the session is active and DB has no leave window (chat rejoin, realtime clear, bootstrap). */
  const resetGraceUiWhenNoLeaveDeadline = useCallback(() => {
    clearLeaveGraceTimer();
    hasExitGraceStartedRef.current = false;
  }, [clearLeaveGraceTimer]);

  useEffect(() => {
    const b = roomBootstrap?.booking;
    if (!b || b.status !== "in_progress" || b.leave_deadline_at) return;
    resetGraceUiWhenNoLeaveDeadline();
  }, [roomBootstrap, resetGraceUiWhenNoLeaveDeadline]);

  const markLeaveGraceInDb = useCallback(async () => {
    if (!bookingId || !user?.id) return;
    const b = bookingRef.current;
    if (!b || isTerminalBookingStatus(b.status)) return;
    const deadlineDate = new Date(Date.now() + 20_000);
    const deadline = deadlineDate.toISOString();
    // Keep timer visible immediately even if DB/realtime response arrives late.
    lastLeftParticipantIdRef.current = user.id;
    localLeaveDeadlineRef.current = deadlineDate;
    setLeaveGraceSeconds(20);
    const { error } = await api
      .from("consultation_bookings")
      .update({
        leave_deadline_at: deadline,
        left_user_id: user.id,
      })
      .eq("id", bookingId);
    if (error) {
      console.error("Failed to set leave grace timer:", error.message);
      return;
    }
    setBooking((prev: any) =>
      prev ? { ...prev, leave_deadline_at: deadline, left_user_id: user.id } : prev
    );
  }, [bookingId, user?.id]);
  useEffect(() => {
    markLeaveGraceInDbRef.current = markLeaveGraceInDb;
  }, [markLeaveGraceInDb]);

  const clearLeaveGraceInDb = useCallback(async () => {
    if (!bookingId) return;
    await api
      .from("consultation_bookings")
      .update({
        leave_deadline_at: null,
        left_user_id: null,
      })
      .eq("id", bookingId);
    setBooking((prev: any) =>
      prev ? { ...prev, leave_deadline_at: null, left_user_id: null } : prev
    );
    clearLeaveGraceTimer();
  }, [bookingId, clearLeaveGraceTimer]);
  useEffect(() => {
    clearLeaveGraceInDbRef.current = clearLeaveGraceInDb;
  }, [clearLeaveGraceInDb]);

  const finalizeConsultation = useCallback(async (source: "sdk_leave" | "grace_timeout") => {
    if (!bookingId) {
      return;
    }
    if (!user) {
      return;
    }
    if (finalizeInFlightRef.current) {
      return;
    }
    if (hasFinalizedRef.current) {
      navigate(consultationsPath);
      return;
    }
    const b = bookingRef.current;
    if (!b) {
      return;
    }
    if (isTerminalBookingStatus(b.status)) {
      hasFinalizedRef.current = true;
      navigate(consultationsPath);
      return;
    }

    finalizeInFlightRef.current = true;
    const nextStatus = "completed";
    try {
      const { error } = await api
        .from("consultation_bookings")
        .update({ status: nextStatus })
        .eq("id", bookingId);
      if (error) {
        toast.error(error.message || "Unable to update consultation status");
        return;
      }

      hasFinalizedRef.current = true;
      await clearLeaveGraceInDb();
      clearLeaveGraceTimer();
      queryClient.setQueriesData(
        { queryKey: ["medibondhu-consultations"] },
        (prev: any) => patchConsultationCaches(prev, bookingId, "completed")
      );
      queryClient.setQueriesData(
        { queryKey: ["vet-consultations"] },
        (prev: any) => patchConsultationCaches(prev, bookingId, "completed")
      );
      queryClient.invalidateQueries({ queryKey: ["vet-dashboard-bookings"] });
      toast.success("Your consultation successfully completed.");
      queryClient.invalidateQueries({ queryKey: queryKeys().consultationRoom(bookingId) });
      navigate(consultationsPath);
    } catch (error) {
      console.error("Finalize consultation failed:", error);
      toast.error("Unable to end consultation. Please try again.");
    } finally {
      finalizeInFlightRef.current = false;
    }
  }, [bookingId, clearLeaveGraceInDb, clearLeaveGraceTimer, consultationsPath, navigate, queryClient, user]);
  useEffect(() => {
    finalizeConsultationRef.current = finalizeConsultation;
  }, [finalizeConsultation]);

  const beginGraceLeave = useCallback(
    async (reason: "sdk_leave" | "navigate_back" | "unmount", opts?: { navigateAway?: boolean }) => {
      if (hasFinalizedRef.current) {
        if (opts?.navigateAway) navigate(consultationsPath);
        return;
      }
      if (!bookingId || !user?.id) {
        if (opts?.navigateAway) navigate(consultationsPath);
        return;
      }
      if (reason === "navigate_back" || reason === "unmount") {
        if (hasExitGraceStartedRef.current) {
          if (opts?.navigateAway) navigate(consultationsPath);
          return;
        }
        hasExitGraceStartedRef.current = true;
      }
      await markLeaveGraceInDb();
      if (reason === "sdk_leave") {
        toast.info("You left the room. Rejoin within 20 seconds or consultation will auto-complete.");
      }
      queryClient.invalidateQueries({ queryKey: queryKeys().consultationRoom(bookingId) });
      if (opts?.navigateAway) navigate(consultationsPath);
    },
    [bookingId, consultationsPath, markLeaveGraceInDb, navigate, queryClient, user?.id]
  );

  const completeConsultationImmediately = useCallback(async () => {
    if (!bookingId || !user) return;
    if (finalizeInFlightRef.current) return;
    if (hasFinalizedRef.current) {
      navigate(consultationsPath);
      return;
    }
    finalizeInFlightRef.current = true;
    try {
      const completeAttempt = await api
        .from("consultation_bookings")
        .update({
          status: "completed",
          leave_deadline_at: null,
          left_user_id: null,
        })
        .eq("id", bookingId);
      let finalStatus: "completed" | "cancelled" = "completed";
      if (completeAttempt.error) {
        const cancelAttempt = await api
          .from("consultation_bookings")
          .update({
            status: "cancelled",
            leave_deadline_at: null,
            left_user_id: null,
          })
          .eq("id", bookingId);
        if (cancelAttempt.error) {
          toast.error(
            completeAttempt.error.message ||
              cancelAttempt.error.message ||
              "Unable to complete consultation"
          );
          return;
        }
        finalStatus = "cancelled";
      }
      hasFinalizedRef.current = true;
      clearLeaveGraceTimer();
      queryClient.setQueriesData(
        { queryKey: ["medibondhu-consultations"] },
        (prev: any) => patchConsultationCaches(prev, bookingId, finalStatus)
      );
      queryClient.setQueriesData(
        { queryKey: ["vet-consultations"] },
        (prev: any) => patchConsultationCaches(prev, bookingId, finalStatus)
      );
      queryClient.invalidateQueries({ queryKey: queryKeys().consultationRoom(bookingId) });
      queryClient.invalidateQueries({ queryKey: ["medibondhu-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["vet-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["vet-dashboard-bookings"] });
      if (finalStatus === "completed") {
        toast.success("Your consultation successfully completed.");
      } else {
        toast.info("Consultation cancelled.");
      }
      navigate(consultationsPath);
    } finally {
      finalizeInFlightRef.current = false;
    }
  }, [bookingId, clearLeaveGraceTimer, consultationsPath, navigate, queryClient, user]);

  const endConsultation = useCallback(async () => {
    await completeConsultationImmediately();
  }, [completeConsultationImmediately]);

  const leaveRoomAndGoBack = useCallback(async () => {
    await beginGraceLeave("navigate_back", { navigateAway: true });
  }, [beginGraceLeave]);

  const canJoinRoom = Boolean(
    canEnterActiveRoom(booking, user?.id)
  );

  // Initialize ZegoCloud for audio/video (deps are primitives so polling does not destroy the room)
  useEffect(() => {
    if (!bookingId || !user?.id) return;
    if (!normalizedConsultMethod || normalizedConsultMethod === "chat") return;
    if (!canJoinRoom) return;
    if (isUnmountingRef.current || !isMountedRef.current) return;
    const roomKey = `${bookingId}:${user.id}:${normalizedConsultMethod}`;
    if (zegoJoinedRoomKeyRef.current === roomKey) return;
    if (zegoRoomKeyRef.current === roomKey && zegoInitStatusRef.current === "joined") return;
    if (zegoInitInFlightRef.current || zegoInitStatusRef.current === "bootstrapping") return;
    zegoInitInFlightRef.current = true;
    zegoInitStatusRef.current = "bootstrapping";
    zegoRoomKeyRef.current = roomKey;
    const attemptId = ++zegoInitAttemptRef.current;

    let cancelled = false;

    const initZego = async () => {
      try {
        if (zegoInstanceRef.current) {
          isDestroyingZegoRef.current = true;
          try {
            zegoInstanceRef.current.destroy();
          } catch {
            /* ignore stale sdk cleanup */
          }
          zegoInstanceRef.current = null;
          isDestroyingZegoRef.current = false;
        }
        const accessToken = readSession()?.access_token;
        if (!accessToken) {
          toast.error("Not authenticated");
          return;
        }

        const res = await fetch(`${API_BASE}/v1/tools/zego-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ roomId: bookingId, userName: user.name }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Token generation failed");
        }

        const { token, appID } = await res.json();
        if (
          cancelled ||
          zegoRoomKeyRef.current !== roomKey ||
          attemptId !== zegoInitAttemptRef.current ||
          isUnmountingRef.current ||
          !isMountedRef.current
        ) {
          return;
        }

        // Dynamically import ZegoCloud SDK
        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
        if (
          cancelled ||
          zegoRoomKeyRef.current !== roomKey ||
          attemptId !== zegoInitAttemptRef.current ||
          isUnmountingRef.current ||
          !isMountedRef.current
        ) {
          return;
        }

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          Number(appID),
          String(token),
          String(bookingId),
          String(user.id),
          String(user.name || "User")
        );
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;
        hasJoinedZegoRoomRef.current = false;

        const container = zegoContainerRef.current;
        if (
          !container ||
          !container.isConnected ||
          cancelled ||
          zegoRoomKeyRef.current !== roomKey ||
          attemptId !== zegoInitAttemptRef.current ||
          isUnmountingRef.current ||
          !isMountedRef.current
        ) {
          zegoInitStatusRef.current = "failed";
          try {
            zp.destroy();
          } catch {
            /* ignore */
          }
          if (zegoInstanceRef.current === zp) zegoInstanceRef.current = null;
          if (zegoRetryCountRef.current < 3 && !cancelled && zegoJoinedRoomKeyRef.current !== roomKey) {
            zegoRetryCountRef.current += 1;
            clearZegoRetryTimer();
            zegoRetryTimerRef.current = window.setTimeout(() => {
              if (attemptId !== zegoInitAttemptRef.current) return;
              if (isUnmountingRef.current || !isMountedRef.current) return;
              setZegoRetryTick((n) => n + 1);
            }, 700);
          }
          return;
        }

        zp.joinRoom({
          container,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          // Start muted to avoid permission-denied auto-leave loops on some browsers.
          turnOnCameraWhenJoining: false,
          turnOnMicrophoneWhenJoining: false,
          showPreJoinView: false,
          onJoinRoom: () => {
            hasJoinedZegoRoomRef.current = true;
            zegoInitStatusRef.current = "joined";
            zegoJoinedRoomKeyRef.current = roomKey;
            zegoRetryCountRef.current = 0;
            clearZegoRetryTimer();
            // Successful room join always resets local leave cycle state.
            clearLeaveGraceTimer();
            hasExitGraceStartedRef.current = false;
            const current = bookingRef.current;
            const sameUserLeftRecently = lastLeftParticipantIdRef.current === user.id;
            const hasActiveGrace = Boolean(current?.leave_deadline_at);
            if (hasActiveGrace) {
              void clearLeaveGraceInDb();
              if (sameUserLeftRecently || current?.left_user_id === user.id) {
                toast.success("Rejoined in time. Consultation is still active.");
              }
            }
          },
          onLeaveRoom: () => {
            if (skipZegoLeaveHookRef.current) return;
            if (isDestroyingZegoRef.current) return;
            if (!hasJoinedZegoRoomRef.current) return;
            clearZegoRetryTimer();
            hasJoinedZegoRoomRef.current = false;
            zegoInitStatusRef.current = "idle";
            zegoJoinedRoomKeyRef.current = null;
            // SDK already left room; avoid duplicate destroy on unmount race.
            zegoInstanceRef.current = null;
            void beginGraceLeave("sdk_leave");
          },
        });
      } catch (err: any) {
        console.error("ZegoCloud init error:", err);
        const friendlyMessage = getZegoJoinErrorMessage(err);
        setRoomError(friendlyMessage);
        zegoInitStatusRef.current = "failed";
        if (zegoRetryCountRef.current < 3 && !cancelled && zegoJoinedRoomKeyRef.current !== roomKey) {
          zegoRetryCountRef.current += 1;
          clearZegoRetryTimer();
          zegoRetryTimerRef.current = window.setTimeout(() => {
            if (attemptId !== zegoInitAttemptRef.current) return;
            if (isUnmountingRef.current || !isMountedRef.current) return;
            setZegoRetryTick((n) => n + 1);
          }, 1200);
        } else {
          toast.error(friendlyMessage);
        }
      } finally {
        zegoInitInFlightRef.current = false;
      }
    };

    initZego();

    return () => {
      cancelled = true;
      zegoInitAttemptRef.current += 1;
      clearZegoRetryTimer();
      const hadActiveRoom = hasJoinedZegoRoomRef.current;
      if (isUnmountingRef.current && hadActiveRoom && !hasFinalizedRef.current) {
        void beginGraceLeave("unmount");
      }
      clearLeaveGraceTimerRef.current?.();
      hasJoinedZegoRoomRef.current = false;
      zegoInitStatusRef.current = "idle";
      zegoJoinedRoomKeyRef.current = null;
      zegoRoomKeyRef.current = null;
      zegoInitInFlightRef.current = false;
      if (zegoInstanceRef.current) {
        skipZegoLeaveHookRef.current = true;
        isDestroyingZegoRef.current = true;
        try {
          zegoInstanceRef.current.destroy();
        } catch {
          /* ignore */
        }
        zegoInstanceRef.current = null;
        isDestroyingZegoRef.current = false;
        queueMicrotask(() => {
          skipZegoLeaveHookRef.current = false;
        });
      }
    };
  }, [beginGraceLeave, bookingId, canJoinRoom, clearZegoRetryTimer, normalizedConsultMethod, user?.id, zegoRetryTick]);

  useEffect(() => {
    if (!bookingId) return;
    const channel = api
      .channel(`room-booking-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "consultation_bookings",
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          setBooking((prev: any) => {
            const next = { ...(prev || {}), ...(payload.new || {}) } as any;
            // Keep canonical vet_user_id if UPDATE payload omits it (legacy rows /
            // partial updates), so finalize logic stays accurate.
            if (!next.vet_user_id && prev?.vet_user_id) next.vet_user_id = prev.vet_user_id;
            return next;
          });
          const mergedNew = payload.new as Record<string, unknown> | null;
          const hadDeadlineInPayload =
            mergedNew &&
            typeof mergedNew === "object" &&
            Object.prototype.hasOwnProperty.call(mergedNew, "leave_deadline_at");
          const clearedDeadline =
            hadDeadlineInPayload &&
            (mergedNew!.leave_deadline_at == null || mergedNew!.leave_deadline_at === "");
          if (clearedDeadline) {
            resetGraceUiWhenNoLeaveDeadline();
          }
          const nextStatus = String((payload.new as any)?.status || "");
          if ((nextStatus === "completed" || nextStatus === "cancelled") && !hasHandledTerminalStatusRef.current) {
            hasHandledTerminalStatusRef.current = true;
            if (nextStatus === "completed") {
              toast.success("Your consultation successfully completed.");
            } else {
              toast.info("Consultation cancelled.");
            }
            navigate(consultationsPath);
          }
        }
      )
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [bookingId, consultationsPath, navigate, resetGraceUiWhenNoLeaveDeadline]);

  useEffect(() => {
    const activeNoGrace =
      booking?.status === "in_progress" && !booking?.leave_deadline_at;
    if (!activeNoGrace) return;
    resetGraceUiWhenNoLeaveDeadline();
  }, [booking?.leave_deadline_at, booking?.status, resetGraceUiWhenNoLeaveDeadline]);

  useEffect(() => {
    const deadlineFromDb = booking?.leave_deadline_at
      ? new Date(booking.leave_deadline_at)
      : null;
    const effectiveDeadline = deadlineFromDb ?? localLeaveDeadlineRef.current;
    const leftUserId = booking?.left_user_id ?? lastLeftParticipantIdRef.current;
    if (!effectiveDeadline || !leftUserId) {
      clearLeaveGraceTimer();
      return;
    }
    const updateRemaining = () => {
      const ms = effectiveDeadline.getTime() - Date.now();
      const sec = Math.max(0, Math.ceil(ms / 1000));
      setLeaveGraceSeconds(sec);
      if (sec === 0 && !hasFinalizedRef.current && !finalizeInFlightRef.current) {
        void finalizeConsultation("grace_timeout");
      }
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [booking?.leave_deadline_at, booking?.left_user_id, clearLeaveGraceTimer, finalizeConsultation]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !bookingId) return;
    if (isTerminalBookingStatus(booking?.status)) {
      toast.error("This consultation is closed. Messaging is disabled.");
      return;
    }
    const msg = newMessage.trim();
    const optimisticId = `local-${Date.now()}`;
    const optimisticRow = {
      id: optimisticId,
      booking_id: bookingId,
      sender_id: user.id,
      sender_name: user.name,
      message: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => {
      const next = [...prev, optimisticRow];
      messagesSignatureRef.current = getMessagesSignature(next);
      return next;
    });
    setNewMessage("");
    const { data, error } = await api.from("consultation_messages").insert({
      booking_id: bookingId,
      sender_id: user.id,
      sender_name: user.name,
      message: msg,
    });
    if (error) {
      setMessages((prev) => prev.filter((row) => row.id !== optimisticId));
      toast.error(error.message || "Failed to send message");
      return;
    }
    if (data && typeof data === "object") {
      setMessages((prev) => {
        const next = prev.map((row) => (row.id === optimisticId ? { ...row, ...(data as Record<string, unknown>) } : row));
        messagesSignatureRef.current = getMessagesSignature(next);
        return next;
      });
    }
  };

  if (roomError && !booking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <p className="text-sm text-muted-foreground">{roomError}</p>
        <Button variant="outline" onClick={() => navigate(consultationsPath)}>
          Back to Consultations
        </Button>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="h-8 w-8 animate-spin" style={{ color: MB }} />
      </div>
    );
  }

  const method = String(booking.consultation_method || "").toLowerCase();
  const isChat = method !== "video" && method !== "audio";
  const canPrescribe = user?.primaryRole === "vet" || user?.primaryRole === "admin";
  const canEndAsComplete =
    user?.primaryRole === "vet" ||
    user?.primaryRole === "admin" ||
    booking?.vet_user_id === user?.id ||
    booking?.vet_mock_id === user?.id;
  const roomEnded = isTerminalBookingStatus(booking?.status);
  const showConnecting =
    !roomEnded &&
    !canJoinRoom &&
    (bookingLoading || normalizedConsultMethod !== "chat");

  return (
    <div className="space-y-4 h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={leaveRoomAndGoBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: MB }}>
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground text-sm">{booking.vet_name}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge className="text-xs" style={{ backgroundColor: `${MB}18`, color: MB }}>
                {method || "chat"}
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatTime(elapsed)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canPrescribe && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/vet/prescriptions/create?consultationId=${bookingId}`)}>
              <FileText className="h-4 w-4 mr-1" />Prescribe
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={endConsultation} disabled={roomEnded}>
            <PhoneOff className="h-4 w-4 mr-1" />
            {canEndAsComplete ? "End" : "Cancel"}
          </Button>
        </div>
      </div>

      {leaveGraceSeconds !== null && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: `${MB}55`, backgroundColor: `${MB}12`, color: MB }}>
          Rejoin within <span className="font-bold">{leaveGraceSeconds}</span>s or this consultation will end automatically.
        </div>
      )}

      {showConnecting && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: `${MB}55`, backgroundColor: `${MB}12`, color: MB }}>
          Reconnecting to active consultation...
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "calc(100vh - 280px)" }}>
        {/* Video / Audio Area — ZegoCloud */}
        {!isChat && (
          <div className="lg:col-span-2">
            <Card className="shadow-card overflow-hidden h-full">
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-0 h-full" style={{ minHeight: 480 }}>
                <div ref={zegoContainerRef} className="w-full h-full" style={{ minHeight: 480 }} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chat Panel */}
        <div className={isChat ? "lg:col-span-3" : ""}>
          <Card className="shadow-card overflow-hidden h-full flex flex-col">
            <div className="h-1" style={{ backgroundColor: MB }} />
            <div className="p-3 border-b border-border flex items-center gap-2">
              <MessageSquare className="h-4 w-4" style={{ color: MB }} />
              <span className="font-display font-bold text-sm text-foreground">Chat</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: isChat ? 400 : 300 }}>
              <div className="text-center py-2">
                <Badge style={{ backgroundColor: `${MB}15`, color: MB }} className="text-xs">
                  Consultation started — {booking.animal_type} • {booking.symptoms?.slice(0, 50)}
                </Badge>
              </div>

              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        isMe ? "rounded-br-sm text-white" : "rounded-bl-sm bg-accent"
                      }`}
                      style={isMe ? { backgroundColor: MB } : undefined}
                    >
                      {!isMe && (
                        <p className="text-xs font-bold mb-0.5" style={{ color: MB }}>
                          {msg.sender_name}
                        </p>
                      )}
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  id="consultationMessageInput"
                  name="consultationMessageInput"
                  aria-label="Consultation message"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1"
                  disabled={roomEnded}
                />
                <Button
                  size="icon"
                  className="shrink-0 text-white"
                  style={{ backgroundColor: MB }}
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || roomEnded}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Consultation Details sidebar card (chat mode) */}
      {isChat && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: MB }} />
          <CardContent className="p-4">
            <h3 className="font-display font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: MB }} />
              Consultation Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Animal</p><p className="font-medium capitalize text-foreground">{booking.animal_type}</p></div>
              <div><p className="text-xs text-muted-foreground">Age</p><p className="font-medium text-foreground">{booking.animal_age || "N/A"}</p></div>
              <div><p className="text-xs text-muted-foreground">Method</p><p className="font-medium capitalize text-foreground">{booking.consultation_method}</p></div>
              <div><p className="text-xs text-muted-foreground">Fee</p><p className="font-bold" style={{ color: MB }}>৳{booking.fee}</p></div>
            </div>
            {booking.symptoms && (
              <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: `${MB}08` }}>
                <p className="text-xs text-muted-foreground mb-1">Symptoms</p>
                <p className="text-sm text-foreground">{booking.symptoms}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
