import * as jose from "jose";

const ACCESS_TTL_SEC = 60 * 60; // 1 hour
const REFRESH_TTL_SEC = 60 * 60 * 24 * 14; // 14 days

/** @returns {Uint8Array} */
export function getAuthJwtSecretBytes() {
  const s =
    process.env.AUTH_JWT_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("AUTH_JWT_SECRET (or JWT_SECRET) must be set — at least 16 characters");
  }
  return new TextEncoder().encode(s);
}

/** @param {string} token */
export async function verifyAccessTokenPayload(token) {
  const { payload } = await jose.jwtVerify(token, getAuthJwtSecretBytes(), {
    algorithms: ["HS256"],
  });
  if (payload.typ === "refresh") {
    const err = new Error("Invalid token type");
    err.status = 401;
    throw err;
  }
  return payload;
}

/**
 * @param {string} userId
 * @param {string} email
 * @returns {Promise<Record<string, unknown>>} session-shaped object for API responses
 */
export async function createAuthSession(userId, email) {
  const now = Math.floor(Date.now() / 1000);
  const accessExp = now + ACCESS_TTL_SEC;
  const refreshExp = now + REFRESH_TTL_SEC;

  const accessToken = await new jose.SignJWT({ email, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(accessExp)
    .sign(getAuthJwtSecretBytes());

  const refreshToken = await new jose.SignJWT({ typ: "refresh", email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(refreshExp)
    .sign(getAuthJwtSecretBytes());

  const user = { id: userId, email };
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: ACCESS_TTL_SEC,
    expires_at: accessExp,
    token_type: "bearer",
    user,
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: accessExp,
      user,
    },
  };
}

/** @param {string} refreshToken */
export async function refreshAuthSession(refreshToken) {
  const { payload } = await jose.jwtVerify(refreshToken, getAuthJwtSecretBytes(), {
    algorithms: ["HS256"],
  });
  if (payload.typ !== "refresh") {
    const err = new Error("Invalid refresh token");
    err.status = 401;
    throw err;
  }
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) {
    const err = new Error("Invalid refresh token");
    err.status = 401;
    throw err;
  }
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!email) {
    const err = new Error("Invalid refresh token");
    err.status = 401;
    throw err;
  }
  return createAuthSession(sub, email);
}
