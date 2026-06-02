import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vet } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { vetbondhuApi, API_BASE, broadcastVetbondhuVetInboxNewBooking, readSession } from "@/api/client";
import { toast } from "sonner";
import {
  DEFAULT_BOOKABLE_ANIMAL_TYPES,
  getAnimalTypeLabel,
  normalizeAnimalTypes,
  normalizeAnimalType,
} from "@/lib/animalTypes";
import {
  ArrowLeft, ArrowRight, Video, Phone, MessageSquare,
  Calendar, Zap, Check, Stethoscope, CreditCard, Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { subscribeConsultationBookings } from "@/lib/vetbondhuConsultationRealtime";
import { ICON_COLORS } from "@/lib/iconColors";

const VB = ICON_COLORS.vetbondhu;
const OFFLINE_MESSAGE = "Doctor is offline and unavailable right now.";

const STEPS = [
  { label: "Type & Time", icon: Calendar },
  { label: "Animal Details", icon: Stethoscope },
  { label: "Payment", icon: CreditCard },
  { label: "Confirmed", icon: Check },
];

const METHODS = [
  { id: "video", label: "Video Call", icon: Video, desc: "Face-to-face consultation" },
  { id: "audio", label: "Audio Call", icon: Phone, desc: "Voice consultation" },
  { id: "chat", label: "Chat", icon: MessageSquare, desc: "Text-based consultation" },
];

const TIME_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
];

function dbToVet(row: any): Vet {
  return {
    id: row.id,
    name: row.name || "Vet Doctor",
    specialization: row.specialization || "General Veterinary",
    animalTypes: normalizeAnimalTypes(row.animal_types),
    rating: Number(row.rating || 0),
    experience: Number(row.experience || 0),
    fee: Number(row.fee ?? row.consultation_fee ?? 500),
    location: row.location || "Bangladesh",
    available: row.available ?? true,
    is_online: Boolean(row.is_online ?? row.available ?? false),
    status_label: String(row.status_label || (row.is_online ? "Online" : "Offline")),
    last_seen_at: row.last_seen_at || null,
    avatar: row.avatar || "",
    degree: row.degree || "DVM",
  };
}

function vetIsOnline(vet: Vet | null) {
  return vet ? (vet.is_online ?? vet.available) : false;
}

export default function BookConsultation() {
  const { vetId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vet, setVet] = useState<Vet | null>(null);

  const [step, setStep] = useState(0);
  const [bookingType, setBookingType] = useState<"instant" | "scheduled">("instant");
  const [method, setMethod] = useState("video");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [animalType, setAnimalType] = useState("");
  const [animalAge, setAnimalAge] = useState("");
  const [animalGender, setAnimalGender] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [waitingRoomCountdown, setWaitingRoomCountdown] = useState(5);
  const [availableSlots, setAvailableSlots] = useState<string[]>(TIME_SLOTS);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const autoWaitingRoomNavigatedRef = useRef(false);

  const { data: vetData, isLoading: loading } = useQuery({
    queryKey: queryKeys().vetById(vetId),
    enabled: Boolean(vetId),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await vetbondhuApi.from("vets").select("*").eq("id", vetId).single();
      return data ? dbToVet(data) : null;
    },
  });

  useEffect(() => {
    setVet(vetData || null);
  }, [vetData]);

  const { data: slotData } = useQuery({
    queryKey: queryKeys().vetSlots(vetId, selectedDate),
    enabled: Boolean(vetId && bookingType === "scheduled" && selectedDate),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    queryFn: async () => {
      setLoadingSlots(true);
      try {
        const token = readSession()?.access_token;
        const res = await fetch(`${API_BASE}/v1/vetbondhu/vets/${vetId}/available-slots?date=${selectedDate}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body?.error || "Could not load doctor availability for this date");
          return [];
        }
        return Array.isArray(body?.data) ? body.data.map(String) : [];
      } catch {
        toast.error("Could not load doctor availability for this date");
        return [];
      } finally {
        setLoadingSlots(false);
      }
    },
  });

  useEffect(() => {
    if (bookingType !== "scheduled" || !selectedDate) {
      setAvailableSlots(TIME_SLOTS);
      return;
    }
    setAvailableSlots(slotData || []);
  }, [bookingType, selectedDate, slotData]);

  useEffect(() => {
    if (selectedTime && !availableSlots.includes(selectedTime)) {
      setSelectedTime("");
    }
  }, [availableSlots, selectedTime]);

  useEffect(() => {
    if (!bookingId || !user?.id) return;
    const unsubscribe = subscribeConsultationBookings({
      channelKey: `book-consultation-live-${bookingId}`,
      userId: user.id,
      onEvent: (_eventType, row) => {
        if (row.id !== bookingId) return;
        if (row.status === "in_progress") {
          toast.success("Vet joined. Moving you to consultation room...");
          navigate(`/vetbondhu/room/${bookingId}`);
        }
      },
    });
    return unsubscribe;
  }, [bookingId, navigate, user?.id]);

  useEffect(() => {
    if (step !== 3 || bookingType !== "instant" || !bookingId) return;
    autoWaitingRoomNavigatedRef.current = false;
    setWaitingRoomCountdown(5);
    const intervalId = window.setInterval(() => {
      setWaitingRoomCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    const timeoutId = window.setTimeout(() => {
      if (autoWaitingRoomNavigatedRef.current) return;
      autoWaitingRoomNavigatedRef.current = true;
      navigate(`/vetbondhu/waiting/${bookingId}`);
    }, 5000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [bookingId, bookingType, navigate, step]);

  const goToWaitingRoom = () => {
    if (!bookingId) return;
    autoWaitingRoomNavigatedRef.current = true;
    navigate(`/vetbondhu/waiting/${bookingId}`);
  };

  const animalOptions = vet?.animalTypes?.length ? vet.animalTypes : [...DEFAULT_BOOKABLE_ANIMAL_TYPES];

  useEffect(() => {
    if (animalType && !animalOptions.includes(animalType)) {
      setAnimalType("");
    }
  }, [animalType, animalOptions]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!vet) return <div className="text-center py-12 text-muted-foreground">Vet not found</div>;
  const isOnline = vetIsOnline(vet);

  const canNext = () => {
    if (step === 0) {
      if (bookingType === "instant" && !isOnline) return false;
      if (bookingType === "scheduled") return !!selectedDate && !!selectedTime && !!method;
      return !!method;
    }
    if (step === 1) return !!animalType;
    return true;
  };

  const handleConfirm = async () => {
    if (!user) return;
    if (bookingType === "instant" && !isOnline) {
      toast.error(OFFLINE_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      const { data: vetIdentity } = await vetbondhuApi
        .from("vets")
        .select("id,user_id")
        .eq("id", vet.id)
        .maybeSingle();
      const { data, error } = await vetbondhuApi.from("consultation_bookings").insert({
        vet_mock_id: vet.id, vet_name: vet.name, patient_mock_id: user.id, patient_name: user.name,
        vet_user_id: vetIdentity?.user_id || null,
        booking_type: bookingType, consultation_method: method,
        scheduled_date: bookingType === "scheduled" ? selectedDate : new Date().toISOString().split("T")[0],
        scheduled_time: bookingType === "scheduled" ? selectedTime : "Now",
        animal_type: animalType, animal_age: animalAge, animal_gender: animalGender, symptoms: symptoms.trim() || null, additional_notes: notes,
        status: "pending", payment_status: "paid", payment_amount: vet.fee, fee: vet.fee,
      }).select().single();
      if (error) throw error;
      const newId = (data as { id?: string } | null)?.id;
      if (vetIdentity?.user_id && newId) broadcastVetbondhuVetInboxNewBooking(vetIdentity.user_id, newId);
      setBookingId(data.id);
      setStep(3);
      toast.success("Booking confirmed!");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error && err.message ? err.message : "Failed to create booking";
      toast.error(message.includes("offline") ? OFFLINE_MESSAGE : message);
    }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />{step > 0 ? "Previous Step" : "Back"}</Button>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ backgroundColor: VB }} />
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-xl shrink-0" style={{ backgroundColor: VB }}>🩺</div>
          <div className="flex-1 min-w-0"><h3 className="font-display font-bold text-foreground truncate">{vet.name}</h3><p className="text-sm" style={{ color: VB }}>{vet.specialization}</p></div>
          <div className="flex items-center gap-2">
            <Badge style={{ backgroundColor: isOnline ? `${VB}18` : "hsl(var(--muted))", color: isOnline ? VB : "hsl(var(--muted-foreground))" }}>
              {isOnline ? "Online" : "Offline"}
            </Badge>
            <Badge style={{ backgroundColor: `${VB}18`, color: VB }}>৳{vet.fee}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1 flex items-center gap-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${i > step ? "bg-muted text-muted-foreground" : ""}`} style={i <= step ? { backgroundColor: VB, color: "white" } : undefined}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${i >= step ? "bg-muted" : ""}`} style={i < step ? { backgroundColor: VB } : undefined} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: VB }} />
              <CardContent className="p-5 space-y-5">
                <h2 className="font-display font-bold text-lg text-foreground">Consultation Type & Time</h2>
                {!isOnline && (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {OFFLINE_MESSAGE}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {([{ id: "instant" as const, label: "Instant", icon: Zap, desc: "Connect now" }, { id: "scheduled" as const, label: "Schedule", icon: Calendar, desc: "Book for later" }]).map((t) => (
                    <button key={t.id} onClick={() => setBookingType(t.id)} disabled={t.id === "instant" && !isOnline} className="p-4 rounded-xl border-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60" style={bookingType === t.id ? { borderColor: VB, backgroundColor: `${VB}08` } : { borderColor: "hsl(var(--border))" }}>
                      <t.icon className="h-5 w-5 mb-2" style={{ color: bookingType === t.id ? VB : undefined }} /><p className="font-bold text-sm text-foreground">{t.label}</p><p className="text-xs text-muted-foreground">{t.desc}</p>
                    </button>
                  ))}
                </div>
                {bookingType === "scheduled" && (
                  <div className="space-y-3">
                    <div><label htmlFor="consultDate" className="text-sm font-medium text-foreground mb-1 block">Date</label><Input id="consultDate" name="consultDate" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
                    <div><label className="text-sm font-medium text-foreground mb-1 block">Time Slot</label>
                      {loadingSlots ? (
                        <p className="text-xs text-muted-foreground">Loading available slots...</p>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No available slots for this date. Please pick another date.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">{availableSlots.map((t) => (<button key={t} onClick={() => setSelectedTime(t)} className="p-2 rounded-lg border text-xs font-medium transition-all" style={selectedTime === t ? { borderColor: VB, backgroundColor: `${VB}10`, color: VB } : { borderColor: "hsl(var(--border))" }}>{t}</button>))}</div>
                      )}
                    </div>
                  </div>
                )}
                <div><label className="text-sm font-medium text-foreground mb-2 block">Consultation Method</label>
                  <div className="grid grid-cols-3 gap-3">{METHODS.map((m) => (<button key={m.id} onClick={() => setMethod(m.id)} className="p-3 rounded-xl border-2 text-center transition-all" style={method === m.id ? { borderColor: VB, backgroundColor: `${VB}08` } : { borderColor: "hsl(var(--border))" }}><m.icon className="h-5 w-5 mx-auto mb-1" style={{ color: method === m.id ? VB : undefined }} /><p className="text-xs font-bold text-foreground">{m.label}</p></button>))}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: VB }} />
              <CardContent className="p-5 space-y-4">
                <h2 className="font-display font-bold text-lg text-foreground">Animal Details</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium text-foreground mb-1 block">Animal Type *</label><Select value={animalType} onValueChange={(value) => setAnimalType(normalizeAnimalType(value) || value)}><SelectTrigger aria-label="Animal Type"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{animalOptions.map((a) => <SelectItem key={a} value={a} className="capitalize">{getAnimalTypeLabel(a)}</SelectItem>)}</SelectContent></Select></div>
                  <div><label htmlFor="animalAge" className="text-sm font-medium text-foreground mb-1 block">Age</label><Input id="animalAge" name="animalAge" placeholder="e.g. 2 years" value={animalAge} onChange={(e) => setAnimalAge(e.target.value)} /></div>
                </div>
                <div><label className="text-sm font-medium text-foreground mb-1 block">Gender</label><Select value={animalGender} onValueChange={setAnimalGender}><SelectTrigger aria-label="Animal Gender"><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent></Select></div>
                <div><label htmlFor="animalSymptoms" className="text-sm font-medium text-foreground mb-1 block">Symptoms / Problem <span className="text-muted-foreground">(optional)</span></label><Textarea id="animalSymptoms" name="animalSymptoms" placeholder="Optional: describe the symptoms or problem if you want..." value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={4} /></div>
                <div><label htmlFor="animalNotes" className="text-sm font-medium text-foreground mb-1 block">Additional Notes</label><Textarea id="animalNotes" name="animalNotes" placeholder="Medical history..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: VB }} />
              <CardContent className="p-5 space-y-4">
                <h2 className="font-display font-bold text-lg text-foreground">Payment Summary</h2>
                <div className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: `${VB}08` }}>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Doctor</span><span className="font-medium text-foreground">{vet.name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><span className="font-medium text-foreground capitalize">{bookingType}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Method</span><span className="font-medium text-foreground capitalize">{method}</span></div>
                  {bookingType === "scheduled" && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Schedule</span><span className="font-medium text-foreground">{selectedDate} at {selectedTime}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Animal</span><span className="font-medium text-foreground capitalize">{getAnimalTypeLabel(animalType) || animalType}</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between text-base font-bold"><span className="text-foreground">Consultation Fee</span><span style={{ color: VB }}>৳{vet.fee}</span></div>
                </div>
                <Button className="w-full h-12 text-white font-bold" style={{ backgroundColor: bookingType === "instant" && !isOnline ? "hsl(var(--muted-foreground))" : VB }} onClick={handleConfirm} disabled={submitting || (bookingType === "instant" && !isOnline)}>{submitting ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}{bookingType === "instant" && !isOnline ? "Doctor unavailable" : `Pay ৳${vet.fee} & Confirm`}</Button>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: VB }} />
              <CardContent className="p-6 text-center space-y-4">
                <div className="h-20 w-20 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${VB}15` }}><Check className="h-10 w-10" style={{ color: VB }} /></div>
                <h2 className="font-display font-bold text-xl text-foreground">Booking Confirmed!</h2>
                <p className="text-muted-foreground">Your consultation with <strong>{vet.name}</strong> has been confirmed.</p>
                <div className="flex gap-3 pt-2">
                  {bookingType === "instant" && bookingId && <Button className="flex-1 text-white" style={{ backgroundColor: VB }} onClick={goToWaitingRoom}>Go to Waiting Room ({waitingRoomCountdown})</Button>}
                  <Button variant="outline" className="flex-1" style={{ borderColor: `${VB}50`, color: VB }} onClick={() => navigate("/vetbondhu/consultations")}>My Consultations</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {step < 2 && (
        <Button className="w-full text-white" style={{ backgroundColor: VB }} disabled={!canNext()} onClick={() => setStep(step + 1)}><ArrowRight className="h-4 w-4 mr-2" />Next Step</Button>
      )}
    </div>
  );
}
