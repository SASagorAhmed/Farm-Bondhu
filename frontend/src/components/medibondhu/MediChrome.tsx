import type { ReactNode } from "react";
import { ICON_COLORS } from "@/lib/iconColors";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Shield, Stethoscope } from "lucide-react";

/** MediBondhu human module brand accent (FarmBondhu cyan). */
export const MB = ICON_COLORS.medibondhu;

export function MediHero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-border overflow-hidden shadow-sm bg-gradient-to-br from-background via-background to-accent/30"
      style={{ borderTopColor: `${MB}55`, borderTopWidth: 4 }}
    >
      <div className="p-6 md:p-8 space-y-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MediBondhu · Human care</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight">{title}</h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MediTrustStrip() {
  const items = [
    { icon: Shield, label: "Platform-verified doctor profiles", sub: "Admin-reviewed practitioners" },
    { icon: Stethoscope, label: "Outpatient appointments", sub: "Book online or chamber slots" },
    { icon: CheckCircle2, label: "Structured prescriptions", sub: "Digital history in one place" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map(({ icon: Icon, label, sub }) => (
        <div
          key={label}
          className="rounded-xl border bg-card px-4 py-3 flex gap-3 items-start"
          style={{ borderLeftWidth: 3, borderLeftColor: MB }}
        >
          <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: `${MB}18` }}>
            <Icon className="h-4 w-4" style={{ color: MB }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-snug">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MediSectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{eyebrow}</p>}
        <h2 className="text-xl font-display font-bold text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function MediQuickLinks({
  onDoctors,
  onAppointments,
  onPrescriptions,
}: {
  onDoctors: () => void;
  onAppointments: () => void;
  onPrescriptions: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="rounded-full" style={{ borderColor: `${MB}66`, color: MB }} onClick={onDoctors}>
        Browse doctors
      </Button>
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onAppointments}>
        My appointments
      </Button>
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onPrescriptions}>
        Prescriptions
      </Button>
    </div>
  );
}

/** Visual treatment for human appointment status (patient/doctor lists). */
export function mediApptStatusClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30";
  if (s === "in_progress") return "bg-sky-500/15 text-sky-900 dark:text-sky-100 border-sky-500/30";
  if (s === "pending") return "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30";
  if (s === "completed") return "bg-slate-500/15 text-slate-800 dark:text-slate-100 border-slate-500/25";
  if (s === "cancelled" || s === "rejected") return "bg-red-500/10 text-red-800 dark:text-red-200 border-red-500/25";
  return "bg-accent text-accent-foreground border-border";
}

export function MediStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium border", mediApptStatusClass(status), className)}>
      {status}
    </Badge>
  );
}
