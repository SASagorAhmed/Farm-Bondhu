/**
 * Prints a strong random value suitable for AUTH_JWT_SECRET (or REGISTRATION_SECRET).
 * Usage: npm run gen-auth-secret
 */
import crypto from "crypto";

const n = Number(process.env.BYTES || 48);
const secret = crypto.randomBytes(Math.min(Math.max(n, 32), 128)).toString("base64url");
console.log("");
console.log("Add one of these to backend/.env (never commit .env):");
console.log("");
console.log(`AUTH_JWT_SECRET=${secret}`);
console.log("");
console.log("# Optional second secret for registration OTP encryption:");
console.log(`REGISTRATION_SECRET=${crypto.randomBytes(48).toString("base64url")}`);
console.log("");
