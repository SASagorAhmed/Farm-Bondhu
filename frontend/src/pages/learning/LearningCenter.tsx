import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Syringe, Bug, Wheat, Pill, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Guide {
  id: string;
  title: string;
  category: string;
  animal_type: string;
  summary: string;
  content: string;
}

// Static fallback guides (shown alongside DB guides)
const STATIC_GUIDES: Guide[] = [
  { id: "l1", title: "Newcastle Disease (Ranikhet)", category: "disease", animal_type: "chicken", summary: "Highly contagious viral disease affecting poultry", content: "Newcastle disease is caused by paramyxovirus. Symptoms include respiratory distress, greenish diarrhea, twisted neck. Vaccinate with B1 strain at day 5, La Sota at day 21. Mortality can reach 100% in unvaccinated flocks." },
  { id: "l2", title: "Foot and Mouth Disease (FMD)", category: "disease", animal_type: "cow", summary: "Viral disease causing blisters on mouth and feet", content: "FMD affects cattle, goats, and sheep. Look for drooling, lameness, blisters on tongue and hooves. Vaccinate every 6 months. Isolate affected animals immediately. No direct cure — supportive treatment only." },
  { id: "l3", title: "PPR (Peste des Petits Ruminants)", category: "disease", animal_type: "goat", summary: "Viral disease affecting goats and sheep", content: "PPR causes fever, mouth sores, diarrhea, and pneumonia in goats. Mortality rate 50-80% in naive populations. Vaccinate annually with live attenuated vaccine. Supportive care with antibiotics for secondary infections." },
  { id: "l4", title: "Duck Plague (Duck Viral Enteritis)", category: "disease", animal_type: "duck", summary: "Acute contagious herpesvirus infection of ducks", content: "Duck plague causes sudden death, bloody diarrhea, nasal discharge. Vaccinate at 8 weeks. Isolate sick birds. Clean water sources regularly to prevent spread." },
  { id: "l5", title: "Poultry Vaccination Schedule", category: "vaccination", animal_type: "chicken", summary: "Complete vaccination timeline for broilers and layers", content: "Day 1: Marek's disease. Day 5: Newcastle B1 (eye drop). Day 7: IBD intermediate. Day 14: IBD intermediate booster. Day 21: Newcastle La Sota. Week 6: Fowl pox. Week 8: Newcastle R2B (for layers). Repeat La Sota every 2 months for layers." },
  { id: "l6", title: "Cattle Vaccination Schedule", category: "vaccination", animal_type: "cow", summary: "Essential vaccines for dairy and beef cattle", content: "3 months: FMD first dose. 4 months: Anthrax. 6 months: FMD booster. Every 6 months: FMD repeat. Annually: BQ (Black Quarter), HS (Hemorrhagic Septicemia). Before breeding: Brucellosis (heifers only)." },
  { id: "l7", title: "Broiler Feed Management", category: "feeding", animal_type: "chicken", summary: "Feeding schedule and nutrition for broiler chickens", content: "Starter feed (0-14 days): 23% protein, 3000 kcal/kg. Grower feed (15-28 days): 21% protein, 3100 kcal/kg. Finisher feed (29-42 days): 19% protein, 3200 kcal/kg. Ensure clean water 24/7. Feed conversion ratio target: 1.6-1.8." },
  { id: "l8", title: "Dairy Cow Nutrition", category: "feeding", animal_type: "cow", summary: "Balanced diet for optimal milk production", content: "Dry matter intake: 3-4% of body weight. Roughage: 60-70% of diet (green grass, straw, silage). Concentrate: 1 kg per 2.5 liters milk produced. Add mineral mix 50g/day. Clean water: 80-100 liters/day for high-yielding cows." },
  { id: "l9", title: "Common Poultry Medicines", category: "medicine", animal_type: "chicken", summary: "Essential medicines for poultry farming", content: "Antibiotics: Enrofloxacin (respiratory), Oxytetracycline (general), Amoxicillin (gut). Coccidiostats: Amprolium, Toltrazuril. Vitamins: AD3E for stress, B-complex for growth. Electrolytes for dehydration. Liver tonics for better FCR." },
  { id: "l10", title: "Goat Health Management", category: "medicine", animal_type: "goat", summary: "Common medicines and health practices for goats", content: "Deworming: Albendazole every 3 months. External parasites: Ivermectin injection. Bloat: Mineral oil drench. Pneumonia: Oxytetracycline. Foot rot: Copper sulphate foot bath. Always maintain dry, clean housing." },
  { id: "l11", title: "Turkey Management Guide", category: "feeding", animal_type: "turkey", summary: "Feeding and care essentials for turkey farming", content: "Turkey poults need 28% protein starter feed for first 8 weeks. Reduce to 22% grower feed until 14 weeks. Finisher at 18% protein. Turkeys need more space than chickens — 3-4 sq ft per bird. Susceptible to Blackhead disease — avoid contact with chickens." },
  { id: "l12", title: "Pigeon Care Basics", category: "feeding", animal_type: "pigeon", summary: "Basic nutrition and housing for pigeon farming", content: "Feed mix: 50% grains (wheat, corn, peas), 30% seeds, 20% pellets. Provide grit and calcium separately. Fresh water twice daily. Loft should have ventilation and nesting boxes. Vaccinate against PMV (Pigeon Paramyxovirus) annually." },
];

const categoryIcons: Record<string, React.ElementType> = { disease: Bug, medicine: Pill, vaccination: Syringe, feeding: Wheat };

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  disease: { color: "#F43F5E", bg: "#F43F5E1A" },
  medicine: { color: "#0EA5E9", bg: "#0EA5E91A" },
  vaccination: { color: "#F43F5E", bg: "#F43F5E1A" },
  feeding: { color: "#10B981", bg: "#10B9811A" },
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  disease: "linear-gradient(to right, #F43F5E, #F97316)",
  medicine: "linear-gradient(to right, #0EA5E9, #12C2D6)",
  vaccination: "linear-gradient(to right, #F43F5E, #0EA5E9)",
  feeding: "linear-gradient(to right, #10B981, #F59E0B)",
};

export default function LearningCenter() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [animalFilter, setAnimalFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dbGuides, setDbGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuides = async () => {
      const { data } = await api
        .from("learning_guides")
        .select("id, title, summary, content, category, animal_type")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setDbGuides((data as Guide[]) || []);
      setLoading(false);
    };
    fetchGuides();
  }, []);

  // DB guides first, then static fallbacks
  const allGuides = [...dbGuides, ...STATIC_GUIDES];

  const filtered = allGuides.filter(g => {
    if (category !== "all" && g.category !== category) return false;
    if (animalFilter !== "all" && g.animal_type !== animalFilter) return false;
    if (search && !g.title.toLowerCase().includes(search.toLowerCase()) && !g.summary.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold" style={{ color: "#F97316" }}>Learning Center</h1>
        <p className="text-muted-foreground mt-1">Guides on diseases, medicines, vaccines and feeding</p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search guides..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="disease" className="text-xs">Diseases</TabsTrigger>
            <TabsTrigger value="medicine" className="text-xs">Medicines</TabsTrigger>
            <TabsTrigger value="vaccination" className="text-xs">Vaccines</TabsTrigger>
            <TabsTrigger value="feeding" className="text-xs">Feeding</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={animalFilter} onValueChange={setAnimalFilter}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all" className="text-xs">All Animals</TabsTrigger>
          <TabsTrigger value="chicken" className="text-xs">🐔 Chicken</TabsTrigger>
          <TabsTrigger value="duck" className="text-xs">🦆 Duck</TabsTrigger>
          <TabsTrigger value="turkey" className="text-xs">🦃 Turkey</TabsTrigger>
          <TabsTrigger value="cow" className="text-xs">🐄 Cow</TabsTrigger>
          <TabsTrigger value="goat" className="text-xs">🐐 Goat</TabsTrigger>
          <TabsTrigger value="pigeon" className="text-xs">🕊️ Pigeon</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((g, i) => {
          const Icon = categoryIcons[g.category] || BookOpen;
          const isExpanded = expanded === g.id;
          const catColor = CATEGORY_COLORS[g.category] || { color: "#888", bg: "#8881A" };
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer overflow-hidden" onClick={() => setExpanded(isExpanded ? null : g.id)}>
                <div className="h-1" style={{ background: CATEGORY_GRADIENTS[g.category] || "#888" }} />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: catColor.bg }}>
                      <Icon className="h-5 w-5" style={{ color: catColor.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-foreground">{g.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{g.summary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="border-0" style={{ backgroundColor: catColor.bg, color: catColor.color }}>{g.category}</Badge>
                    <Badge variant="outline" className="capitalize">{g.animal_type}</Badge>
                  </div>
                  {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-3 border-t border-border">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{g.content}</p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {!loading && filtered.length === 0 && <p className="text-center text-muted-foreground py-12">No guides found</p>}
    </div>
  );
}
