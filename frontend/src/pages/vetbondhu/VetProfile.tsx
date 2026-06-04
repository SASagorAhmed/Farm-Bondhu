import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { vetbondhuApi } from "@/api/client";
import { Vet } from "@/data/mockData";
import { Star, MapPin, GraduationCap, Calendar, ArrowLeft, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { getAnimalTypeLabel, normalizeAnimalTypes } from "@/lib/animalTypes";
import { fetchVetBondhuVetReviews, type VetBondhuReviewSummary } from "@/lib/vetbondhuReviewsApi";

import { ICON_COLORS } from "@/lib/iconColors";

const VB = ICON_COLORS.vetbondhu;
const formatReviewDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

type VetProfileConsultation = {
  id: string;
  symptoms?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  animal_type?: string | null;
  status?: string | null;
};

function vetIsOnline(vet: Vet) {
  return vet.is_online ?? vet.available;
}

export default function VetProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vet, setVet] = useState<Vet | null>(null);
  const [consultations, setConsultations] = useState<VetProfileConsultation[]>([]);
  const [reviewSummary, setReviewSummary] = useState<VetBondhuReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadVet = () => vetbondhuApi.from("vets").select("*").eq("id", id).single().then(({ data }) => {
      if (cancelled) return;
      if (data) {
        setVet({
          id: data.id,
          name: data.name || "Vet Doctor",
          specialization: data.specialization || "General Veterinary",
          animalTypes: normalizeAnimalTypes(data.animal_types),
          rating: Number(data.rating || 0),
          experience: Number(data.experience || 0),
          fee: Number(data.fee ?? data.consultation_fee ?? 500),
          location: data.location || "Bangladesh",
          available: data.available ?? true,
          is_online: Boolean(data.is_online ?? data.available ?? false),
          status_label: String(data.status_label || (data.is_online ? "Online" : "Offline")),
          last_seen_at: data.last_seen_at || null,
          avatar: data.avatar || "",
          degree: data.degree || "DVM",
        });
      }
      setLoading(false);
    });
    void loadVet();
    const interval = window.setInterval(() => {
      void loadVet();
    }, 30_000);
    vetbondhuApi.from("consultation_bookings").select("*").eq("vet_mock_id", id).order("created_at", { ascending: false }).limit(5).then(({ data }) => {
      if (!cancelled && data) setConsultations(data);
    });
    fetchVetBondhuVetReviews(id)
      .then((summary) => {
        if (!cancelled) setReviewSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setReviewSummary(null);
      });
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [id]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!vet) return <div className="text-center py-12 text-muted-foreground">Vet not found</div>;
  const displayAnimalTypes = vet.animalTypes.length ? vet.animalTypes : ["general"];
  const isOnline = vetIsOnline(vet);
  const displayedRating = reviewSummary?.reviewCount ? reviewSummary.averageRating : vet.rating;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: VB }} />
          <CardContent className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-full flex items-center justify-center text-white text-3xl shrink-0" style={{ backgroundColor: VB }}>🩺</div>
              <div className="flex-1">
                <h1 className="text-2xl font-display font-bold text-foreground">{vet.name}</h1>
                <p className="font-medium" style={{ color: VB }}>{vet.specialization}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><GraduationCap className="h-4 w-4" />{vet.degree}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="h-4 w-4" style={{ fill: VB, color: VB }} />{displayedRating} Rating</span>
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{vet.location}</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{vet.experience} years</span>
                </div>
              </div>
              <Badge style={{ backgroundColor: isOnline ? `${VB}20` : undefined, color: isOnline ? VB : undefined }} className={!isOnline ? "bg-muted text-muted-foreground" : ""}>{isOnline ? "Online" : "Offline"}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-accent/50"><p className="text-sm text-muted-foreground">Consultation Fee</p><p className="text-2xl font-bold" style={{ color: VB }}>৳{vet.fee}</p></div>
              <div className="p-4 rounded-lg bg-accent/50"><p className="text-sm text-muted-foreground">Experience</p><p className="text-2xl font-bold text-foreground">{vet.experience} yrs</p></div>
              <div className="p-4 rounded-lg bg-accent/50"><p className="text-sm text-muted-foreground">Rating</p><p className="text-2xl font-bold text-foreground">{displayedRating}/5</p><p className="text-xs text-muted-foreground">{reviewSummary?.reviewCount || 0} reviews</p></div>
            </div>
            <div><h3 className="font-display font-bold text-foreground mb-2">Specializes In</h3><div className="flex flex-wrap gap-2">{displayAnimalTypes.map(a => <Badge key={a} className="capitalize" style={{ backgroundColor: `${VB}20`, color: VB }}>{getAnimalTypeLabel(a)}</Badge>)}</div></div>
            <Button className="w-full text-white h-12" style={{ backgroundColor: isOnline ? VB : "hsl(var(--muted-foreground))" }} disabled={!isOnline} onClick={() => navigate(`/vetbondhu/book/${vet.id}`)}><Calendar className="h-4 w-4 mr-2" />{isOnline ? `Book Consultation — ৳${vet.fee}` : "Doctor offline"}</Button>
            {!isOnline && <p className="text-sm text-muted-foreground text-center">Doctor is offline and unavailable right now.</p>}
          </CardContent>
        </Card>
      </motion.div>

      {consultations.length > 0 && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: VB }} />
          <CardHeader><CardTitle className="text-lg font-display">Recent Consultations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {consultations.map(c => (
              <div key={c.id} className="p-3 rounded-lg bg-accent/50">
                <div className="flex justify-between items-start">
                  <div><p className="font-medium text-foreground">{c.symptoms || "No symptoms provided"}</p><p className="text-xs text-muted-foreground">{c.scheduled_date} • {c.scheduled_time} • {c.animal_type}</p></div>
                  <Badge variant="outline" className="capitalize">{c.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ backgroundColor: VB }} />
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg font-display">Patient Reviews</CardTitle>
            <Badge variant="outline" style={{ borderColor: `${VB}40`, color: VB }}>
              {reviewSummary?.reviewCount || 0} submitted
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewSummary?.reviews.length ? (
            reviewSummary.reviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-border bg-accent/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{review.patient_name || "VetBondhu patient"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[review.animal_type, formatReviewDate(review.created_at)].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold" style={{ color: VB }}>
                    <Star className="h-4 w-4" style={{ fill: VB, color: VB }} />
                    {review.rating}/5
                  </span>
                </div>
                {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No submitted reviews yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
