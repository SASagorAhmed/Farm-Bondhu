import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    name: "FarmBondhu API",
    version: 1,
    description:
      "Express API backed by PostgreSQL. Auth is local (email/password + OTP); Bearer tokens are HS256 JWTs from this API.",
    auth: {
      scheme: "Bearer",
      token: "Use the access_token returned by POST /api/v1/auth/sign-in or register/verify-otp.",
      header: "Authorization: Bearer <access_token>",
      serverEnv: ["DATABASE_URL", "AUTH_JWT_SECRET", "REGISTRATION_SECRET", "BREVO_API_KEY or SMTP_*", "MAIL_FROM"],
    },
    implemented: {
      me: ["GET /api/v1/me"],
      farms: ["GET", "POST", "PATCH /:id", "DELETE /:id"],
      animals: ["GET", "POST", "PATCH /:id", "DELETE /:id"],
      sheds: ["GET", "POST", "PATCH /:id", "DELETE /:id"],
    },
    next: [
      "profiles / roles / capabilities (admin)",
      "community_posts, reactions, saves, reports",
      "products, orders, shops, conversations, chat_messages",
      "consultation_bookings, messages, e_prescriptions, vet_availability",
      "notifications, broadcasts, approval_requests",
      "signed upload URLs (Cloudinary) and AI/email/Zego routes",
    ],
  });
});

export default router;
