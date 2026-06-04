import sql from "../db.js";

function toText(value, fallback = "") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => toText(value)).filter(Boolean)));
}

async function resolveVetNotificationUserId(booking) {
  const directCandidates = uniqueStrings([booking?.vet_user_id, booking?.computed_vet_user_id]);
  if (directCandidates.length) {
    const [profile] = await sql`
      select id from profiles
      where id in ${sql(directCandidates)}
      limit 1
    `;
    if (profile?.id) return profile.id;
  }

  const vetCandidates = uniqueStrings([
    booking?.vet_user_id,
    booking?.computed_vet_user_id,
    booking?.vet_id,
    booking?.vet_mock_id,
  ]);
  if (!vetCandidates.length) return null;

  const [vet] = await sql`
    select user_id
    from vets
    where (id in ${sql(vetCandidates)} or user_id in ${sql(vetCandidates)})
      and user_id is not null
    order by
      case
        when user_id in ${sql(directCandidates.length ? directCandidates : vetCandidates)} then 0
        else 1
      end
    limit 1
  `;
  return vet?.user_id || null;
}

export async function createVetBondhuNotification({
  userId,
  title,
  message,
  link,
  context = "vetbondhu",
  priority = "normal",
}) {
  if (!userId) return null;
  const actionUrl = toText(link, null);
  const row = {
    user_id: userId,
    type: "vet",
    context,
    priority,
    title: toText(title, "VetBondhu update"),
    message: toText(message, "You have a new VetBondhu update."),
    link: actionUrl,
    action_url: actionUrl,
    read: false,
    created_at: new Date().toISOString(),
  };

  try {
    const [created] = await sql`
      insert into notifications ${sql(row)}
      returning *
    `;
    return created || null;
  } catch (err) {
    console.error("[vetbondhuNotifications] insert failed:", err?.message || err);
    return null;
  }
}

export async function notifyVetBookingCreated(booking) {
  const vetUserId = await resolveVetNotificationUserId(booking);
  if (!vetUserId) {
    console.warn("[vetbondhuNotifications] booking notification skipped: vet user not resolved", {
      bookingId: booking?.id,
      vetId: booking?.vet_id,
      vetMockId: booking?.vet_mock_id,
      vetUserId: booking?.vet_user_id,
    });
    return null;
  }
  const patientName = toText(booking?.patient_name, "A patient");
  const animalType = toText(booking?.animal_type, "animal");
  const schedule = [booking?.scheduled_date, booking?.scheduled_time].filter(Boolean).join(" ");
  const scheduleText = schedule ? ` Scheduled: ${schedule}.` : "";

  return createVetBondhuNotification({
    userId: vetUserId,
    context: "vet",
    title: "New VetBondhu booking",
    message: `${patientName} booked a ${toText(booking?.consultation_method, "consultation")} consultation for ${animalType}.${scheduleText}`,
    link: "/vet/consultations",
    priority: "high",
  });
}

export async function notifyPatientPrescriptionIssued(prescription) {
  const patientUserId = prescription?.farmer_user_id || prescription?.patient_mock_id;
  if (!patientUserId) return null;
  const vetName = toText(prescription?.vet_name, "Your vet doctor");
  const animalType = toText(prescription?.animal_type, "your animal");

  return createVetBondhuNotification({
    userId: patientUserId,
    context: "vetbondhu",
    title: "Prescription ready",
    message: `${vetName} issued a prescription for ${animalType}.`,
    link: "/vetbondhu/prescriptions",
    priority: "normal",
  });
}
