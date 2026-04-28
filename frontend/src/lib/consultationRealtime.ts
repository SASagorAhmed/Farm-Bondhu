import { api } from "@/api/client";

type BookingRow = {
  id: string;
  patient_mock_id?: string | null;
  vet_user_id?: string | null;
  vet_mock_id?: string | null;
  created_at?: string;
  status?: string;
};

function isDev() {
  return typeof import.meta !== "undefined" && import.meta.env?.DEV;
}

function log(message: string, payload?: unknown) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.info(`[realtime] ${message}`, payload ?? "");
}

export function patchBookingList(
  prev: BookingRow[] | undefined,
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: BookingRow
) {
  const list = Array.isArray(prev) ? [...prev] : [];
  if (!row?.id) return list;
  const idx = list.findIndex((item) => item.id === row.id);

  if (eventType === "DELETE") {
    if (idx >= 0) list.splice(idx, 1);
    return list;
  }
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.unshift(row);

  list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return list;
}

export function subscribeConsultationBookings(params: {
  channelKey: string;
  userId?: string;
  participantIds?: Array<string | null | undefined>;
  onEvent?: (eventType: "INSERT" | "UPDATE" | "DELETE", row: BookingRow) => void;
}) {
  const { channelKey, userId, participantIds, onEvent } = params;
  if (!userId) return () => {};
  const identities = new Set(
    [userId, ...(participantIds || [])]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
  );
  const channel = api
    .channel(channelKey)
    .on("postgres_changes", { event: "*", schema: "public", table: "consultation_bookings" }, (payload) => {
      const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
      const row = (eventType === "DELETE" ? payload.old : payload.new) as BookingRow;
      if (!row) return;
      const isParticipant =
        identities.has(String(row.patient_mock_id || "")) ||
        identities.has(String(row.vet_user_id || "")) ||
        identities.has(String(row.vet_mock_id || ""));
      if (!isParticipant) return;
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
