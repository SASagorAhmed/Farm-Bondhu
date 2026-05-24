import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { UserRound, BadgeCheck, Upload, Loader2 } from "lucide-react";
import { MB } from "@/components/medibondhu/MediChrome";

type Spec = { id: string; name: string };
type Hosp = { id: string; name: string };

type DocRow = {
  type: string;
  url: string;
  public_id?: string;
  uploaded_at?: string;
};

type DocKind = "medical_degree" | "registration_certificate" | "cv" | "national_id" | "other";

const REQUIRED_DOCS: DocKind[] = ["medical_degree", "registration_certificate", "cv"];

const DOC_LABELS: Record<DocKind, string> = {
  medical_degree: "Medical degree / diploma certificate",
  registration_certificate: "Medical council / registration certificate",
  cv: "Curriculum vitae (CV)",
  national_id: "National ID / passport (optional)",
  other: "Other supporting document (optional)",
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(new Error("Could not read file"));
    fr.readAsDataURL(file);
  });
}

function normalizeDocs(raw: unknown): DocRow[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr.filter((x): x is DocRow => Boolean(x && typeof x === "object" && "type" in x && "url" in x));
}

type DoctorPrefill = {
  qualification?: string;
  medical_reg_number?: string;
  registration_body?: string;
  experience_years?: number;
  consultation_fee?: number;
};

type MediDoctorProfileSetupProps = {
  embedded?: boolean;
  hideDisplayNameField?: boolean;
};

export default function MediDoctorProfileSetup({ embedded = false, hideDisplayNameField = false }: MediDoctorProfileSetupProps = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const doctorPrefill = (location.state as { doctorPrefill?: DoctorPrefill } | null)?.doctorPrefill;

  const [fullName, setFullName] = useState("");
  const [qualification, setQualification] = useState("");
  const [medicalRegNumber, setMedicalRegNumber] = useState("");
  const [registrationBody, setRegistrationBody] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [fee, setFee] = useState("500");
  const [about, setAbout] = useState("");
  const [chamberAddress, setChamberAddress] = useState("");
  const [specId, setSpecId] = useState("");
  const [hospId, setHospId] = useState("");
  const [uploadingKind, setUploadingKind] = useState<DocKind | null>(null);

  const { data: me } = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorProfile(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Record<string, unknown> | null }>("/doctor/me");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data;
    },
  });

  useEffect(() => {
    if (hideDisplayNameField && user?.name) {
      setFullName(String(user.name));
    }
    if (me) {
      setFullName(String(me.full_name || user?.name || ""));
      setQualification(String(me.qualification || ""));
      setMedicalRegNumber(String(me.medical_reg_number || ""));
      setRegistrationBody(String(me.registration_body || ""));
      setExperienceYears(me.experience_years != null ? String(me.experience_years) : "");
      setFee(String(me.consultation_fee ?? "500"));
      setAbout(String(me.about || ""));
      setChamberAddress(String(me.chamber_address || ""));
      setSpecId(me.specialty_id ? String(me.specialty_id) : "");
      setHospId(me.hospital_id ? String(me.hospital_id) : "");
      return;
    }
    if (doctorPrefill) {
      setQualification((q) => q || doctorPrefill.qualification || "");
      setMedicalRegNumber((v) => v || doctorPrefill.medical_reg_number || "");
      setRegistrationBody((v) => v || doctorPrefill.registration_body || "");
      if (doctorPrefill.experience_years != null && Number.isFinite(Number(doctorPrefill.experience_years))) {
        setExperienceYears(String(doctorPrefill.experience_years));
      }
      if (doctorPrefill.consultation_fee != null && Number.isFinite(Number(doctorPrefill.consultation_fee))) {
        setFee(String(doctorPrefill.consultation_fee));
      }
    }
  }, [me, doctorPrefill]);

  const { data: specs = [] } = useQuery({
    queryKey: queryKeys().medibondhuHumanSpecialties(),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Spec[] }>("/specialties");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const { data: hospitals = [] } = useQuery({
    queryKey: ["medibondhu-human-hospitals-public"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Hosp[] }>("/hospitals");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const documents = useMemo(() => normalizeDocs(me?.verification_documents), [me?.verification_documents]);

  const missingRequiredDocs = useMemo(() => {
    const types = new Set(documents.map((d) => d.type));
    return REQUIRED_DOCS.filter((k) => !types.has(k));
  }, [documents]);

  const canSubmitReview =
    fullName.trim().length > 0 &&
    qualification.trim().length > 0 &&
    medicalRegNumber.trim().length > 0 &&
    Boolean(specId) &&
    missingRequiredDocs.length === 0 &&
    Number.isFinite(Number(experienceYears)) &&
    Number(experienceYears) >= 0;

  const uploadDoc = async (kind: DocKind, fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setUploadingKind(kind);
    try {
      const file_data = await readFileAsDataUrl(file);
      const { res, body } = await mediHumanJson("/doctor/verification/upload", {
        method: "POST",
        body: JSON.stringify({ file_data, document_type: kind }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      toast.success(`Uploaded ${DOC_LABELS[kind]}`);
      await qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorProfile(user?.id) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingKind(null);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const { res, body } = await mediHumanJson(`/doctor/profile`, {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          qualification,
          medical_reg_number: medicalRegNumber,
          registration_body: registrationBody || null,
          experience_years: Number(experienceYears) || 0,
          chamber_address: chamberAddress || null,
          consultation_fee: Number(fee) || 0,
          about,
          specialty_id: specId || null,
          hospital_id: hospId || null,
        }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Profile submitted for verification. Admin will review documents.");
      await qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorProfile(user?.id) });
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const status = me?.approval_status ? String(me.approval_status) : null;

  return (
    <div className={embedded ? "space-y-6" : "max-w-2xl mx-auto space-y-6"}>
      {!embedded && (
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Professional profile</p>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mt-1 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${MB}18` }}>
                <UserRound className="h-5 w-5" style={{ color: MB }} />
              </span>
              MediBondhu doctor verification
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Complete identity, regulatory details, and required documents so administrators can approve your practice on MediBondhu.
            </p>
          </div>
          {status && (
            <Badge variant="outline" className="rounded-full px-3 py-1 gap-1 w-fit capitalize shrink-0">
              <BadgeCheck className="h-3.5 w-3.5" />
              {status}
            </Badge>
          )}
        </header>
      )}

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
        <CardHeader>
          <CardTitle className="text-lg font-display">Identity</CardTitle>
          <CardDescription>How you introduce yourself on MediBondhu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hideDisplayNameField && (
            <div className="space-y-2">
              <Label htmlFor="dpi-name">Full name (as displayed)</Label>
              <Input id="dpi-name" className="rounded-xl" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. …" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="dpi-qual">Degrees & qualifications</Label>
            <Input id="dpi-qual" className="rounded-xl" value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="MBBS, FCPS (Medicine), etc." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dpi-reg">Medical registration number</Label>
              <Input
                id="dpi-reg"
                className="rounded-xl"
                value={medicalRegNumber}
                onChange={(e) => setMedicalRegNumber(e.target.value)}
                placeholder="e.g. BMDC registration ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dpi-exp">Years of clinical experience</Label>
              <Input
                id="dpi-exp"
                type="number"
                min={0}
                max={70}
                className="rounded-xl"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dpi-reg-body">
              Issuing council / registrar <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="dpi-reg-body"
              className="rounded-xl"
              value={registrationBody}
              onChange={(e) => setRegistrationBody(e.target.value)}
              placeholder="Bangladesh Medical and Dental Council, etc."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-display">Practice</CardTitle>
          <CardDescription>Specialty alignment and consultation pricing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Clinical specialty</Label>
            <Select value={specId || "none"} onValueChange={(v) => setSpecId(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select…</SelectItem>
                {specs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Hospital affiliation <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={hospId || "none"} onValueChange={(v) => setHospId(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select hospital" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Independent / not listed</SelectItem>
                {hospitals.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dpi-chamber">Chamber address <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="dpi-chamber"
              className="rounded-xl"
              value={chamberAddress}
              onChange={(e) => setChamberAddress(e.target.value)}
              placeholder="Where you see patients in person"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="dpi-fee">Consultation fee (৳)</Label>
            <Input id="dpi-fee" className="rounded-xl max-w-xs" type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-display">Verification documents</CardTitle>
          <CardDescription>PDF or clear photos. Each type may be replaced by uploading again.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(["medical_degree", "registration_certificate", "cv", "national_id"] as DocKind[]).map((kind) => {
            const uploaded = documents.find((d) => d.type === kind);
            const required = REQUIRED_DOCS.includes(kind);
            return (
              <div key={kind} className="flex flex-col gap-2 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">
                      {DOC_LABELS[kind]}
                      {required ? <span className="text-destructive"> *</span> : null}
                    </p>
                    {uploaded ? (
                      <a href={uploaded.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium underline" style={{ color: MB }}>
                        View uploaded file
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">No file uploaded</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="application/pdf,image/*"
                      className="cursor-pointer max-w-[240px]"
                      disabled={uploadingKind !== null}
                      onChange={(e) => void uploadDoc(kind, e.target.files)}
                    />
                    {uploadingKind === kind ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Upload className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                </div>
              </div>
            );
          })}
          {missingRequiredDocs.length > 0 && (
            <p className="text-sm text-muted-foreground">Still required before submit: {missingRequiredDocs.map((t) => DOC_LABELS[t]).join(", ")}.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-display">Narrative</CardTitle>
          <CardDescription>Short bio visible on your doctor profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="dpi-about">About you</Label>
            <Textarea id="dpi-about" rows={5} className="rounded-xl resize-none" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Clinical interests, languages spoken, outreach areas…" />
          </div>
          {!canSubmitReview && (
            <p className="text-sm text-muted-foreground">
              Fill identity, specialty, registration number, years of experience, all required uploads, then save for admin review.
            </p>
          )}
          <Button
            type="button"
            className="w-full h-11 rounded-xl text-white font-semibold"
            style={{ backgroundColor: MB }}
            disabled={save.isPending || !canSubmitReview}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save & submit for verification"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
