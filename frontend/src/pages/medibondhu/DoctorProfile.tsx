import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, GraduationCap, Calendar, ArrowLeft, Clock, Video, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys, moduleCachePolicy } from "@/lib/queryClient";
import { MB } from "@/components/medibondhu/MediChrome";

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: doc, isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorDetail(id),
    enabled: Boolean(id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Record<string, unknown> }>(`/doctors/${id}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data;
    },
    staleTime: moduleCachePolicy.vet.staleTime,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-9 w-32" />
        <Card className="rounded-xl overflow-hidden">
          <Skeleton className="h-2 w-full rounded-none" style={{ backgroundColor: `${MB}50` }} />
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-64 max-w-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <p className="font-semibold text-foreground">Doctor not found</p>
        <p className="text-sm text-muted-foreground mt-2">This profile may be unavailable or the link is incorrect.</p>
        <Button type="button" className="mt-6" variant="outline" onClick={() => navigate("/medibondhu/doctors")}>
          Back to directory
        </Button>
      </div>
    );
  }

  const fullName = String(doc.full_name || "Doctor");
  const specialty = String(doc.specialty_name || "");
  const fee = Number(doc.consultation_fee ?? 0);
  const avail = Boolean(doc.is_available ?? true);
  const online = Boolean(doc.online_consultation);
  const chamber = Boolean(doc.chamber_consultation);
  const offersBooking = online || chamber;
  const canBook = avail && offersBooking;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button type="button" variant="ghost" className="gap-2 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl overflow-hidden border-border shadow-md">
          <div className="h-1.5 w-full" style={{ backgroundColor: MB }} />
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
              <div className="h-28 w-28 rounded-2xl overflow-hidden flex items-center justify-center text-4xl shrink-0 bg-muted mx-auto sm:mx-0 ring-4 ring-cyan-500/10">
                {doc.profile_photo_url ? (
                  <img src={String(doc.profile_photo_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>🩺</span>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{fullName}</h1>
                    <p className="text-base font-medium mt-1" style={{ color: MB }}>
                      {specialty || "General physician"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={avail ? "border-emerald-500/40 text-emerald-800 dark:text-emerald-200 self-center sm:self-start" : "self-center sm:self-start opacity-80"}
                  >
                    {avail ? "Accepting appointments" : "Not available"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground inline-flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  {String(doc.qualification || "MBBS")}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4" style={{ fill: MB, color: MB }} />
                    {Number(doc.rating_avg ?? 0)} rating
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {Number(doc.experience_years ?? 0)} years experience
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-2">
                  {online && (
                    <Badge variant="secondary" className="rounded-md gap-1 font-normal">
                      <Video className="h-3 w-3" /> Online visits
                    </Badge>
                  )}
                  {chamber && (
                    <Badge variant="secondary" className="rounded-md gap-1 font-normal">
                      <Building2 className="h-3 w-3" /> Chamber visits
                    </Badge>
                  )}
                  {doc.has_open_slots === true && (
                    <Badge variant="outline" className="rounded-md gap-1 font-normal border-emerald-500/40 text-emerald-800 dark:text-emerald-200">
                      Open times listed
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Practice & location</h2>
              {(doc.hospital_name || doc.chamber_address) ? (
                <p className="text-sm text-foreground inline-flex gap-2 items-start">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" style={{ color: MB }} />
                  <span>{String(doc.chamber_address || doc.hospital_name || "")}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Location details on request or at booking.</p>
              )}
            </div>

            {doc.about ? (
              <>
                <Separator />
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{String(doc.about)}</p>
                </div>
              </>
            ) : null}

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border bg-muted/30 p-4 text-center sm:text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consultation fee</p>
                <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: MB }}>
                  ৳{fee}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4 text-center sm:text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Experience</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">{Number(doc.experience_years ?? 0)} yrs</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4 text-center sm:text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Patient rating</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">{Number(doc.rating_avg ?? 0)}</p>
              </div>
            </div>

            <Button
              type="button"
              className="w-full h-12 rounded-xl text-base font-semibold text-white"
              style={{ backgroundColor: MB }}
              disabled={!canBook}
              onClick={() => navigate(`/medibondhu/book/${id}`)}
            >
              <Calendar className="h-5 w-5 mr-2" /> Book appointment · ৳{fee}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
