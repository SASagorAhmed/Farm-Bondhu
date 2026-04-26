import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Clock, Plus, Trash2 } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Slot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  isNew?: boolean;
}

export default function VetAvailability() {
  const { user, session } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    const fetch = async () => {
      const { data } = await api
        .from("vet_availability")
        .select("*")
        .eq("user_id", session.user.id)
        .order("day_of_week")
        .order("start_time");
      setSlots((data as Slot[]) || []);
      setLoading(false);
    };
    fetch();
  }, [session]);

  const addSlot = (day: number) => {
    setSlots(prev => [...prev, { day_of_week: day, start_time: "09:00", end_time: "17:00", is_active: true, isNew: true }]);
  };

  const removeSlot = async (index: number) => {
    const slot = slots[index];
    if (slot.id) {
      await api.from("vet_availability").delete().eq("id", slot.id);
    }
    setSlots(prev => prev.filter((_, i) => i !== index));
    toast({ title: "Slot removed" });
  };

  const updateSlot = (index: number, field: keyof Slot, value: string | boolean) => {
    setSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const saveAll = async () => {
    if (!session) return;
    setSaving(true);
    try {
      // Delete all existing and re-insert
      await api.from("vet_availability").delete().eq("user_id", session.user.id);
      
      if (slots.length > 0) {
        const rows = slots.map(s => ({
          user_id: session.user.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          is_active: s.is_active,
        }));
        const { error } = await api.from("vet_availability").insert(rows);
        if (error) throw error;
      }
      toast({ title: "Availability saved!" });
      
      // Refetch
      const { data } = await api
        .from("vet_availability")
        .select("*")
        .eq("user_id", session.user.id)
        .order("day_of_week")
        .order("start_time");
      setSlots((data as Slot[]) || []);
    } catch (e: any) {
      toast({ title: "Error saving", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Availability</h1>
          <p className="text-muted-foreground mt-1">Set your weekly consultation schedule.</p>
        </div>
        <Button onClick={saveAll} disabled={saving}>
          {saving ? "Saving..." : "Save Schedule"}
        </Button>
      </motion.div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : (
        <div className="space-y-4">
          {DAYS.map((day, dayIndex) => {
            const daySlots = slots.map((s, i) => ({ ...s, _index: i })).filter(s => s.day_of_week === dayIndex);
            return (
              <Card key={day}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      {day}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => addSlot(dayIndex)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Slot
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  {daySlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No slots — day off</p>
                  ) : (
                    <div className="space-y-2">
                      {daySlots.map(slot => (
                        <div key={slot._index} className="flex items-center gap-3">
                          <Input
                            type="time"
                            value={slot.start_time}
                            onChange={e => updateSlot(slot._index, "start_time", e.target.value)}
                            className="w-32"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={slot.end_time}
                            onChange={e => updateSlot(slot._index, "end_time", e.target.value)}
                            className="w-32"
                          />
                          <Switch
                            checked={slot.is_active}
                            onCheckedChange={v => updateSlot(slot._index, "is_active", v)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeSlot(slot._index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
