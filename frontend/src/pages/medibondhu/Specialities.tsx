import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/api/client";
import { Vet } from "@/data/mockData";
import { Search, Stethoscope, Egg, Milk, Star, Clock, Zap, Heart, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/StatCard";
import { SPECIALITY_ANIMAL_MAP, normalizeAnimalTypes } from "@/lib/animalTypes";

const MB = "#12C2D6";

const SPECIALITIES = [
  { id: "poultry", name: "Poultry", icon: Egg, description: "Chickens, ducks, turkeys, pigeons", animals: ["chicken", "duck", "turkey", "pigeon"], emoji: "🐔" },
  { id: "cattle", name: "Cattle", icon: Heart, description: "Cows, bulls, calves", animals: ["cow"], emoji: "🐄" },
  { id: "dairy", name: "Dairy", icon: Milk, description: "Dairy cow health & production", animals: ["cow"], emoji: "🥛" },
  { id: "goat-sheep", name: "Goat & Sheep", icon: Heart, description: "Goats and sheep care", animals: ["goat", "sheep"], emoji: "🐐" },
  { id: "general", name: "General", icon: Stethoscope, description: "All animal types", animals: ["chicken", "duck", "cow", "goat", "sheep", "turkey", "pigeon"], emoji: "🩺" },
  { id: "emergency", name: "Emergency", icon: Zap, description: "Urgent veterinary care 24/7", animals: ["chicken", "duck", "cow", "goat", "sheep", "turkey", "pigeon"], emoji: "🚨" },
];

export default function Specialities() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [vets, setVets] = useState<Vet[]>([]);

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

  const availableVets = vets.filter(v => v.available).length;
  const handleSearch = () => { if (search.trim()) navigate(`/medibondhu/vets?search=${encodeURIComponent(search.trim())}`); };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">MediBondhu</h1>
        <p className="text-muted-foreground mt-1">Connect with veterinary specialists for your animals</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Vets" value={vets.length} icon={<Stethoscope className="h-5 w-5" />} iconColor={MB} index={0} />
        <StatCard title="Available Now" value={availableVets} icon={<Clock className="h-5 w-5" />} iconColor={MB} index={1} />
        <StatCard title="Avg Rating" value={vets.length ? (vets.reduce((s, v) => s + v.rating, 0) / vets.length).toFixed(1) : "0"} icon={<Star className="h-5 w-5" />} iconColor={MB} index={2} />
        <StatCard title="Specialities" value={SPECIALITIES.length} icon={<Heart className="h-5 w-5" />} iconColor={MB} index={3} />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card overflow-hidden"><div className="h-1" style={{ backgroundColor: MB }} />
          <CardContent className="p-5"><h2 className="font-display font-bold text-foreground mb-3">Quick Search</h2>
            <div className="flex gap-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="specialitiesSearch" name="specialitiesSearch" placeholder="Search doctor by name or specialization..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-9" /></div>
              <Button onClick={handleSearch} className="text-white shrink-0" style={{ backgroundColor: MB }}><Search className="h-4 w-4 mr-1" />Search</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="font-display font-bold text-lg text-foreground mb-4">Choose a Speciality</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SPECIALITIES.map((sp, i) => {
            const scopedAnimals = SPECIALITY_ANIMAL_MAP[sp.id] || sp.animals;
            const vetCount = vets.filter(v => scopedAnimals.some(a => v.animalTypes.includes(a))).length;
            return (
              <motion.div key={sp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <Card className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer group overflow-hidden" onClick={() => navigate(`/medibondhu/vets?speciality=${sp.id}`)}>
                  <div className="h-1" style={{ backgroundColor: MB }} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${MB}15` }}>{sp.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between"><h3 className="font-display font-bold text-foreground">{sp.name}</h3><ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" style={{ color: MB }} /></div>
                        <p className="text-sm text-muted-foreground mt-0.5">{sp.description}</p>
                        <p className="text-xs font-medium mt-2" style={{ color: MB }}>{vetCount} doctor{vetCount !== 1 ? "s" : ""} available</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-card overflow-hidden"><div className="h-1" style={{ backgroundColor: MB }} />
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: `${MB}15` }}>⚡</div>
            <div className="flex-1 text-center sm:text-left"><h3 className="font-display font-bold text-lg text-foreground">Need Urgent Help?</h3><p className="text-sm text-muted-foreground">Connect with an available vet instantly — no waiting</p></div>
            <Button size="lg" className="text-white shrink-0" style={{ backgroundColor: MB }} onClick={() => navigate("/medibondhu/vets?instant=true")}><Zap className="h-4 w-4 mr-2" />Instant Consultation</Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
