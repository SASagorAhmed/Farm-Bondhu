/**
 * One-time / idempotent: ensures the official FarmBondhu inbox exists as a local-auth super admin.
 *
 * Usage (from backend/):
 *   OFFICIAL_SUPER_ADMIN_PASSWORD=your_password npm run seed:official-admin
 *
 * Defaults email to farmbondhu.officials@gmail.com; override with OFFICIAL_SUPER_ADMIN_EMAIL.
 * Password: set OFFICIAL_SUPER_ADMIN_PASSWORD (min 6 chars). If unset, uses 123456 only when
 * NODE_ENV is not "production" (override with OFFICIAL_SUPER_ADMIN_PASSWORD in prod).
 */
import "dotenv/config";
import crypto from "crypto";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const DEFAULT_EMAIL = "farmbondhu.officials@gmail.com";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

const email = normalizeEmail(process.env.OFFICIAL_SUPER_ADMIN_EMAIL || DEFAULT_EMAIL);
let password = process.env.OFFICIAL_SUPER_ADMIN_PASSWORD?.trim();
if (!password) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "OFFICIAL_SUPER_ADMIN_PASSWORD is required in production. Refusing to use a default password."
    );
    process.exit(1);
  }
  password = "123456";
  console.warn("[seed-official-super-admin] Using default dev password 123456; set OFFICIAL_SUPER_ADMIN_PASSWORD to override.");
}
if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const cs = process.env.DATABASE_URL?.trim();
if (!cs) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const superAdminPerms = {
  can_approve: true,
  can_reject: true,
  can_manage_users: true,
  can_broadcast: true,
  can_view_reports: true,
};

const sql = postgres(cs, { max: 1 });

try {
  await sql.unsafe(`ALTER TABLE public.admin_team ADD COLUMN IF NOT EXISTS admin_level text`);
  await sql.unsafe(`ALTER TABLE public.admin_team ADD COLUMN IF NOT EXISTS added_by uuid`);

  const hash = await bcrypt.hash(password, 10);

  let [row] = await sql`
    select id, email, name from profiles
    where lower(trim(email)) = ${email}
    limit 1
  `;

  let userId;
  if (!row) {
    userId = crypto.randomUUID();
    const name = email.split("@")[0] || "Official";
    await sql`
      insert into profiles (id, email, name, primary_role, created_at, updated_at)
      values (${userId}, ${email}, ${name}, 'admin', now(), now())
    `;
    await sql`
      insert into auth_credentials (user_id, password_hash, updated_at)
      values (${userId}, ${hash}, now())
    `;
    console.log("[seed-official-super-admin] Created profile + credentials for", email);
  } else {
    userId = row.id;
    await sql`
      insert into auth_credentials (user_id, password_hash, updated_at)
      values (${userId}, ${hash}, now())
      on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()
    `;
    await sql`
      update profiles
      set primary_role = 'admin', updated_at = now()
      where id = ${userId}
    `;
    console.log("[seed-official-super-admin] Updated password + primary_role=admin for", email);
  }

  await sql`
    insert into user_roles (user_id, role, created_at)
    values (${userId}, 'admin', now())
    on conflict (user_id, role) do nothing
  `;

  await sql`delete from admin_team where user_id = ${userId}`;

  const [prof] = await sql`select name, email from profiles where id = ${userId} limit 1`;
  await sql`
    insert into admin_team (user_id, name, email, admin_level, admin_role, added_by, permissions, created_at, updated_at)
    values (
      ${userId},
      ${prof?.name || "Official"},
      ${prof?.email || email},
      'super_admin',
      'super_admin',
      null,
      ${sql.json(superAdminPerms)},
      now(),
      now()
    )
  `;

  await sql`
    update admin_team t
    set admin_level = 'super_admin',
        admin_role = 'super_admin',
        permissions = ${sql.json(superAdminPerms)},
        updated_at = now()
    from profiles p
    where t.user_id = p.id and lower(trim(p.email)) = ${email}
  `;

  console.log("[seed-official-super-admin] Done. user_roles includes admin; admin_team row is super_admin.");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
