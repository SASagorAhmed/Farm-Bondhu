import { api } from "@/api/client";

export type MediAppointmentRow = {
  id: string;
  patient_user_id?: string | null;
  doctor_id?: string | null;
  status?: string | null;
  consultation_type?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function isDev() {
  return typeof import.meta !== "undefined" && import.meta.env?.DEV;
}

function log(message: string, payload?: unknown) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.info(`[realtime] ${message}`, payload ?? "");
}

/**
 * Postgres realtime for `medibondhu_appointments` (human MediBondhu only).
 * Filter by patient auth user id and/or doctor profile pk (`medibondhu_doctors.id`).
 */
export function subscribeMediHumanAppointments(params: {
  channelKey: string;
  patientUserId?: string | null;
  doctorPk?: string | null;
  /** When set, only events for this appointment id are delivered (patient or doctor room). */
  appointmentId?: string | null;
  onEvent?: (eventType: "INSERT" | "UPDATE" | "DELETE", row: MediAppointmentRow) => void;
}): () => void {
  const { channelKey, patientUserId, doctorPk, appointmentId, onEvent } = params;
  const patientId = String(patientUserId || "").trim();
  const docPk = String(doctorPk || "").trim();
  const apptId = String(appointmentId || "").trim();
  if (!patientId && !docPk && !apptId) return () => {};

  const matches = (row: MediAppointmentRow) => {
    if (apptId && String(row.id || "") === apptId) return true;
    if (patientId && String(row.patient_user_id || "") === patientId) return true;
    if (docPk && String(row.doctor_id || "") === docPk) return true;
    return false;
  };

  const channel = api
    .channel(channelKey)
    .on("postgres_changes", { event: "*", schema: "public", table: "medibondhu_appointments" }, (payload) => {
      const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
      const row = (eventType === "DELETE" ? payload.old : payload.new) as MediAppointmentRow;
      if (!row?.id || !matches(row)) return;
      log(`${channelKey}:${eventType}`, row);
      onEvent?.(eventType, row);
    })
    .subscribe((status) => {
      log(`${channelKey}:status`, status);
    });

  log(`${channelKey}:subscribed`);

  return () => {
    log(`${channelKey}:unsubscribing`);
    void api.removeChannel(channel);
  };
}

/** @deprecated Use {@link subscribeMediHumanAppointments} */
export function subscribeMediHumanAppointmentsLive(
  _supabaseClient: unknown,
  _channelName: string,
  _handler: (_payload: { event?: string; payload?: Record<string, unknown> }) => void,
): null {
  return null;
}
