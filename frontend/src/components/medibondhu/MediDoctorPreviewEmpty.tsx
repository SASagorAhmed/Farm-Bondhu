import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";
import { MEDI_DOCTOR_ADMIN_PREVIEW_EMPTY } from "@/hooks/useMediDoctorPreviewActions";

interface Props {
  title?: string;
  hint?: string | null;
}

export default function MediDoctorPreviewEmpty({
  title = "No appointments in your queue",
  hint,
}: Props) {
  const message = hint || "When patients book your open slots, they will appear here with visit details.";
  return (
    <Card className="rounded-2xl border-dashed">
      <CardContent className="p-12 text-center space-y-3 max-w-md mx-auto">
        <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
