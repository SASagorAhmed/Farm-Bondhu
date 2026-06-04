import { apiJson } from "@/api/client";

export type VetBondhuPendingReview = {
  booking_id: string;
  vet_name?: string | null;
  vet_mock_id?: string | null;
  vet_user_id?: string | null;
  animal_type?: string | null;
  symptoms?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export async function fetchVetBondhuPendingReviews(): Promise<VetBondhuPendingReview[]> {
  const { res, body } = await apiJson("/v1/vetbondhu/reviews/pending");
  if (!res.ok) throw new Error(String(body.error || "Failed to load VetBondhu review status"));
  return Array.isArray(body.data) ? (body.data as VetBondhuPendingReview[]) : [];
}

export async function submitVetBondhuReview(input: {
  bookingId: string;
  rating: number;
  comment?: string;
}) {
  const { res, body } = await apiJson("/v1/vetbondhu/reviews", {
    method: "POST",
    body: JSON.stringify({
      booking_id: input.bookingId,
      rating: input.rating,
      comment: input.comment || null,
    }),
  });
  if (!res.ok) throw new Error(String(body.error || "Failed to submit VetBondhu review"));
  return body.data as { review?: unknown; rating?: number; reviewCount?: number };
}

export type VetBondhuReviewSummary = {
  reviews: Array<{
    id: string;
    booking_id: string;
    rating: number;
    comment?: string | null;
    patient_name?: string | null;
    animal_type?: string | null;
    created_at?: string | null;
  }>;
  averageRating: number;
  reviewCount: number;
};

export async function fetchVetBondhuVetReviews(vetId: string): Promise<VetBondhuReviewSummary> {
  const { res, body } = await apiJson(`/v1/vetbondhu/vets/${vetId}/reviews?limit=5`);
  if (!res.ok) throw new Error(String(body.error || "Failed to load VetBondhu reviews"));
  const data = (body.data || {}) as Partial<VetBondhuReviewSummary>;
  return {
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    averageRating: Number(data.averageRating || 0),
    reviewCount: Number(data.reviewCount || 0),
  };
}
