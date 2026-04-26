import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/api/client";
import { Vet } from "@/data/mockData";
import { Stethoscope, Star, MapPin, Calendar, Search, GraduationCap, ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ALL_ANIMAL_TYPES,
  SPECIALITY_ANIMAL_MAP,
  getAnimalTypeLabel,
  normalizeAnimalTypes,
} from "@/lib/animalTypes";

const MB = "#12C2D6";

export default function VetDirectory() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const specialityParam = searchParams.get("speciality") || "";
  const instantParam = searchParams.get("instant") === "true";

  const [search, setSearch] = useState(initialSearch);
  const [animalFilter, setAnimalFilter] = useState("all");
  const [availOnly, setAvailOnly] = useState(instantParam);
  const [vets, setVets] = useState<Vet[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.from("vets").select("*").then(({ data }) => {
      if (data) {
        setVets(
          data.map((v: any) => ({
            id: v.id,
            name: v.name || "Vet Doctor",
            specialization: v.specialization || "General Veterinary",
            animalTypes: normalizeAnimalTypes(v.animal_types),
            rating: Number(v.rating || 0),
            experience: Number(v.experience || 0),
            fee: Number(v.fee ?? v.consultation_fee ?? 500),
            location: v.location || "Bangladesh",
            available: v.available ?? true,
            avatar: v.avatar || "",
            degree: v.degree || "DVM",
          }))
        );
      }
    });
  }, []);

  const filtered = vets.filter(v => {
    if (search && !String(v.name || "").toLowerCase().includes(search.toLowerCase()) && !String(v.specialization || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (animalFilter !== "all" && !v.animalTypes.includes(animalFilter)) return false;
    if (availOnly && !v.available) return false;
    if (specialityParam && SPECIALITY_ANIMAL_MAP[specialityParam]) {
      const animals = SPECIALITY_ANIMAL_MAP[specialityParam];
      if (!v.animalTypes.some(a => animals.includes(a))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/medibondhu")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{specialityParam ? `${specialityParam.charAt(0).toUpperCase() + specialityParam.slice(1).replace("-", " & ")} Doctors` : "Find a Doctor"}</h1>
          <p className="text-muted-foreground mt-1">{instantParam ? "Available doctors for instant consultation" : "Find veterinary specialists for your animals"}</p>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name or specialization..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={animalFilter} onValueChange={setAnimalFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Animal Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Animals</SelectItem>{ALL_ANIMAL_TYPES.filter((a) => a !== "other").map((animal) => <SelectItem key={animal} value={animal}>{getAnimalTypeLabel(animal)}</SelectItem>)}</SelectContent></Select>
        <Button variant={availOnly ? "default" : "outline"} onClick={() => setAvailOnly(!availOnly)} style={availOnly ? { backgroundColor: MB, color: "white", borderColor: MB } : { borderColor: MB, color: MB }}>Available Now</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((vet, i) => {
          const displayAnimalTypes = vet.animalTypes.length ? vet.animalTypes : ["general"];
          return (
            <motion.div key={vet.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group h-full flex flex-col">
                <div className="h-1 shrink-0" style={{ backgroundColor: MB }} />
                <CardContent className="p-5 flex flex-col flex-1 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${MB}18` }}><Stethoscope className="h-6 w-6" style={{ color: MB }} /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-foreground text-sm leading-tight truncate">{vet.name}</h3>
                    <p className="text-xs font-medium truncate" style={{ color: MB }}>{vet.specialization}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><GraduationCap className="h-3 w-3 shrink-0" /><span className="truncate">{vet.degree}</span></p>
                  </div>
                  <Badge className="shrink-0 text-xs" style={vet.available ? { backgroundColor: `${MB}18`, color: MB, border: `1px solid ${MB}40` } : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>{vet.available ? "Available" : "Unavailable"}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${MB}0A` }}><p className="text-xs text-muted-foreground">Rating</p><p className="font-bold text-foreground flex items-center justify-center gap-1"><Star className="h-3 w-3" style={{ color: MB, fill: MB }} />{vet.rating}</p></div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${MB}0A` }}><p className="text-xs text-muted-foreground">Experience</p><p className="font-bold text-foreground">{vet.experience}yr</p></div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${MB}0A` }}><p className="text-xs text-muted-foreground">Fee</p><p className="font-bold" style={{ color: MB }}>৳{vet.fee}</p></div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" style={{ color: MB }} /><span className="truncate">{vet.location}</span></div>
                <div className="flex flex-wrap gap-1">{displayAnimalTypes.map(a => <Badge key={a} variant="outline" className="text-xs capitalize" style={{ borderColor: `${MB}40`, color: MB }}>{getAnimalTypeLabel(a)}</Badge>)}</div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button variant="outline" size="sm" className="flex-1" style={{ borderColor: `${MB}50`, color: MB }} onClick={() => navigate(`/medibondhu/vet/${vet.id}`)}>View Profile</Button>
                  <Button size="sm" className="flex-1 text-white" style={{ backgroundColor: MB }} disabled={!vet.available} onClick={() => navigate(`/medibondhu/book/${vet.id}`)}><Calendar className="h-3.5 w-3.5 mr-1" />Book Now</Button>
                </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">No vets found</p>}
    </div>
  );
}
