import { API_BASE, apiJson, readSession } from "@/api/client";

export type LearningCourse = {
  id: string;
  title: string;
  slug?: string;
  summary?: string;
  description?: string;
  category?: string;
  animal_type?: string;
  thumbnail_url?: string;
  access_type: "free" | "paid";
  price?: number | string;
  currency?: string;
  is_published?: boolean;
  sort_order?: number;
  video_count?: number;
  enrollment_status?: string | null;
  valid_until?: string | null;
  access_source?: string | null;
  can_play?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type LearningCourseVideo = {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  video_url?: string | null;
  cloudinary_public_id?: string | null;
  duration_seconds?: number;
  sort_order?: number;
  is_preview?: boolean;
  is_published?: boolean;
  created_at?: string;
};

export type LearningEnrollment = {
  id: string;
  course_id: string;
  user_id: string;
  status: "pending" | "active" | "expired" | "cancelled";
  access_source?: string;
  valid_until?: string | null;
  granted_by?: string | null;
  payment_status?: "unpaid" | "submitted" | "approved" | "rejected" | string;
  payment_method?: string | null;
  payment_reference?: string | null;
  payment_sender?: string | null;
  payment_amount?: number | string;
  payment_currency?: string | null;
  payment_note?: string | null;
  payment_submitted_at?: string | null;
  course_title?: string;
  course_price?: number | string;
  course_currency?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  created_at?: string;
};

export type LearningGuide = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  animal_type: string;
  is_published: boolean;
  created_at: string;
};

export type CourseDetail = {
  course: LearningCourse;
  videos: LearningCourseVideo[];
};

export type LearningPaymentPayload = {
  payment_method: string;
  payment_reference?: string;
  payment_sender: string;
  payment_note?: string;
};

type LearningVideoUploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { res, body } = await apiJson(path, init);
  if (!res.ok) throw new Error(String((body as { error?: unknown }).error || "Learning request failed"));
  return (body as { data: T }).data;
}

export const learningCourseKeys = {
  courses: ["learning-courses"] as const,
  myCourses: ["learning-courses", "mine"] as const,
  adminCourses: ["learning-courses", "admin"] as const,
  adminVideos: (courseId?: string) => ["learning-courses", "admin-videos", courseId || "all"] as const,
  adminEnrollments: ["learning-courses", "admin-enrollments"] as const,
};

export function fetchLearningCourses() {
  return request<LearningCourse[]>("/v1/learning/courses");
}

export function fetchMyLearningCourses() {
  return request<LearningCourse[]>("/v1/learning/courses/my");
}

export function fetchLearningCourseDetail(courseId: string) {
  return request<CourseDetail>(`/v1/learning/courses/${courseId}`);
}

export function enrollFreeCourse(courseId: string) {
  return request<LearningEnrollment>(`/v1/learning/courses/${courseId}/enroll-free`, { method: "POST" });
}

export function requestPaidCourseAccess(courseId: string, payload: LearningPaymentPayload) {
  return request<LearningEnrollment>(`/v1/learning/courses/${courseId}/request-access`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminLearningCourses() {
  return request<LearningCourse[]>("/v1/learning/admin/courses");
}

export function fetchAdminLearningGuides() {
  return request<LearningGuide[]>("/v1/learning/admin/guides");
}

export function saveAdminLearningGuide(payload: Partial<LearningGuide> & { id?: string }) {
  const { id, ...body } = payload;
  return request<LearningGuide>(id ? `/v1/learning/admin/guides/${id}` : "/v1/learning/admin/guides", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAdminLearningGuide(guideId: string) {
  return request<null>(`/v1/learning/admin/guides/${guideId}`, { method: "DELETE" });
}

export function saveAdminLearningCourse(payload: Partial<LearningCourse> & { id?: string }) {
  const { id, ...body } = payload;
  return request<LearningCourse>(id ? `/v1/learning/admin/courses/${id}` : "/v1/learning/admin/courses", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAdminLearningCourse(courseId: string) {
  return request<null>(`/v1/learning/admin/courses/${courseId}`, { method: "DELETE" });
}

export function fetchAdminLearningVideos(courseId?: string) {
  const q = courseId ? `?course_id=${encodeURIComponent(courseId)}` : "";
  return request<LearningCourseVideo[]>(`/v1/learning/admin/videos${q}`);
}

export function saveAdminLearningVideo(payload: Partial<LearningCourseVideo> & { id?: string }) {
  const { id, ...body } = payload;
  return request<LearningCourseVideo>(id ? `/v1/learning/admin/videos/${id}` : "/v1/learning/admin/videos", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAdminLearningVideo(videoId: string) {
  return request<null>(`/v1/learning/admin/videos/${videoId}`, { method: "DELETE" });
}

export function reorderAdminLearningVideos(items: Array<{ id: string; sort_order: number }>) {
  return request<null>("/v1/learning/admin/videos/reorder", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function uploadLearningVideo(fileData: string) {
  return request<{ url: string; publicId: string }>("/v1/learning/admin/videos/upload", {
    method: "POST",
    body: JSON.stringify({ fileData }),
  });
}

export function getLearningVideoUploadSignature() {
  return request<LearningVideoUploadSignature>("/v1/learning/admin/videos/upload-signature", {
    method: "POST",
  });
}

export async function uploadLearningVideoFile(file: File, onProgress?: (percent: number) => void): Promise<{ url: string; publicId: string }> {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/v1/learning/admin/videos/upload-file`);
    const token = readSession()?.access_token;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error(`Cannot reach the backend upload endpoint (${API_BASE}). If you opened the app from a LAN URL, CORS must allow that origin.`));
    xhr.onload = () => {
      let body: { data?: { url?: string; publicId?: string }; error?: string | { message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText || "{}") as typeof body;
      } catch {
        body = {};
      }
      if (xhr.status < 200 || xhr.status >= 300 || !body.data?.url) {
        const errorMessage = typeof body.error === "string" ? body.error : body.error?.message;
        reject(new Error(errorMessage || "Video upload failed on the server."));
        return;
      }
      onProgress?.(100);
      resolve({ url: String(body.data.url), publicId: String(body.data.publicId || "") });
    };
    xhr.send(form);
  });
}

export function uploadLearningThumbnail(fileData: string) {
  return request<{ url: string; publicId: string }>("/v1/learning/admin/courses/upload-thumbnail", {
    method: "POST",
    body: JSON.stringify({ fileData }),
  });
}

export function fetchAdminLearningEnrollments() {
  return request<LearningEnrollment[]>("/v1/learning/admin/enrollments");
}

export function grantLearningEnrollment(payload: {
  course_id: string;
  user_id: string;
  valid_until?: string | null;
  status?: string;
}) {
  return request<LearningEnrollment>("/v1/learning/admin/enrollments", {
    method: "POST",
    body: JSON.stringify({ status: "active", access_source: "admin_grant", ...payload }),
  });
}

export function updateLearningEnrollment(enrollmentId: string, payload: Partial<LearningEnrollment>) {
  return request<LearningEnrollment>(`/v1/learning/admin/enrollments/${enrollmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
