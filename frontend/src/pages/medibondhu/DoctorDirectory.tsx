import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, Star, MapPin, Calendar, Search, ArrowLeft, Video, Building2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys, moduleCachePolicy } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { MediSectionTitle, MB } from "@/components/medibondhu/MediChrome";
import { cn } from "@/lib/utils";

type DoctorRow = {
  id: string;
  full_name: string;
  qualification: string | null;
  experience_years: number;
  consultation_fee: number;
  chamber_address: string | null;
  specialty_name: string | null;
  hospital_name: string;
  rating_avg: number;
  is_available: boolean;
  /** True when at least one unbooked slot with future end exists (informational badge only). */
  has_open_slots?: boolean;
  profile_photo_url: string | null;
  online_consultation: boolean;
  chamber_consultation: boolean;
  is_online_now?: boolean;
  can_book?: boolean;
  availability_label?: string | null;
};

type Specialty = { id: string; name: string };

export default function DoctorDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const specialtyId = searchParams.get("specialty_id") || "";
  const availableOnly = searchParams.get("available") === "true";
  const [input, setInput] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(input.trim()), 400);
    return () => window.clearTimeout(id);
  }, [input]);

  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: specialties = [] } = useQuery({
    queryKey: queryKeys().medibondhuHumanSpecialties(),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Specialty[] }>("/specialties");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
    staleTime: moduleCachePolicy.vet.staleTime,
  });

  const specialtyName = useMemo(
    () => (specialtyId ? specialties.find((s) => s.id === specialtyId)?.name : null),
    [specialties, specialtyId],
  );

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "40");
    if (debouncedQ) p.set("q", debouncedQ);
    if (specialtyId) p.set("specialty_id", specialtyId);
    return p.toString();
  }, [debouncedQ, specialtyId]);

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctors(user?.id, debouncedQ, specialtyId),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: DoctorRow[] }>(`/doctors?${qs}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.vet.staleTime,
    /** Fresh `has_open_slots` after reload; avoid stale persisted cache disabling Book permanently. */
    refetchOnMount: "always",
  });

  const clearFilters = () => {
    setInput("");
    setDebouncedQ("");
    setSearchParams({});
  };

  const toggleAvailableOnly = () => {
    const next = new URLSearchParams(searchParams);
    if (availableOnly) next.delete("available");
    else next.set("available", "true");
    setSearchParams(next);
  };

  const doctorsForDisplay = useMemo(
    () => (availableOnly ? doctors.filter((doc) => doc.can_book === true) : doctors),
    [availableOnly, doctors],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => navigate("/medibondhu")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctor directory</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            {availableOnly ? "Available doctors" : "Find your doctor"}
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl">
            {availableOnly
              ? "Active MediBondhu doctors with open schedules, ready for booking now."
              : "Compare qualifications, consultation fees, and visit types (online or chamber). All listings use MediBondhu human profiles only."}
          </p>
          {(debouncedQ || specialtyId || availableOnly) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {availableOnly && (
                <Badge variant="secondary" className="rounded-full px-3">
                  Available now
                </Badge>
              )}
              {specialtyName && (
                <Badge variant="secondary" className="rounded-full px-3">
                  Specialty: {specialtyName}
                </Badge>
              )}
              {debouncedQ && (
                <Badge variant="secondary" className="rounded-full px-3">
                  Search: “{debouncedQ}”
                </Badge>
              )}
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-muted-foreground" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="border-border shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="doctorDirectorySearch"
                placeholder="Search by doctor name…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="pl-10 h-11 rounded-xl"
                aria-label="Search doctors"
              />
            </div>
            <Button
              type="button"
              variant={availableOnly ? "default" : "outline"}
              className="h-11 rounded-xl font-semibold"
              style={
                availableOnly
                  ? { backgroundColor: MB, color: "white", borderColor: MB }
                  : { borderColor: `${MB}66`, color: MB }
              }
              onClick={toggleAvailableOnly}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Available now
            </Button>
          </div>
        </CardContent>
      </Card>

      <MediSectionTitle
        eyebrow="Results"
        title={
          isLoading
            ? "Loading practitioners…"
            : `${doctorsForDisplay.length} doctor${doctorsForDisplay.length === 1 ? "" : "s"} ${availableOnly ? "available" : "found"}`
        }
      />

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden rounded-xl">
              <Skeleton className="h-1 w-full rounded-none" style={{ backgroundColor: `${MB}40` }} />
              <CardContent className="p-5 space-y-4">
                <div className="flex gap-3">
                  <Skeleton className="h-14 w-14 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {doctorsForDisplay.map((doc, i) => (
          <motion.article key={doc.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
            <Card className="h-full flex flex-col rounded-xl border-border hover:shadow-lg hover:border-transparent transition-all duration-200 overflow-hidden group">
              <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
              <CardContent className="p-5 flex flex-col flex-1 gap-4">
                <div className="flex gap-3">
                  <div className="h-14 w-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 ring-2 ring-cyan-500/25 ring-offset-2 ring-offset-background">
                    {doc.profile_photo_url ? (
                      <img src={doc.profile_photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Stethoscope className="h-7 w-7" style={{ color: MB }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-display font-bold text-base text-foreground leading-snug line-clamp-2">{doc.full_name}</h2>
                        <p className="text-sm font-medium mt-0.5" style={{ color: MB }}>
                          {doc.specialty_name || "General physician"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px] uppercase tracking-wide",
                          doc.can_book ? "border-cyan-500/40 text-cyan-700 dark:text-cyan-300" : "opacity-70",
                        )}
                      >
                        {doc.availability_label || (doc.can_book ? "Online" : "Offline")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{doc.qualification || "MBBS"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Rating</p>
                    <p className="font-semibold text-foreground inline-flex items-center justify-center gap-0.5">
                      <Star className="h-3 w-3" style={{ color: MB, fill: MB }} />
                      {doc.rating_avg ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Experience</p>
                    <p className="font-semibold text-foreground">{doc.experience_years}+ yrs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Fee</p>
                    <p className="font-semibold tabular-nums" style={{ color: MB }}>
                      ৳{Number(doc.consultation_fee ?? 0)}
                    </p>
                  </div>
                </div>

                {(doc.chamber_address || doc.hospital_name) && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5 line-clamp-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: MB }} />
                    {doc.chamber_address || doc.hospital_name}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {doc.online_consultation && (
                    <Badge variant="outline" className="text-[10px] rounded-md gap-1 font-normal border-border">
                      <Video className="h-3 w-3" /> Online
                    </Badge>
                  )}
                  {doc.chamber_consultation && (
                    <Badge variant="outline" className="text-[10px] rounded-md gap-1 font-normal border-border">
                      <Building2 className="h-3 w-3" /> Chamber
                    </Badge>
                  )}
                  {doc.has_open_slots === true && (
                    <Badge variant="outline" className="text-[10px] rounded-md gap-1 font-normal border-cyan-500/35 text-cyan-800 dark:text-cyan-200">
                      Times listed
                    </Badge>
                  )}
                  {doc.has_open_slots !== true && (
                    <Badge variant="outline" className="text-[10px] rounded-md gap-1 font-normal border-border text-muted-foreground">
                      No schedule
                    </Badge>
                  )}
                </div>

                {!doc.can_book && (
                  <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {doc.availability_label === "No schedule"
                      ? "Doctor has not published a future schedule yet."
                      : doc.availability_label === "Not accepting"
                        ? "Doctor is not accepting appointments right now."
                        : "Doctor is offline or has no visit type enabled."}
                  </p>
                )}

                <div className="flex gap-2 mt-auto pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg"
                    style={{ borderColor: `${MB}55`, color: MB }}
                    onClick={() => navigate(`/medibondhu/doctor/${doc.id}`)}
                  >
                    Profile
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 rounded-lg text-white font-medium"
                    style={{ backgroundColor: doc.can_book ? MB : "hsl(var(--muted-foreground))" }}
                    disabled={!doc.can_book}
                    onClick={() => navigate(`/medibondhu/book/${doc.id}`)}
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1.5" /> {doc.can_book ? "Book" : "Unavailable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.article>
        ))}
      </div>

      {!isLoading && doctorsForDisplay.length === 0 && (
        <Card className="rounded-xl border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <p className="font-medium text-foreground">
              {availableOnly ? "No active doctors are available right now" : "No doctors match your search"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {availableOnly
                ? "Try showing all doctors, or check again after doctors publish new MediBondhu schedules."
                : "Try another name, clear the specialty filter, or check back — new practitioners join as they are verified."}
            </p>
            <Button type="button" variant="outline" onClick={clearFilters}>
              {availableOnly ? "Show all doctors" : "Reset filters"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
