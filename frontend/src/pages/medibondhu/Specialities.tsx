import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys, moduleCachePolicy } from "@/lib/queryClient";
import { Search, Stethoscope, Star, Clock, ChevronRight, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { MediHero, MediTrustStrip, MediSectionTitle, MediQuickLinks, MB } from "@/components/medibondhu/MediChrome";

type Specialty = { id: string; name: string; slug: string; sort_order: number };

export default function Specialities() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: specialties = [] } = useQuery({
    queryKey: queryKeys().medibondhuHumanSpecialties(),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Specialty[] }>("/specialties");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
    staleTime: moduleCachePolicy.vet.staleTime,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorsPreview(user?.id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: unknown[] }>("/doctors?limit=60");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.vet.staleTime,
  });

  const handleSearch = () => {
    if (search.trim()) navigate(`/medibondhu/doctors?q=${encodeURIComponent(search.trim())}`);
    else navigate("/medibondhu/doctors");
  };

  const availableDoctors = doctors.filter((doc) => Boolean((doc as { can_book?: unknown }).can_book)).length;

  return (
    <div className="space-y-8">
      <MediHero
        title="Talk to a doctor, on your schedule"
        subtitle="Find verified doctors by name or specialty, review consultation details, and book an appointment at a time that works for you."
      >
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="specialitiesSearch"
              name="specialitiesSearch"
              placeholder="e.g. Cardiologist, Dr. Rashid…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-11 h-12 rounded-xl text-base shadow-inner bg-background border-input"
            />
          </div>
          <Button
            type="button"
            size="lg"
            className="h-12 px-8 rounded-xl text-white font-semibold shrink-0"
            style={{ backgroundColor: MB }}
            onClick={handleSearch}
          >
            <Search className="h-4 w-4 mr-2" />
            Search doctors
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 px-8 rounded-xl font-semibold shrink-0"
            style={{ borderColor: `${MB}66`, color: MB }}
            onClick={() => navigate("/medibondhu/doctors?available=true")}
          >
            <Clock className="h-4 w-4 mr-2" />
            Available doctors
          </Button>
        </div>
        <MediQuickLinks
          onDoctors={() => navigate("/medibondhu/doctors")}
          onAppointments={() => navigate("/medibondhu/consultations")}
          onPrescriptions={() => navigate("/medibondhu/prescriptions")}
        />
      </MediHero>

      <MediTrustStrip />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Doctors listed" value={doctors.length} icon={<UserRound className="h-5 w-5" />} iconColor={MB} index={0} />
        <StatCard title="Specialties" value={specialties.length} icon={<Stethoscope className="h-5 w-5" />} iconColor={MB} index={1} />
        <StatCard title="Available now" value={availableDoctors} icon={<Clock className="h-5 w-5" />} iconColor={MB} index={2} />
        <StatCard title="Self-service booking" value="Yes" icon={<Clock className="h-5 w-5" />} iconColor={MB} index={3} />
      </div>
      <p className="text-xs text-muted-foreground -mt-4">Ratings and reviews will appear as more patients complete visits on MediBondhu.</p>

      <section>
        <MediSectionTitle
          eyebrow="Browse by specialty"
          title="Find the right clinician"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full" style={{ borderColor: `${MB}66`, color: MB }} onClick={() => navigate("/medibondhu/doctors?available=true")}>
                Available
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" style={{ borderColor: MB, color: MB }} onClick={() => navigate("/medibondhu/doctors")}>
                View all
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {specialties.map((sp, i) => (
            <motion.div key={sp.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.02 }}>
              <Card
                className="group overflow-hidden border-border hover:shadow-md transition-shadow cursor-pointer h-full"
                onClick={() => navigate(`/medibondhu/doctors?specialty_id=${encodeURIComponent(sp.id)}`)}
              >
                <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-lg text-foreground leading-tight group-hover:underline underline-offset-2">{sp.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">{sp.slug.replace(/-/g, " ")}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform" style={{ color: MB }} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 flex-1">See doctors with this specialty and available slots.</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        {!specialties.length && <p className="text-center text-muted-foreground py-10">No specialties loaded — check your connection or try again later.</p>}
      </section>
    </div>
  );
}
