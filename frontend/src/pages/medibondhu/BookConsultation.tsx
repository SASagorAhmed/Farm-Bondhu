import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vet } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { api, API_BASE, readSession } from "@/api/client";
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

const MB = "#12C2D6";

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
    avatar: row.avatar || "",
    degree: row.degree || "DVM",
  };
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
  const [availableSlots, setAvailableSlots] = useState<string[]>(TIME_SLOTS);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const { data: vetData, isLoading: loading } = useQuery({
    queryKey: queryKeys().vetById(vetId),
    enabled: Boolean(vetId),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    queryFn: async () => {
      const { data } = await api.from("vets").select("*").eq("id", vetId).single();
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
        const res = await fetch(`${API_BASE}/v1/medibondhu/vets/${vetId}/available-slots?date=${selectedDate}`, {
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

  const animalOptions = vet?.animalTypes?.length ? vet.animalTypes : [...DEFAULT_BOOKABLE_ANIMAL_TYPES];

  useEffect(() => {
    if (animalType && !animalOptions.includes(animalType)) {
      setAnimalType("");
    }
  }, [animalType, animalOptions]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!vet) return <div className="text-center py-12 text-muted-foreground">Vet not found</div>;

  const canNext = () => {
    if (step === 0) { if (bookingType === "scheduled") return !!selectedDate && !!selectedTime && !!method; return !!method; }
    if (step === 1) return !!animalType && !!symptoms.trim();
    return true;
  };

  const handleConfirm = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await api.from("consultation_bookings").insert({
        vet_mock_id: vet.id, vet_name: vet.name, patient_mock_id: user.id, patient_name: user.name,
        booking_type: bookingType, consultation_method: method,
        scheduled_date: bookingType === "scheduled" ? selectedDate : new Date().toISOString().split("T")[0],
        scheduled_time: bookingType === "scheduled" ? selectedTime : "Now",
        animal_type: animalType, animal_age: animalAge, animal_gender: animalGender, symptoms, additional_notes: notes,
        status: "confirmed", payment_status: "paid", payment_amount: vet.fee, fee: vet.fee,
      }).select().single();
      if (error) throw error;
      setBookingId(data.id);
      setStep(3);
      toast.success("Booking confirmed!");
    } catch (err) { console.error(err); toast.error("Failed to create booking"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />{step > 0 ? "Previous Step" : "Back"}</Button>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ backgroundColor: MB }} />
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-xl shrink-0" style={{ backgroundColor: MB }}>🩺</div>
          <div className="flex-1 min-w-0"><h3 className="font-display font-bold text-foreground truncate">{vet.name}</h3><p className="text-sm" style={{ color: MB }}>{vet.specialization}</p></div>
          <Badge style={{ backgroundColor: `${MB}18`, color: MB }}>৳{vet.fee}</Badge>
        </CardContent>
      </Card>

      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1 flex items-center gap-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${i > step ? "bg-muted text-muted-foreground" : ""}`} style={i <= step ? { backgroundColor: MB, color: "white" } : undefined}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${i >= step ? "bg-muted" : ""}`} style={i < step ? { backgroundColor: MB } : undefined} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-5 space-y-5">
                <h2 className="font-display font-bold text-lg text-foreground">Consultation Type & Time</h2>
                <div className="grid grid-cols-2 gap-3">
                  {([{ id: "instant" as const, label: "Instant", icon: Zap, desc: "Connect now" }, { id: "scheduled" as const, label: "Schedule", icon: Calendar, desc: "Book for later" }]).map((t) => (
                    <button key={t.id} onClick={() => setBookingType(t.id)} className="p-4 rounded-xl border-2 text-left transition-all" style={bookingType === t.id ? { borderColor: MB, backgroundColor: `${MB}08` } : { borderColor: "hsl(var(--border))" }}>
                      <t.icon className="h-5 w-5 mb-2" style={{ color: bookingType === t.id ? MB : undefined }} /><p className="font-bold text-sm text-foreground">{t.label}</p><p className="text-xs text-muted-foreground">{t.desc}</p>
                    </button>
                  ))}
                </div>
                {bookingType === "scheduled" && (
                  <div className="space-y-3">
                    <div><label className="text-sm font-medium text-foreground mb-1 block">Date</label><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
                    <div><label className="text-sm font-medium text-foreground mb-1 block">Time Slot</label>
                      {loadingSlots ? (
                        <p className="text-xs text-muted-foreground">Loading available slots...</p>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No available slots for this date. Please pick another date.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">{availableSlots.map((t) => (<button key={t} onClick={() => setSelectedTime(t)} className="p-2 rounded-lg border text-xs font-medium transition-all" style={selectedTime === t ? { borderColor: MB, backgroundColor: `${MB}10`, color: MB } : { borderColor: "hsl(var(--border))" }}>{t}</button>))}</div>
                      )}
                    </div>
                  </div>
                )}
                <div><label className="text-sm font-medium text-foreground mb-2 block">Consultation Method</label>
                  <div className="grid grid-cols-3 gap-3">{METHODS.map((m) => (<button key={m.id} onClick={() => setMethod(m.id)} className="p-3 rounded-xl border-2 text-center transition-all" style={method === m.id ? { borderColor: MB, backgroundColor: `${MB}08` } : { borderColor: "hsl(var(--border))" }}><m.icon className="h-5 w-5 mx-auto mb-1" style={{ color: method === m.id ? MB : undefined }} /><p className="text-xs font-bold text-foreground">{m.label}</p></button>))}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-5 space-y-4">
                <h2 className="font-display font-bold text-lg text-foreground">Animal & Symptoms</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium text-foreground mb-1 block">Animal Type *</label><Select value={animalType} onValueChange={(value) => setAnimalType(normalizeAnimalType(value) || value)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{animalOptions.map((a) => <SelectItem key={a} value={a} className="capitalize">{getAnimalTypeLabel(a)}</SelectItem>)}</SelectContent></Select></div>
                  <div><label className="text-sm font-medium text-foreground mb-1 block">Age</label><Input placeholder="e.g. 2 years" value={animalAge} onChange={(e) => setAnimalAge(e.target.value)} /></div>
                </div>
                <div><label className="text-sm font-medium text-foreground mb-1 block">Gender</label><Select value={animalGender} onValueChange={setAnimalGender}><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent></Select></div>
                <div><label className="text-sm font-medium text-foreground mb-1 block">Symptoms / Problem *</label><Textarea placeholder="Describe the symptoms..." value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={4} /></div>
                <div><label className="text-sm font-medium text-foreground mb-1 block">Additional Notes</label><Textarea placeholder="Medical history..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-5 space-y-4">
                <h2 className="font-display font-bold text-lg text-foreground">Payment Summary</h2>
                <div className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: `${MB}08` }}>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Doctor</span><span className="font-medium text-foreground">{vet.name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><span className="font-medium text-foreground capitalize">{bookingType}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Method</span><span className="font-medium text-foreground capitalize">{method}</span></div>
                  {bookingType === "scheduled" && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Schedule</span><span className="font-medium text-foreground">{selectedDate} at {selectedTime}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Animal</span><span className="font-medium text-foreground capitalize">{getAnimalTypeLabel(animalType) || animalType}</span></div>
                  <hr className="border-border" />
                  <div className="flex justify-between text-base font-bold"><span className="text-foreground">Consultation Fee</span><span style={{ color: MB }}>৳{vet.fee}</span></div>
                </div>
                <Button className="w-full h-12 text-white font-bold" style={{ backgroundColor: MB }} onClick={handleConfirm} disabled={submitting}>{submitting ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}Pay ৳{vet.fee} & Confirm</Button>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-6 text-center space-y-4">
                <div className="h-20 w-20 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${MB}15` }}><Check className="h-10 w-10" style={{ color: MB }} /></div>
                <h2 className="font-display font-bold text-xl text-foreground">Booking Confirmed!</h2>
                <p className="text-muted-foreground">Your consultation with <strong>{vet.name}</strong> has been confirmed.</p>
                <div className="flex gap-3 pt-2">
                  {bookingType === "instant" && bookingId && <Button className="flex-1 text-white" style={{ backgroundColor: MB }} onClick={() => navigate(`/medibondhu/waiting/${bookingId}`)}>Go to Waiting Room</Button>}
                  <Button variant="outline" className="flex-1" style={{ borderColor: `${MB}50`, color: MB }} onClick={() => navigate("/medibondhu/consultations")}>My Consultations</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {step < 2 && (
        <Button className="w-full text-white" style={{ backgroundColor: MB }} disabled={!canNext()} onClick={() => setStep(step + 1)}><ArrowRight className="h-4 w-4 mr-2" />Next Step</Button>
      )}
    </div>
  );
}
