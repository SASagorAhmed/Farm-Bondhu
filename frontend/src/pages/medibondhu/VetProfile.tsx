import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api/client";
import { Vet } from "@/data/mockData";
import { Star, MapPin, GraduationCap, Calendar, ArrowLeft, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { getAnimalTypeLabel, normalizeAnimalTypes } from "@/lib/animalTypes";

const MB = "#12C2D6";

export default function VetProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vet, setVet] = useState<Vet | null>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.from("vets").select("*").eq("id", id).single().then(({ data }) => {
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
          avatar: data.avatar || "",
          degree: data.degree || "DVM",
        });
      }
      setLoading(false);
    });
    api.from("consultation_bookings").select("*").eq("vet_mock_id", id).order("created_at", { ascending: false }).limit(5).then(({ data }) => {
      if (data) setConsultations(data);
    });
  }, [id]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!vet) return <div className="text-center py-12 text-muted-foreground">Vet not found</div>;
  const displayAnimalTypes = vet.animalTypes.length ? vet.animalTypes : ["general"];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: MB }} />
          <CardContent className="p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-full flex items-center justify-center text-white text-3xl shrink-0" style={{ backgroundColor: MB }}>🩺</div>
              <div className="flex-1">
                <h1 className="text-2xl font-display font-bold text-foreground">{vet.name}</h1>
                <p className="font-medium" style={{ color: MB }}>{vet.specialization}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><GraduationCap className="h-4 w-4" />{vet.degree}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="h-4 w-4" style={{ fill: MB, color: MB }} />{vet.rating} Rating</span>
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{vet.location}</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{vet.experience} years</span>
                </div>
              </div>
              <Badge style={{ backgroundColor: vet.available ? `${MB}20` : undefined, color: vet.available ? MB : undefined }} className={!vet.available ? "bg-muted text-muted-foreground" : ""}>{vet.available ? "Available" : "Unavailable"}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-accent/50"><p className="text-sm text-muted-foreground">Consultation Fee</p><p className="text-2xl font-bold" style={{ color: MB }}>৳{vet.fee}</p></div>
              <div className="p-4 rounded-lg bg-accent/50"><p className="text-sm text-muted-foreground">Experience</p><p className="text-2xl font-bold text-foreground">{vet.experience} yrs</p></div>
              <div className="p-4 rounded-lg bg-accent/50"><p className="text-sm text-muted-foreground">Rating</p><p className="text-2xl font-bold text-foreground">{vet.rating}/5</p></div>
            </div>
            <div><h3 className="font-display font-bold text-foreground mb-2">Specializes In</h3><div className="flex flex-wrap gap-2">{displayAnimalTypes.map(a => <Badge key={a} className="capitalize" style={{ backgroundColor: `${MB}20`, color: MB }}>{getAnimalTypeLabel(a)}</Badge>)}</div></div>
            <Button className="w-full text-white h-12" style={{ backgroundColor: MB }} disabled={!vet.available} onClick={() => navigate(`/medibondhu/book/${vet.id}`)}><Calendar className="h-4 w-4 mr-2" />Book Consultation — ৳{vet.fee}</Button>
          </CardContent>
        </Card>
      </motion.div>

      {consultations.length > 0 && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: MB }} />
          <CardHeader><CardTitle className="text-lg font-display">Recent Consultations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {consultations.map(c => (
              <div key={c.id} className="p-3 rounded-lg bg-accent/50">
                <div className="flex justify-between items-start">
                  <div><p className="font-medium text-foreground">{c.symptoms}</p><p className="text-xs text-muted-foreground">{c.scheduled_date} • {c.scheduled_time} • {c.animal_type}</p></div>
                  <Badge variant="outline" className="capitalize">{c.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
