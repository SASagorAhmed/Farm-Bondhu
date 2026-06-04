import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vetbondhuApi } from "@/api/client";
import { Vet } from "@/data/mockData";
import { Search, Stethoscope, Egg, Milk, Clock, Zap, Heart, ChevronRight, Sprout, ShieldCheck, Bird } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/StatCard";
import { SPECIALITY_ANIMAL_MAP, normalizeAnimalTypes } from "@/lib/animalTypes";
import {
  parseVetBondhuSpecializations,
  VETBONDHU_SPECIALIZATION_DEFINITIONS,
} from "@/lib/vetbondhuSpecializations";

import { ICON_COLORS } from "@/lib/iconColors";

const VB = ICON_COLORS.vetbondhu;

const CONSULTATION_TYPES = [
  {
    id: "animal-veterinary",
    title: "Animal & Veterinary Consultation",
    description: "Livestock, poultry, pets, disease, symptoms, prescriptions, and follow-up care.",
    icon: Stethoscope,
    query: "Animal Veterinary Consultation",
  },
  {
    id: "farming-agricultural",
    title: "Farming & Agricultural Consultation",
    description: "Farm setup, feed planning, production, biosecurity, crop/agriculture, and operations.",
    icon: Sprout,
    query: "Farming Agricultural Consultation",
  },
];

type VetBondhuVetRow = {
  id: string;
  name?: string | null;
  specialization?: string | null;
  animal_types?: unknown;
  rating?: number | string | null;
  experience?: number | string | null;
  fee?: number | string | null;
  consultation_fee?: number | string | null;
  location?: string | null;
  available?: boolean | null;
  avatar?: string | null;
  degree?: string | null;
};

const SPECIALITIES = [
  { id: "poultry", name: "Poultry", icon: Egg, description: "Chickens, ducks, turkeys, pigeons", animals: ["chicken", "duck", "turkey", "pigeon"], emoji: "🐔" },
  { id: "cattle", name: "Cattle", icon: Heart, description: "Cows, bulls, calves", animals: ["cow"], emoji: "🐄" },
  { id: "dairy", name: "Dairy", icon: Milk, description: "Dairy cow health & production", animals: ["cow"], emoji: "🥛" },
  { id: "goat-sheep", name: "Goat & Sheep", icon: Heart, description: "Goats and sheep care", animals: ["goat", "sheep"], emoji: "🐐" },
  { id: "pet", name: "Pet Care", icon: Heart, description: "Dogs, cats, and pet birds", animals: ["dog", "cat", "bird"], emoji: "🐾" },
  { id: "general", name: "General", icon: Stethoscope, description: "All animal types", animals: ["chicken", "duck", "cow", "goat", "sheep", "turkey", "pigeon", "dog", "cat", "bird"], emoji: "🩺" },
  { id: "emergency", name: "Emergency", icon: Zap, description: "Urgent veterinary care 24/7", animals: ["chicken", "duck", "cow", "goat", "sheep", "turkey", "pigeon", "dog", "cat", "bird"], emoji: "🚨" },
];

const DEFAULT_CARD_LABELS = new Set([
  ...CONSULTATION_TYPES.map((type) => type.title.toLowerCase()),
  ...SPECIALITIES.map((sp) => sp.name.toLowerCase()),
  "pet care: dog, cat, bird",
  "general veterinary",
  "emergency veterinary care",
  "instant consultation",
]);

const SPECIALITY_LABEL_BY_ID: Record<string, string> = {
  poultry: "Poultry",
  cattle: "Cattle",
  dairy: "Dairy",
  "goat-sheep": "Goat & Sheep",
  pet: "Pet Care",
  general: "General",
  emergency: "Emergency",
};

const DYNAMIC_SPECIALITY_ICON_BY_KEY = {
  vet: Stethoscope,
  farm: Sprout,
  poultry: Egg,
  duck: Bird,
  cattle: Heart,
  dairy: Milk,
  goatSheep: Heart,
  pet: Heart,
  general: Stethoscope,
  emergency: Zap,
  instant: Clock,
  biosecurity: ShieldCheck,
};

function getDynamicSpecialityIcon(label: string) {
  const definition = VETBONDHU_SPECIALIZATION_DEFINITIONS.find((item) => item.label === label);
  return definition ? DYNAMIC_SPECIALITY_ICON_BY_KEY[definition.iconKey] : Stethoscope;
}

function vetMatchesSpeciality(vet: Vet, specialityId: string, animals: string[]) {
  const specializationLabels = parseVetBondhuSpecializations(vet.specialization);
  const expectedLabel = SPECIALITY_LABEL_BY_ID[specialityId];
  return (
    animals.some((animal) => vet.animalTypes.includes(animal)) ||
    Boolean(expectedLabel && specializationLabels.includes(expectedLabel))
  );
}

export default function Specialities() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [vets, setVets] = useState<Vet[]>([]);

  useEffect(() => {
    vetbondhuApi.from("vets").select("*").then(({ data }) => {
      if (data) {
        setVets(
          (data as VetBondhuVetRow[]).map((v) => ({
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
  const dynamicSpecialityCards = Array.from(
    vets.reduce((map, vet) => {
      for (const label of parseVetBondhuSpecializations(vet.specialization)) {
        const key = label.toLowerCase();
        if (DEFAULT_CARD_LABELS.has(key)) continue;
        map.set(label, (map.get(label) || 0) + 1);
      }
      return map;
    }, new Map<string, number>())
  ).map(([label, count]) => ({ label, count }));
  const regularSpecialities = SPECIALITIES.filter((sp) => sp.id !== "emergency");
  const emergencySpeciality = SPECIALITIES.find((sp) => sp.id === "emergency");
  const handleSearch = () => { if (search.trim()) navigate(`/vetbondhu/vets?search=${encodeURIComponent(search.trim())}`); };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">VetBondhu</h1>
        <p className="text-muted-foreground mt-1">Connect with veterinary specialists for your animals</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Vets" value={vets.length} icon={<Stethoscope className="h-5 w-5" />} iconColor={VB} index={0} />
        <StatCard title="Available Now" value={availableVets} icon={<Clock className="h-5 w-5" />} iconColor={VB} index={1} />
        <StatCard title="Animal Types" value={new Set(SPECIALITIES.flatMap((sp) => sp.animals)).size} icon={<Heart className="h-5 w-5" />} iconColor={VB} index={2} />
        <StatCard title="Specialities" value={SPECIALITIES.length + dynamicSpecialityCards.length} icon={<Heart className="h-5 w-5" />} iconColor={VB} index={3} />
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card overflow-hidden"><div className="h-1" style={{ backgroundColor: VB }} />
          <CardContent className="p-5"><h2 className="font-display font-bold text-foreground mb-3">Quick Search</h2>
            <div className="flex gap-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="specialitiesSearch" name="specialitiesSearch" placeholder="Search doctor by name or specialization..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-9" /></div>
              <Button onClick={handleSearch} className="text-white shrink-0" style={{ backgroundColor: VB }}><Search className="h-4 w-4 mr-1" />Search</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h2 className="font-display font-bold text-lg text-foreground mb-4">Choose Consultation Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONSULTATION_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Card
                key={type.id}
                className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer group overflow-hidden"
                onClick={() => navigate(`/vetbondhu/vets?search=${encodeURIComponent(type.query)}`)}
              >
                <div className="h-1" style={{ backgroundColor: VB }} />
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${VB}15` }}>
                      <Icon className="h-6 w-6" style={{ color: VB }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display font-bold text-foreground">{type.title}</h3>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" style={{ color: VB }} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="font-display font-bold text-lg text-foreground mb-4">Doctor Specializations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regularSpecialities.map((sp, i) => {
            const scopedAnimals = SPECIALITY_ANIMAL_MAP[sp.id] || sp.animals;
            const vetCount = vets.filter((v) => vetMatchesSpeciality(v, sp.id, scopedAnimals)).length;
            return (
              <motion.div key={sp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <Card className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer group overflow-hidden" onClick={() => navigate(`/vetbondhu/vets?speciality=${sp.id}`)}>
                  <div className="h-1" style={{ backgroundColor: VB }} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${VB}15` }}>{sp.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between"><h3 className="font-display font-bold text-foreground">{sp.name}</h3><ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" style={{ color: VB }} /></div>
                        <p className="text-sm text-muted-foreground mt-0.5">{sp.description}</p>
                        <p className="text-xs font-medium mt-2" style={{ color: VB }}>{vetCount} doctor{vetCount !== 1 ? "s" : ""} available</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {dynamicSpecialityCards.map((card) => {
              const Icon = getDynamicSpecialityIcon(card.label);
              return (
                <Card
                  key={card.label}
                  className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer group overflow-hidden"
                  onClick={() => navigate(`/vetbondhu/vets?search=${encodeURIComponent(card.label)}`)}
                >
                  <div className="h-1" style={{ backgroundColor: VB }} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${VB}15` }}>
                        <Icon className="h-6 w-6" style={{ color: VB }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display font-bold text-foreground">{card.label}</h3>
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" style={{ color: VB }} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">Doctor-selected consultation category</p>
                        <p className="text-xs font-medium mt-2" style={{ color: VB }}>
                          {card.count} doctor{card.count !== 1 ? "s" : ""} available
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          {emergencySpeciality && (() => {
            const scopedAnimals = SPECIALITY_ANIMAL_MAP[emergencySpeciality.id] || emergencySpeciality.animals;
            const vetCount = vets.filter((v) => vetMatchesSpeciality(v, emergencySpeciality.id, scopedAnimals)).length;
            return (
              <motion.div key={emergencySpeciality.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + (regularSpecialities.length + dynamicSpecialityCards.length) * 0.05 }}>
                <Card className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer group overflow-hidden" onClick={() => navigate(`/vetbondhu/vets?speciality=${emergencySpeciality.id}`)}>
                  <div className="h-1" style={{ backgroundColor: VB }} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: `${VB}15` }}>{emergencySpeciality.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between"><h3 className="font-display font-bold text-foreground">{emergencySpeciality.name}</h3><ChevronRight className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" style={{ color: VB }} /></div>
                        <p className="text-sm text-muted-foreground mt-0.5">{emergencySpeciality.description}</p>
                        <p className="text-xs font-medium mt-2" style={{ color: VB }}>{vetCount} doctor{vetCount !== 1 ? "s" : ""} available</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-card overflow-hidden"><div className="h-1" style={{ backgroundColor: VB }} />
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: `${VB}15` }}>⚡</div>
            <div className="flex-1 text-center sm:text-left"><h3 className="font-display font-bold text-lg text-foreground">Need Urgent Help?</h3><p className="text-sm text-muted-foreground">Connect with an available vet instantly — no waiting</p></div>
            <Button size="lg" className="text-white shrink-0" style={{ backgroundColor: VB }} onClick={() => navigate("/vetbondhu/vets?instant=true")}><Zap className="h-4 w-4 mr-2" />Instant Consultation</Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
