import sql from "../db.js";

export class VetBondhuReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "VetBondhuReviewError";
    this.status = status;
  }
}

function parseRating(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function normalizeComment(value) {
  const text = value == null ? "" : String(value).trim();
  return text ? text.slice(0, 2000) : null;
}

async function loadBookingForPatientReview(bookingId, patientUserId) {
  const [booking] = await sql`
    select
      b.*,
      coalesce(b.vet_user_id, v.user_id, b.vet_mock_id) as computed_vet_user_id
    from consultation_bookings b
    left join vets v on v.id = b.vet_mock_id
    where b.id = ${bookingId}
    limit 1
  `;
  if (!booking) throw new VetBondhuReviewError("Consultation not found", 404);
  if (String(booking.patient_mock_id || "") !== String(patientUserId)) {
    throw new VetBondhuReviewError("Forbidden", 403);
  }
  if (String(booking.status || "") !== "completed") {
    throw new VetBondhuReviewError("Reviews are only allowed after completed consultations", 400);
  }
  const vetUserId = booking.computed_vet_user_id || booking.vet_user_id || booking.vet_mock_id;
  if (!vetUserId) throw new VetBondhuReviewError("Vet doctor could not be resolved", 400);
  return { ...booking, computed_vet_user_id: vetUserId };
}

export async function recomputeVetBondhuRating({ vetUserId, vetMockId }) {
  const [agg] = await sql`
    select
      coalesce(avg(rating)::numeric, 0) as avg_rating,
      count(*)::int as rating_count
    from vetbondhu_consultation_reviews
    where deleted_at is null
      and (
        (${vetUserId ? sql`vet_user_id = ${vetUserId}` : sql`false`})
        or (${vetMockId ? sql`vet_mock_id = ${vetMockId}` : sql`false`})
      )
  `;
  const rating = Math.round(Number(agg?.avg_rating || 0) * 10) / 10;
  const count = Number(agg?.rating_count || 0);

  await sql`
    update vets
    set rating = ${rating}, updated_at = now()
    where (${vetUserId ? sql`user_id = ${vetUserId}` : sql`false`})
       or (${vetMockId ? sql`id = ${vetMockId}` : sql`false`})
  `;

  return { rating, reviewCount: count };
}

export async function createVetBondhuReview({ userId, bookingId, rating, comment }) {
  if (!bookingId) throw new VetBondhuReviewError("booking_id is required", 400);
  const parsedRating = parseRating(rating);
  if (parsedRating == null) throw new VetBondhuReviewError("rating must be an integer from 1 to 5", 400);
  const booking = await loadBookingForPatientReview(bookingId, userId);

  const [existing] = await sql`
    select id from vetbondhu_consultation_reviews
    where booking_id = ${booking.id} and deleted_at is null
    limit 1
  `;
  if (existing) throw new VetBondhuReviewError("You already reviewed this consultation", 409);

  const [created] = await sql`
    insert into vetbondhu_consultation_reviews (
      booking_id,
      patient_user_id,
      vet_user_id,
      vet_mock_id,
      rating,
      comment,
      created_at,
      updated_at
    ) values (
      ${booking.id},
      ${userId},
      ${booking.computed_vet_user_id},
      ${booking.vet_mock_id || null},
      ${parsedRating},
      ${normalizeComment(comment)},
      now(),
      now()
    )
    returning *
  `;
  const aggregates = await recomputeVetBondhuRating({
    vetUserId: booking.computed_vet_user_id,
    vetMockId: booking.vet_mock_id || null,
  });
  return { review: created, ...aggregates };
}

export async function getVetBondhuReviewStatus(userId, bookingId) {
  if (!bookingId) throw new VetBondhuReviewError("booking_id is required", 400);
  const booking = await loadBookingForPatientReview(bookingId, userId);
  const [review] = await sql`
    select id, rating, comment, created_at
    from vetbondhu_consultation_reviews
    where booking_id = ${booking.id} and deleted_at is null
    limit 1
  `;
  return {
    booking_id: booking.id,
    canReview: !review,
    alreadyReviewed: Boolean(review),
    reviewId: review?.id || null,
    review: review || null,
  };
}

export async function listPendingVetBondhuReviews(userId) {
  const rows = await sql`
    select
      b.id as booking_id,
      b.vet_name,
      b.vet_mock_id,
      coalesce(b.vet_user_id, v.user_id, b.vet_mock_id) as vet_user_id,
      b.animal_type,
      b.symptoms,
      b.completed_at,
      b.created_at
    from consultation_bookings b
    left join vets v on v.id = b.vet_mock_id
    left join vetbondhu_consultation_reviews r
      on r.booking_id = b.id and r.deleted_at is null
    where b.patient_mock_id = ${userId}
      and b.status = 'completed'
      and r.id is null
    order by coalesce(b.completed_at, b.updated_at, b.created_at) desc
    limit 100
  `;
  return rows;
}

export async function listVetBondhuReviewsForVet(vetId, { limit = 20, offset = 0 } = {}) {
  const rows = await sql`
    select
      r.id,
      r.booking_id,
      r.rating,
      r.comment,
      r.created_at,
      p.name as patient_name,
      b.animal_type
    from vetbondhu_consultation_reviews r
    left join profiles p on p.id = r.patient_user_id
    left join consultation_bookings b on b.id = r.booking_id
    where r.deleted_at is null
      and (r.vet_mock_id = ${vetId} or r.vet_user_id = ${vetId})
    order by r.created_at desc
    offset ${offset}
    limit ${limit}
  `;
  const [agg] = await sql`
    select
      coalesce(avg(rating)::numeric, 0) as average_rating,
      count(*)::int as review_count
    from vetbondhu_consultation_reviews
    where deleted_at is null
      and (vet_mock_id = ${vetId} or vet_user_id = ${vetId})
  `;
  return {
    reviews: rows,
    averageRating: Math.round(Number(agg?.average_rating || 0) * 10) / 10,
    reviewCount: Number(agg?.review_count || 0),
  };
}
