import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { ALL_ANIMAL_TYPES, getAnimalTypeLabel, normalizeAnimalType } from "@/lib/animalTypes";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Stethoscope, FileText, Pill,
  Heart, CalendarCheck, Save, Send, ClipboardList, Loader2,
} from "lucide-react";

const ANIMAL_TYPES = [...ALL_ANIMAL_TYPES];
const SEVERITY_LEVELS = ["mild", "moderate", "severe", "critical"];
const MEDICINE_TYPES = ["antibiotic", "vitamin", "vaccine", "dewormer", "calcium", "tonic", "disinfectant", "pain relief", "supplement", "other"];
const DOSAGE_UNITS = ["ml", "mg", "gram", "tablet", "sachet", "drops", "cc"];
const FREQUENCY_OPTIONS = ["once daily", "twice daily", "three times daily", "every 6 hours", "every 8 hours", "every 12 hours", "weekly", "as needed"];
const TIMING_OPTIONS = ["morning", "afternoon", "evening", "night", "before feed", "after feed", "with water", "mixed with feed"];
const BANGLA_DOSE_PATTERN_OPTIONS = ["১+০+০", "০+১+০", "০+০+১", "১+০+১", "১+১+০", "০+১+১", "১+১+১", "দিনে ১ বার", "দিনে ২ বার", "দিনে ৩ বার", "১ দিন পর পর", "সপ্তাহে ১ বার", "প্রয়োজন হলে"];
const BANGLA_TIMING_OPTIONS = ["সকালে", "দুপুরে", "রাতে", "খাবারের আগে", "খাবারের পরে", "প্রয়োজন হলে"];
const ROUTE_OPTIONS = ["oral", "injection (IM)", "injection (IV)", "injection (SC)", "through water", "through feed", "topical", "nasal", "eye drop", "ear drop"];

const BN_SEVERITY_LABELS: Record<string, string> = {
  mild: "মৃদু",
  moderate: "মাঝারি",
  severe: "তীব্র",
  critical: "জরুরি",
};

const BN_MEDICINE_TYPE_LABELS: Record<string, string> = {
  antibiotic: "অ্যান্টিবায়োটিক",
  vitamin: "ভিটামিন",
  vaccine: "ভ্যাকসিন",
  dewormer: "কৃমিনাশক",
  calcium: "ক্যালসিয়াম",
  tonic: "টনিক",
  disinfectant: "জীবাণুনাশক",
  "pain relief": "ব্যথানাশক",
  supplement: "সাপ্লিমেন্ট",
  other: "অন্যান্য",
};

const BN_DOSAGE_UNIT_LABELS: Record<string, string> = {
  ml: "মিলি",
  mg: "মি.গ্রা",
  gram: "গ্রাম",
  tablet: "ট্যাবলেট",
  sachet: "স্যাশে",
  drops: "ফোঁটা",
  cc: "সিসি",
};

const BN_ROUTE_LABELS: Record<string, string> = {
  oral: "মুখে",
  "injection (IM)": "ইনজেকশন (IM)",
  "injection (IV)": "ইনজেকশন (IV)",
  "injection (SC)": "ইনজেকশন (SC)",
  "through water": "পানির সাথে",
  "through feed": "খাবারের সাথে",
  topical: "বাহ্যিক",
  nasal: "নাকে",
  "eye drop": "চোখে ড্রপ",
  "ear drop": "কানে ড্রপ",
};

const BN_FREQUENCY_LABELS: Record<string, string> = {
  "once daily": "দিনে ১ বার",
  "twice daily": "দিনে ২ বার",
  "three times daily": "দিনে ৩ বার",
  "every 6 hours": "প্রতি ৬ ঘণ্টা",
  "every 8 hours": "প্রতি ৮ ঘণ্টা",
  "every 12 hours": "প্রতি ১২ ঘণ্টা",
  weekly: "সপ্তাহে ১ বার",
  "as needed": "প্রয়োজন হলে",
};

const BN_TIMING_LABELS: Record<string, string> = {
  morning: "সকালে",
  afternoon: "দুপুরে",
  evening: "সন্ধ্যায়",
  night: "রাতে",
  "before feed": "খাবারের আগে",
  "after feed": "খাবারের পরে",
  "with water": "পানির সাথে",
  "mixed with feed": "খাবারের সাথে মিশিয়ে",
};

interface MedicineRow {
  id: string;
  medicine_name: string;
  medicine_type: string;
  dosage: string;
  dosage_unit: string;
  frequency: string;
  dose_pattern: string;
  timing: string;
  route: string;
  duration_days: string;
  purpose: string;
  notes: string;
}

type ConsultationBooking = {
  patient_mock_id?: string | null;
  patient_name?: string | null;
  animal_type?: string | null;
  animal_gender?: string | null;
  animal_age?: string | null;
  symptoms?: string | null;
  consultation_method?: string | null;
  created_at?: string | null;
  fee?: number | string | null;
};

const emptyMedicine = (): MedicineRow => ({
  id: crypto.randomUUID(),
  medicine_name: "",
  medicine_type: "",
  dosage: "",
  dosage_unit: "ml",
  frequency: "once daily",
  dose_pattern: "১+০+১",
  timing: "morning",
  route: "oral",
  duration_days: "",
  purpose: "",
  notes: "",
});

export default function CreatePrescription() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const consultationId = searchParams.get("consultationId");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState<ConsultationBooking | null>(null);
  const [language, setLanguage] = useState<"en" | "bn">("en");
  const isBangla = language === "bn";
  const t = {
    animalType: isBangla ? "প্রাণীর ধরন *" : "Animal Type *",
    select: isBangla ? "নির্বাচন করুন" : "Select",
    selectType: isBangla ? "ধরন নির্বাচন করুন" : "Select type",
    breedPlaceholder: isBangla ? "যেমন: সোনালি, ব্ল্যাক বেঙ্গল" : "e.g. Sonali, Black Bengal",
    agePlaceholder: isBangla ? "যেমন: ২ বছর, ৪৫ দিন" : "e.g. 2 years, 45 days",
    weightPlaceholder: isBangla ? "যেমন: ২৫ কেজি, ১.৫ কেজি" : "e.g. 25 kg, 1.5 kg",
    farmNamePlaceholder: isBangla ? "খামার / শেডের নাম" : "Farm / shed name",
    batchId: isBangla ? "ব্যাচ আইডি" : "Batch ID",
    batchPlaceholder: isBangla ? "ব্যাচ কোড" : "Batch code",
    animalTag: isBangla ? "প্রাণী আইডি / ট্যাগ" : "Animal ID / Tag",
    animalTagPlaceholder: isBangla ? "ট্যাগ / কানের ট্যাগ" : "Tag / ear tag",
    shedPen: isBangla ? "শেড / পেন" : "Shed / Pen",
    shedPenPlaceholder: isBangla ? "শেড A, পেন ৩" : "Shed A, Pen 3",
    affectedCount: isBangla ? "আক্রান্ত সংখ্যা" : "Affected Count",
    affectedCountPlaceholder: isBangla ? "আক্রান্ত প্রাণীর সংখ্যা" : "No. of affected",
    symptomsPlaceholder: isBangla ? "দেখা যাওয়া লক্ষণ লিখুন..." : "Describe observed symptoms...",
    findingsPlaceholder: isBangla ? "শারীরিক পরীক্ষার পর্যবেক্ষণ..." : "Physical exam findings...",
    diagnosisPlaceholder: isBangla ? "প্রাথমিক বা চূড়ান্ত রোগ নির্ণয়..." : "Provisional or final diagnosis...",
    medicineNamePlaceholder: isBangla ? "যেমন: Tylosin, Amoxicillin" : "e.g. Tylosin, Amoxicillin",
    medicineType: isBangla ? "ধরন" : "Type",
    route: isBangla ? "প্রয়োগ পদ্ধতি" : "Route",
    dosagePlaceholder: isBangla ? "যেমন: ১, ২.৫" : "e.g. 1, 2.5",
    frequency: isBangla ? "ডোজ প্যাটার্ন" : "Frequency",
    timing: isBangla ? "সময়" : "Timing",
    durationPlaceholder: isBangla ? "যেমন: ৫" : "e.g. 5",
    purposePlaceholder: isBangla ? "যেমন: শ্বাসতন্ত্রের সংক্রমণ" : "e.g. respiratory infection",
    notesPlaceholder: isBangla ? "বিশেষ নির্দেশনা" : "Special instructions",
    additionalCare: isBangla ? "অতিরিক্ত পরিচর্যা নির্দেশনা" : "Additional Care Instructions",
    feedingAdvice: isBangla ? "খাদ্য পরামর্শ" : "Feeding Advice",
    feedingPlaceholder: isBangla ? "যেমন: নরম খাবার দিন, কাঁচা দানা এড়িয়ে চলুন..." : "e.g. Give soft feed, avoid raw grains...",
    hydrationNote: isBangla ? "পানির নির্দেশনা" : "Hydration Note",
    hydrationPlaceholder: isBangla ? "যেমন: সবসময় পরিষ্কার পানি নিশ্চিত করুন..." : "e.g. Ensure clean water supply...",
    isolationAdvice: isBangla ? "আইসোলেশন নির্দেশনা" : "Isolation Advice",
    isolationPlaceholder: isBangla ? "যেমন: অসুস্থ প্রাণী আলাদা রাখুন..." : "e.g. Separate sick animals...",
    careInstructions: isBangla ? "সাধারণ পরিচর্যা নির্দেশনা" : "General Care Instructions",
    carePlaceholder: isBangla ? "যেমন: তাপমাত্রা মনিটর করুন, বিছানা শুকনা রাখুন..." : "e.g. Monitor temperature, keep litter dry...",
    followUp: isBangla ? "ফলো-আপ" : "Follow-up",
    followUpRequired: isBangla ? "ফলো-আপ প্রয়োজন" : "Follow-up required",
    nextAppointment: isBangla ? "পরবর্তী অ্যাপয়েন্টমেন্ট তারিখ" : "Next Appointment Date",
    warningSigns: isBangla ? "সতর্কতার লক্ষণ" : "Warning Signs to Watch",
    warningSignsPlaceholder: isBangla ? "যেমন: জ্বর না কমলে, হঠাৎ খাবার কমে গেলে..." : "e.g. If fever persists, sudden loss of appetite...",
    followUpNotes: isBangla ? "ফলো-আপ নোট" : "Follow-up Notes",
    followUpNotesPlaceholder: isBangla ? "ফলো-আপের অতিরিক্ত নির্দেশনা..." : "Additional notes for follow-up...",
    requiredTitle: isBangla ? "প্রয়োজনীয়" : "Required",
    selectAnimalTypeMsg: isBangla ? "অনুগ্রহ করে প্রাণীর ধরন নির্বাচন করুন।" : "Please select animal type.",
    diagnosisOrSymptomsMsg: isBangla ? "রোগ নির্ণয় বা লক্ষণ লিখুন।" : "Please add diagnosis or symptoms.",
    medicineOrCareMsg: isBangla ? "কমপক্ষে একটি ঔষধ বা পরিচর্যা নির্দেশনা যোগ করুন।" : "Add at least one medicine or care instruction.",
    draftSaved: isBangla ? "ড্রাফট সংরক্ষিত" : "Draft Saved",
    issuedSaved: isBangla ? "প্রেসক্রিপশন ইস্যু হয়েছে ✅" : "Prescription Issued ✅",
    draftSavedDesc: isBangla ? "আপনার প্রেসক্রিপশন ড্রাফট সংরক্ষিত হয়েছে।" : "Your prescription draft has been saved.",
    issuedSavedDesc: isBangla ? "প্রেসক্রিপশন রোগীর কাছে পাঠানো হয়েছে।" : "Prescription has been sent to the farmer.",
    errorTitle: isBangla ? "ত্রুটি" : "Error",
    saveFailed: isBangla ? "প্রেসক্রিপশন সংরক্ষণ ব্যর্থ হয়েছে।" : "Failed to save prescription.",
    consultationLabel: isBangla ? "কনসালটেশন" : "Consultation",
    medicineLabel: isBangla ? "ঔষধ" : "Medicine",
  };

  // Form state
  const [animalType, setAnimalType] = useState("");
  const [breed, setBreed] = useState("");
  const [animalGender, setAnimalGender] = useState("");
  const [animalAge, setAnimalAge] = useState("");
  const [animalWeight, setAnimalWeight] = useState("");
  const [farmName, setFarmName] = useState("");
  const [shedOrPen, setShedOrPen] = useState("");
  const [batchId, setBatchId] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [affectedCount, setAffectedCount] = useState("");

  const [symptoms, setSymptoms] = useState("");
  const [clinicalFindings, setClinicalFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [severity, setSeverity] = useState("moderate");

  const [medicines, setMedicines] = useState<MedicineRow[]>([emptyMedicine()]);

  const [feedingAdvice, setFeedingAdvice] = useState("");
  const [isolationAdvice, setIsolationAdvice] = useState("");
  const [hydrationNote, setHydrationNote] = useState("");
  const [careInstructions, setCareInstructions] = useState("");

  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [warningSigns, setWarningSigns] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  // Auto-fill from consultation
  useEffect(() => {
    if (!consultationId) return;
    setLoading(true);
    api
      .from("consultation_bookings")
      .select("*")
      .eq("id", consultationId)
      .single()
      .then(({ data }) => {
        if (data) {
          setBooking(data);
          setAnimalType(normalizeAnimalType(data.animal_type) || "other");
          setAnimalGender(data.animal_gender || "");
          setAnimalAge(data.animal_age || "");
          setSymptoms(data.symptoms || "");
        }
        setLoading(false);
      });
  }, [consultationId]);

  const addMedicine = () => setMedicines(prev => [...prev, emptyMedicine()]);

  const removeMedicine = (id: string) => {
    if (medicines.length <= 1) return;
    setMedicines(prev => prev.filter(m => m.id !== id));
  };

  const updateMedicine = (id: string, field: keyof MedicineRow, value: string) => {
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async (status: "draft" | "issued") => {
    if (!user) return;

    // Validation
    if (!animalType) {
      toast({ title: t.requiredTitle, description: t.selectAnimalTypeMsg, variant: "destructive" });
      return;
    }
    if (!diagnosis && !symptoms) {
      toast({ title: t.requiredTitle, description: t.diagnosisOrSymptomsMsg, variant: "destructive" });
      return;
    }
    const validMedicines = medicines.filter(m => m.medicine_name.trim());
    if (validMedicines.length === 0 && !careInstructions.trim()) {
      toast({ title: t.requiredTitle, description: t.medicineOrCareMsg, variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      // Create prescription
      const { data: prescription, error: pErr } = await api
        .from("prescriptions")
        .insert({
          consultation_id: consultationId || null,
          vet_user_id: user.id,
          farmer_user_id: booking?.patient_mock_id || null,
          farmer_name: booking?.patient_name || "Unknown Farmer",
          vet_name: user.name,
          animal_type: animalType,
          breed: breed || null,
          animal_gender: animalGender || null,
          animal_age: animalAge || null,
          animal_weight: animalWeight || null,
          farm_name: farmName || null,
          shed_or_pen: shedOrPen || null,
          batch_id: batchId || null,
          animal_id: animalId || null,
          affected_count: affectedCount ? parseInt(affectedCount) : null,
          symptoms: symptoms || null,
          clinical_findings: clinicalFindings || null,
          diagnosis: diagnosis || null,
          severity,
          feeding_advice: feedingAdvice || null,
          isolation_advice: isolationAdvice || null,
          hydration_note: hydrationNote || null,
          care_instructions: careInstructions || null,
          follow_up_required: followUpRequired,
          follow_up_date: followUpDate || null,
          warning_signs: warningSigns || null,
          follow_up_notes: followUpNotes || null,
          language,
          status,
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // Insert medicine items
      if (validMedicines.length > 0 && prescription) {
        const items = validMedicines.map(m => ({
          prescription_id: prescription.id,
          medicine_name: m.medicine_name.trim(),
          medicine_type: m.medicine_type || null,
          dosage: m.dosage || "as directed",
          dosage_unit: m.dosage_unit,
          frequency: m.frequency,
          dose_pattern: m.dose_pattern || null,
          timing: m.timing || null,
          route: m.route,
          duration_days: m.duration_days ? parseInt(m.duration_days) : null,
          purpose: m.purpose || null,
          notes: m.notes || null,
        }));

        const { error: iErr } = await api
          .from("prescription_items")
          .insert(items);

        if (iErr) throw iErr;
      }

      toast({
        title: status === "draft" ? t.draftSaved : t.issuedSaved,
        description: status === "draft"
          ? t.draftSavedDesc
          : t.issuedSavedDesc,
      });

      navigate("/vet/prescriptions");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : t.saveFailed;
      toast({ title: t.errorTitle, description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const severityColor: Record<string, string> = {
    mild: "bg-green-100 text-green-700",
    moderate: "bg-yellow-100 text-yellow-700",
    severe: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            {isBangla ? "প্রেসক্রিপশন তৈরি করুন" : "Create Prescription"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {booking
              ? isBangla
                ? `${booking.patient_name || "রোগী"} এর কনসালটেশন`
                : `Consultation with ${booking.patient_name}`
              : isBangla
                ? "নতুন প্রেসক্রিপশন"
                : "New prescription"}
          </p>
        </div>
        {booking && (
          <Badge variant="outline" className="text-xs">
            {t.consultationLabel} #{consultationId?.slice(0, 8)}
          </Badge>
        )}
      </motion.div>

      {/* Section 1: Consultation Header (read-only if from consultation) */}
      {booking && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                {isBangla ? "কনসালটেশন বিবরণ" : "Consultation Details"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{isBangla ? "রোগী" : "Patient"}</p>
                  <p className="font-medium">{booking.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isBangla ? "পদ্ধতি" : "Method"}</p>
                  <p className="font-medium capitalize">{booking.consultation_method}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isBangla ? "তারিখ" : "Date"}</p>
                  <p className="font-medium">{new Date(booking.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isBangla ? "ফি" : "Fee"}</p>
                  <p className="font-medium">৳{booking.fee}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{isBangla ? "প্রেসক্রিপশনের ভাষা" : "Prescription Language"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-1.5">
              <Label className="text-xs">{isBangla ? "ভাষা *" : "Language *"}</Label>
              <Select value={language} onValueChange={(value: "en" | "bn") => setLanguage(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bn">বাংলা</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 2: Animal Information */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-lg">🐄</span>
              {isBangla ? "প্রাণীর তথ্য" : "Animal Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t.animalType}</Label>
                <Select value={animalType} onValueChange={(value) => setAnimalType(normalizeAnimalType(value) || value)}>
                  <SelectTrigger><SelectValue placeholder={t.selectType} /></SelectTrigger>
                  <SelectContent>
                    {ANIMAL_TYPES.map(animal => <SelectItem key={animal} value={animal} className="capitalize">{getAnimalTypeLabel(animal)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isBangla ? "বংশ" : "Breed"}</Label>
                <Input placeholder={t.breedPlaceholder} value={breed} onChange={e => setBreed(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isBangla ? "লিঙ্গ" : "Gender"}</Label>
                <Select value={animalGender} onValueChange={setAnimalGender}>
                  <SelectTrigger><SelectValue placeholder={t.select} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{isBangla ? "পুরুষ" : "Male"}</SelectItem>
                    <SelectItem value="female">{isBangla ? "মহিলা" : "Female"}</SelectItem>
                    <SelectItem value="mixed">{isBangla ? "মিশ্র (ব্যাচ)" : "Mixed (Batch)"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isBangla ? "বয়স" : "Age"}</Label>
                <Input placeholder={t.agePlaceholder} value={animalAge} onChange={e => setAnimalAge(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isBangla ? "ওজন" : "Weight"}</Label>
                <Input placeholder={t.weightPlaceholder} value={animalWeight} onChange={e => setAnimalWeight(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isBangla ? "খামারের নাম" : "Farm Name"}</Label>
                <Input placeholder={t.farmNamePlaceholder} value={farmName} onChange={e => setFarmName(e.target.value)} />
              </div>
            </div>

            {/* Batch-specific fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t.batchId}</Label>
                <Input placeholder={t.batchPlaceholder} value={batchId} onChange={e => setBatchId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t.animalTag}</Label>
                <Input placeholder={t.animalTagPlaceholder} value={animalId} onChange={e => setAnimalId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t.shedPen}</Label>
                <Input placeholder={t.shedPenPlaceholder} value={shedOrPen} onChange={e => setShedOrPen(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t.affectedCount}</Label>
                <Input type="number" placeholder={t.affectedCountPlaceholder} value={affectedCount} onChange={e => setAffectedCount(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 3: Diagnosis */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
                {isBangla ? "রোগ নির্ণয়" : "Diagnosis"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{isBangla ? "লক্ষণ" : "Symptoms"}</Label>
              <Textarea placeholder={t.symptomsPlaceholder} value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isBangla ? "ক্লিনিক্যাল পর্যবেক্ষণ" : "Clinical Findings"}</Label>
              <Textarea placeholder={t.findingsPlaceholder} value={clinicalFindings} onChange={e => setClinicalFindings(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{isBangla ? "রোগ নির্ণয়" : "Diagnosis"}</Label>
                <Textarea placeholder={t.diagnosisPlaceholder} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isBangla ? "তীব্রতা" : "Severity"}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SEVERITY_LEVELS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                        severity === s ? severityColor[s] + " ring-2 ring-offset-1 ring-current" : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {isBangla ? BN_SEVERITY_LABELS[s] || s : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 4: Medicines */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Pill className="h-4 w-4 text-blue-500" />
                {isBangla ? `ঔষধ (${medicines.length})` : `Medicines (${medicines.length})`}
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addMedicine}>
                <Plus className="h-3 w-3 mr-1" /> {isBangla ? "ঔষধ যোগ করুন" : "Add Medicine"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {medicines.map((med, idx) => (
              <div key={med.id} className="relative p-4 rounded-xl border bg-accent/30 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">{t.medicineLabel} #{idx + 1}</Badge>
                  {medicines.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMedicine(med.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <Label className="text-xs">{isBangla ? "ঔষধের নাম *" : "Medicine Name *"}</Label>
                    <Input placeholder={t.medicineNamePlaceholder} value={med.medicine_name} onChange={e => updateMedicine(med.id, "medicine_name", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "ধরন" : "Type"}</Label>
                    <Select value={med.medicine_type} onValueChange={v => updateMedicine(med.id, "medicine_type", v)}>
                      <SelectTrigger><SelectValue placeholder={t.medicineType} /></SelectTrigger>
                      <SelectContent>
                        {MEDICINE_TYPES.map(type => <SelectItem key={type} value={type} className="capitalize">{isBangla ? (BN_MEDICINE_TYPE_LABELS[type] || type) : type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "প্রয়োগ পদ্ধতি" : "Route"}</Label>
                    <Select value={med.route} onValueChange={v => updateMedicine(med.id, "route", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROUTE_OPTIONS.map(r => <SelectItem key={r} value={r} className="capitalize">{isBangla ? (BN_ROUTE_LABELS[r] || r) : r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "ডোজ *" : "Dosage *"}</Label>
                    <Input placeholder={t.dosagePlaceholder} value={med.dosage} onChange={e => updateMedicine(med.id, "dosage", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "একক" : "Unit"}</Label>
                    <Select value={med.dosage_unit} onValueChange={v => updateMedicine(med.id, "dosage_unit", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOSAGE_UNITS.map(u => <SelectItem key={u} value={u}>{isBangla ? (BN_DOSAGE_UNIT_LABELS[u] || u) : u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{language === "bn" ? "ডোজ প্যাটার্ন" : "Frequency"}</Label>
                    <Select
                      value={language === "bn" ? med.dose_pattern : med.frequency}
                      onValueChange={v => updateMedicine(med.id, language === "bn" ? "dose_pattern" : "frequency", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(language === "bn" ? BANGLA_DOSE_PATTERN_OPTIONS : FREQUENCY_OPTIONS).map(f => (
                          <SelectItem key={f} value={f} className="capitalize">{isBangla ? (BN_FREQUENCY_LABELS[f] || f) : f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "সময়" : "Timing"}</Label>
                    <Select value={med.timing} onValueChange={v => updateMedicine(med.id, "timing", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(language === "bn" ? BANGLA_TIMING_OPTIONS : TIMING_OPTIONS).map(timing => (
                          <SelectItem key={timing} value={timing} className="capitalize">{isBangla ? (BN_TIMING_LABELS[timing] || timing) : timing}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "মেয়াদ (দিন)" : "Duration (days)"}</Label>
                    <Input type="number" placeholder={t.durationPlaceholder} value={med.duration_days} onChange={e => updateMedicine(med.id, "duration_days", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "উদ্দেশ্য" : "Purpose"}</Label>
                    <Input placeholder={t.purposePlaceholder} value={med.purpose} onChange={e => updateMedicine(med.id, "purpose", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isBangla ? "নোট" : "Notes"}</Label>
                    <Input placeholder={t.notesPlaceholder} value={med.notes} onChange={e => updateMedicine(med.id, "notes", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 5: Additional Instructions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              {t.additionalCare}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t.feedingAdvice}</Label>
                <Textarea placeholder={t.feedingPlaceholder} value={feedingAdvice} onChange={e => setFeedingAdvice(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t.hydrationNote}</Label>
                <Textarea placeholder={t.hydrationPlaceholder} value={hydrationNote} onChange={e => setHydrationNote(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t.isolationAdvice}</Label>
                <Textarea placeholder={t.isolationPlaceholder} value={isolationAdvice} onChange={e => setIsolationAdvice(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t.careInstructions}</Label>
                <Textarea placeholder={t.carePlaceholder} value={careInstructions} onChange={e => setCareInstructions(e.target.value)} rows={2} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 6: Follow-up */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {t.followUp}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={followUpRequired} onCheckedChange={setFollowUpRequired} />
              <Label className="text-sm">{t.followUpRequired}</Label>
            </div>
            {followUpRequired && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.nextAppointment}</Label>
                  <Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.warningSigns}</Label>
                  <Textarea placeholder={t.warningSignsPlaceholder} value={warningSigns} onChange={e => setWarningSigns(e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">{t.followUpNotes}</Label>
                  <Textarea placeholder={t.followUpNotesPlaceholder} value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)} rows={2} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="flex flex-col sm:flex-row items-center gap-3 sticky bottom-0 bg-background/95 backdrop-blur-sm py-4 border-t -mx-4 px-4 md:-mx-6 md:px-6"
      >
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(-1)} disabled={saving}>
          {isBangla ? "বাতিল" : "Cancel"}
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleSubmit("draft")} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {isBangla ? "ড্রাফট সংরক্ষণ করুন" : "Save Draft"}
        </Button>
        <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90" onClick={() => handleSubmit("issued")} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          {isBangla ? "প্রেসক্রিপশন ইস্যু করুন" : "Issue Prescription"}
        </Button>
      </motion.div>
    </div>
  );
}
