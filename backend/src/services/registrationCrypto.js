import crypto from "crypto";

const ALGO = "aes-256-gcm";

/** @returns {string | null} Human-readable message if OTP registration cannot encrypt the pending password. */
export function registrationSecretConfigError() {
  const s = process.env.REGISTRATION_SECRET?.trim();
  if (!s || s.length < 16) {
    return (
      "REGISTRATION_SECRET must be set (min 16 characters). In backend/: npm run gen-auth-secret — copy the REGISTRATION_SECRET= line into .env"
    );
  }
  return null;
}

function getKey() {
  const err = registrationSecretConfigError();
  if (err) throw new Error(err);
  const s = process.env.REGISTRATION_SECRET.trim();
  return crypto.createHash("sha256").update(s, "utf8").digest();
}

/** @param {string} plain */
export function encryptPassword(plain) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/** @param {{ cipher: string; iv: string; tag: string }} blob */
export function decryptPassword(blob) {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.cipher, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
