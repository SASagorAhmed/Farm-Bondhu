import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { getAnimalTypeLabel } from "@/lib/animalTypes";

interface Patient {
  patientId: string;
  patientName: string;
  consultationCount: number;
  lastVisit: string;
  animalTypes: string[];
}

function formatDateSafe(value: string | null | undefined, fallback = "Unknown date") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : format(date, "MMM dd, yyyy");
}

export default function VetPatients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await api
        .from("consultation_bookings")
        .select("patient_mock_id, patient_name, animal_type, created_at")
        .eq("vet_user_id", user.id)
        .in("status", ["completed", "in_progress"]);

      if (!data) { setLoading(false); return; }

      const map = new Map<string, Patient>();
      for (const row of data) {
        const existing = map.get(row.patient_mock_id);
        if (existing) {
          existing.consultationCount++;
          if (row.created_at > existing.lastVisit) existing.lastVisit = row.created_at;
          if (row.animal_type && !existing.animalTypes.includes(row.animal_type)) {
            existing.animalTypes.push(row.animal_type);
          }
        } else {
          map.set(row.patient_mock_id, {
            patientId: row.patient_mock_id,
            patientName: row.patient_name,
            consultationCount: 1,
            lastVisit: row.created_at,
            animalTypes: row.animal_type ? [row.animal_type] : [],
          });
        }
      }
      setPatients(Array.from(map.values()).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit)));
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Patients</h1>
        <p className="text-muted-foreground mt-1">Your patient history from completed consultations.</p>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Patient Records ({patients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : patients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No patient records yet. Complete consultations to see patients here.</p>
          ) : (
            <div className="space-y-3">
              {patients.map(p => (
                <div key={p.patientId} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="space-y-1">
                    <p className="font-medium">{p.patientName}</p>
                    <div className="flex gap-1 flex-wrap">
                      {p.animalTypes.map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{getAnimalTypeLabel(t) || t}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last visit: {formatDateSafe(p.lastVisit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{p.consultationCount}</p>
                    <p className="text-xs text-muted-foreground">visits</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
