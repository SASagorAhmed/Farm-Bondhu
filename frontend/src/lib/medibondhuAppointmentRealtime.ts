/**
 * MediBondhu human appointments — isolated realtime hook (names only).
 * v1 teleconsult uses TanStack Query refetch/polling on the room page plus route invalidations instead of wiring this stub.
 * VetBondhu uses {@link ./vetbondhuConsultationRealtime}.
 */
export function subscribeMediHumanAppointmentsLive(
  _supabaseClient: unknown,
  _channelName: string,
  _handler: (_payload: { event?: string; payload?: Record<string, unknown> }) => void,
): null {
  return null;
}
