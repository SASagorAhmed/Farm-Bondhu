import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/api/client";
import { Warehouse, PawPrint, Loader2, Shield, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

export default function AdminFarms() {
  const queryClient = useQueryClient();

  const { data: dataBundle, isLoading: loading } = useQuery({
    queryKey: queryKeys().adminFarmsOverview(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const [farmsRes, animalsRes] = await Promise.all([
        api.from("farms").select("*").order("created_at", { ascending: false }),
        api.from("animals").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      return { farms: farmsRes.data || [], animals: animalsRes.data || [] };
    },
  });

  const farms = dataBundle?.farms || [];
  const animals = dataBundle?.animals || [];

  useEffect(() => {
    const channels = ["farms", "animals"].map((table) =>
      api
        .channel(`admin-farms-live-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys().adminFarmsOverview() });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient]);

  const totalFarms = farms.length;
  const totalAnimals = farms.reduce((s, f) => s + (f.total_animals || 0), 0);
  const totalSheds = farms.reduce((s, f) => s + (f.sheds || 0), 0);
  const animalRecords = animals.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.admin}, #7c3aed)` }}>
          <Warehouse className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Farms Overview</h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin View
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Platform-wide farm and livestock monitoring</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Farms", value: totalFarms, icon: Warehouse, color: ICON_COLORS.farm },
          { label: "Total Animals", value: totalAnimals, icon: PawPrint, color: ICON_COLORS.animals },
          { label: "Total Sheds", value: totalSheds, icon: BarChart3, color: ICON_COLORS.dashboard },
          { label: "Animal Records", value: animalRecords, icon: PawPrint, color: ICON_COLORS.stethoscope },
        ].map(s => (
          <Card key={s.label} className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="farms">
        <TabsList>
          <TabsTrigger value="farms">All Farms ({totalFarms})</TabsTrigger>
          <TabsTrigger value="animals">Animal Records ({animalRecords})</TabsTrigger>
        </TabsList>

        <TabsContent value="farms">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
            <CardHeader><CardTitle className="text-lg">Registered Farms</CardTitle></CardHeader>
            <CardContent>
              {farms.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No farms registered yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Farm Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Sheds</TableHead>
                      <TableHead>Animals</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farms.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="capitalize">{f.type}</TableCell>
                        <TableCell>{f.location || "—"}</TableCell>
                        <TableCell>{f.sheds}</TableCell>
                        <TableCell>{f.total_animals}</TableCell>
                        <TableCell className="text-sm">{new Date(f.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="animals">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
            <CardHeader><CardTitle className="text-lg">Animal Records</CardTitle></CardHeader>
            <CardContent>
              {animals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No animal records yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name / Batch</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Breed</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {animals.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name || a.batch_id || "—"}</TableCell>
                        <TableCell className="capitalize">{a.type}</TableCell>
                        <TableCell>{a.breed || "—"}</TableCell>
                        <TableCell className="capitalize">{a.tracking_mode}</TableCell>
                        <TableCell>
                          <Badge variant={a.health_status === "healthy" ? "default" : "destructive"}>
                            {a.health_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{a.age || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
