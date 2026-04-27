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

const MB = "#12C2D6";
const TERMINAL_BOOKING_STATUSES = new Set(["completed", "cancelled"]);

const isTerminalBookingStatus = (status?: string | null) =>
  !!status && TERMINAL_BOOKING_STATUSES.has(status);

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

export default function ConsultationRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const consultationsPath = location.pathname.startsWith("/vet/")
    ? "/vet/consultations"
    : "/medibondhu/consultations";
  const isRejoinIntent =
    (location.state as { from?: string; bookingId?: string } | null)?.from === "rejoin";
  const queryClient = useQueryClient();
  const [booking, setBooking] = useState<any>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [leaveGraceSeconds, setLeaveGraceSeconds] = useState<number | null>(null);

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
  /** True only when user explicitly clicked End/Cancel in this screen. */
  const explicitEndRequestedRef = useRef(false);
  const lastLeftParticipantIdRef = useRef<string | null>(null);
  const localLeaveDeadlineRef = useRef<Date | null>(null);
  const zegoInitInFlightRef = useRef(false);
  const zegoRoomKeyRef = useRef<string | null>(null);
  const bookingRef = useRef<any>(null);
  const isUnmountingRef = useRef(false);
  const markLeaveGraceInDbRef = useRef<(() => Promise<void>) | null>(null);
  const clearLeaveGraceTimerRef = useRef<(() => void) | null>(null);
  const clearLeaveGraceInDbRef = useRef<(() => Promise<void>) | null>(null);
  const finalizeConsultationRef = useRef<((source: "button" | "sdk_leave") => Promise<void>) | null>(null);

  useEffect(() => {
    bookingRef.current = booking;
  }, [booking]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  const normalizedConsultMethod = useMemo(
    () => String(booking?.consultation_method ?? "").toLowerCase(),
    [booking?.consultation_method]
  );

  const { data: bookingData, isLoading: bookingLoading } = useQuery({
    queryKey: queryKeys().consultationRoom(bookingId),
    enabled: Boolean(bookingId),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    queryFn: async () => {
      const { data, error } = await api
        .from("consultation_bookings")
        .select("*")
        .eq("id", bookingId)
        .single();
      if (error) {
        setRoomError(error.message || "Failed to load consultation details.");
        return null;
      }
      if (!data) {
        setRoomError("Consultation not found or you do not have access.");
        return null;
      }
      setRoomError(null);
      return data;
    },
  });
  useEffect(() => {
    if (!bookingData) return;
    bookingStatusRef.current = bookingData.status ?? null;
    setBooking((prev: any) => {
      if (prev && prev.id === bookingData.id && prev.status === bookingData.status) return prev;
      return bookingData;
    });
  }, [bookingData]);

  useEffect(() => {
    if (!booking || hasHandledTerminalStatusRef.current) return;
    if (booking.status === "cancelled" || booking.status === "completed") {
      hasHandledTerminalStatusRef.current = true;
      toast.info(
        booking.status === "cancelled"
          ? "Consultation is cancelled. Returning to consultations."
          : "Consultation already completed. Returning to consultations."
      );
      navigate(consultationsPath);
      return;
    }
    if (isRejoinIntent && booking.status !== "in_progress") {
      toast.info("This consultation is not active right now.");
      navigate(consultationsPath);
    }
  }, [booking, consultationsPath, isRejoinIntent, navigate]);

  const { data: initialMessages } = useQuery({
    queryKey: ["consultation-room-messages", bookingId || "unknown"],
    enabled: Boolean(bookingId),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    queryFn: async () => {
      const { data } = await api
        .from("consultation_messages")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });
  useEffect(() => {
    if (!initialMessages) return;
    messagesSignatureRef.current = getMessagesSignature(initialMessages);
    setMessages(initialMessages);
  }, [initialMessages]);

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

  // Polling fallback for messages and booking status
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    const pollFallback = async () => {
      try {
        const [messagesRes, bookingRes] = await Promise.all([
          api
            .from("consultation_messages")
            .select("*")
            .eq("booking_id", bookingId)
            .order("created_at", { ascending: true }),
          api
            .from("consultation_bookings")
            .select("*")
            .eq("id", bookingId)
            .single(),
        ]);

        if (cancelled) return;

        if (messagesRes.data) {
          const nextSignature = getMessagesSignature(messagesRes.data);
          if (nextSignature !== messagesSignatureRef.current) {
            messagesSignatureRef.current = nextSignature;
            setMessages(messagesRes.data);
          }
        }

        if (bookingRes.data) {
          const nextStatus = bookingRes.data.status ?? null;
          const prevStatus = bookingStatusRef.current;
          const statusChanged = nextStatus !== prevStatus;

          if (statusChanged) {
            bookingStatusRef.current = nextStatus;
          }

          setBooking((prev: any) => {
            if (!prev) return bookingRes.data;
            if (prev.id === bookingRes.data.id && prev.status === bookingRes.data.status) {
              return prev;
            }
            return bookingRes.data;
          });

          const becameTerminal =
            !hasHandledTerminalStatusRef.current &&
            isTerminalBookingStatus(nextStatus);

          if (becameTerminal) {
            hasHandledTerminalStatusRef.current = true;
            toast.info(
              nextStatus === "cancelled"
                ? "Consultation was cancelled. Returning to consultations."
                : "Consultation is completed. Returning to consultations."
            );
            navigate(consultationsPath);
          }
        }
      } catch (error) {
        console.error("Consultation polling fallback failed:", error);
        setRoomError("Connection issue while syncing consultation status. Retrying...");
      }
    };

    // Run immediate + periodic fallback sync for room and shared leave timer consistency.
    pollFallback();
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void pollFallback();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bookingId, consultationsPath, navigate]);

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

  const finalizeConsultation = useCallback(async (source: "button" | "sdk_leave") => {
    const isManualAction = source === "button";
    if (!bookingId) {
      if (isManualAction) toast.error("Missing consultation id. Please refresh and retry.");
      return;
    }
    if (!user) {
      if (isManualAction) toast.error("Session expired. Please sign in again.");
      return;
    }
    if (finalizeInFlightRef.current) {
      if (isManualAction) toast.info("Finishing consultation...");
      return;
    }
    if (hasFinalizedRef.current) {
      if (isManualAction) toast.info("Consultation is already completed.");
      navigate(consultationsPath);
      return;
    }
    const b = bookingRef.current;
    if (!b) {
      if (isManualAction) toast.error("Consultation is still loading. Please try again.");
      return;
    }
    if (isTerminalBookingStatus(b.status)) {
      hasFinalizedRef.current = true;
      if (isManualAction) toast.info("Consultation already ended.");
      navigate(consultationsPath);
      return;
    }

    finalizeInFlightRef.current = true;
    const isVetOrAdminActor =
      user?.primaryRole === "vet" ||
      user?.primaryRole === "admin" ||
      b?.vet_user_id === user?.id ||
      b?.vet_mock_id === user?.id;
    const nextStatus =
      source === "button" && !isVetOrAdminActor
        ? "cancelled"
        : "completed";
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
      if (isManualAction) {
        toast.success(nextStatus === "cancelled" ? "Consultation cancelled" : "Consultation ended");
      } else {
        toast.info("Call closed. Consultation completed.");
      }
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

  const endConsultation = useCallback(async () => {
    explicitEndRequestedRef.current = true;
    await finalizeConsultation("button");
  }, [finalizeConsultation]);

  const leaveRoomAndGoBack = useCallback(async () => {
    if (!explicitEndRequestedRef.current && !hasFinalizedRef.current) {
      await markLeaveGraceInDb();
    }
    navigate(consultationsPath);
  }, [consultationsPath, markLeaveGraceInDb, navigate]);

  const canJoinRoom = Boolean(
    booking &&
      booking.status === "in_progress" &&
      !isTerminalBookingStatus(booking.status)
  );

  // Initialize ZegoCloud for audio/video (deps are primitives so polling does not destroy the room)
  useEffect(() => {
    if (!bookingId || !user?.id) return;
    if (!normalizedConsultMethod || normalizedConsultMethod === "chat") return;
    if (!canJoinRoom) return;
    const roomKey = `${bookingId}:${user.id}:${normalizedConsultMethod}`;
    if (zegoInitInFlightRef.current || zegoRoomKeyRef.current === roomKey) return;
    zegoInitInFlightRef.current = true;
    zegoRoomKeyRef.current = roomKey;

    let cancelled = false;

    const initZego = async () => {
      try {
        if (zegoInstanceRef.current) {
          try {
            zegoInstanceRef.current.destroy();
          } catch {
            /* ignore stale sdk cleanup */
          }
          zegoInstanceRef.current = null;
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
        if (cancelled) return;

        // Dynamically import ZegoCloud SDK
        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");

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

        if (!zegoContainerRef.current || cancelled) return;

        zp.joinRoom({
          container: zegoContainerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          // Start muted to avoid permission-denied auto-leave loops on some browsers.
          turnOnCameraWhenJoining: false,
          turnOnMicrophoneWhenJoining: false,
          showPreJoinView: false,
          onJoinRoom: () => {
            hasJoinedZegoRoomRef.current = true;
            const current = bookingRef.current;
            const sameUserLeftRecently = lastLeftParticipantIdRef.current === user.id;
            if (
              sameUserLeftRecently ||
              (current?.left_user_id === user.id && current?.leave_deadline_at)
            ) {
              void clearLeaveGraceInDb();
              toast.success("Rejoined in time. Consultation is still active.");
            }
          },
          onLeaveRoom: () => {
            if (skipZegoLeaveHookRef.current) return;
            if (!hasJoinedZegoRoomRef.current) return;
            hasJoinedZegoRoomRef.current = false;
            // SDK already left room; avoid duplicate destroy on unmount race.
            zegoInstanceRef.current = null;
            // Explicit End closes immediately; other leaves get a 20-second rejoin grace window.
            if (explicitEndRequestedRef.current) {
              void finalizeConsultationRef.current?.("sdk_leave");
              return;
            }
            void markLeaveGraceInDbRef.current?.();
            toast.info("You left the room. Rejoin within 20 seconds or consultation will auto-complete.");
          },
        });
      } catch (err: any) {
        console.error("ZegoCloud init error:", err);
        const friendlyMessage = getZegoJoinErrorMessage(err);
        setRoomError(friendlyMessage);
        toast.error(friendlyMessage);
      } finally {
        zegoInitInFlightRef.current = false;
      }
    };

    initZego();

    return () => {
      cancelled = true;
      const hadActiveRoom = hasJoinedZegoRoomRef.current;
      if (isUnmountingRef.current && hadActiveRoom && !explicitEndRequestedRef.current && !hasFinalizedRef.current) {
        void markLeaveGraceInDbRef.current?.();
      }
      clearLeaveGraceTimerRef.current?.();
      hasJoinedZegoRoomRef.current = false;
      zegoRoomKeyRef.current = null;
      zegoInitInFlightRef.current = false;
      if (zegoInstanceRef.current) {
        skipZegoLeaveHookRef.current = true;
        try {
          zegoInstanceRef.current.destroy();
        } catch {
          /* ignore */
        }
        zegoInstanceRef.current = null;
        queueMicrotask(() => {
          skipZegoLeaveHookRef.current = false;
        });
      }
    };
  }, [bookingId, canJoinRoom, normalizedConsultMethod, user?.id, user?.name]);

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
          setBooking((prev: any) => ({ ...(prev || {}), ...(payload.new || {}) }));
        }
      )
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [bookingId]);

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
        void finalizeConsultation("sdk_leave");
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
    (bookingLoading || isRejoinIntent || normalizedConsultMethod !== "chat");

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
