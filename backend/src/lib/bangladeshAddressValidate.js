import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../data/bangladeshLocations.json");
let cached = null;

function loadData() {
  if (cached) return cached;
  cached = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  return cached;
}

export function normalizeBangladeshMobile(input) {
  return String(input || "").replace(/\D/g, "");
}

export function isValidBangladeshMobile(input) {
  return /^01\d{9}$/.test(normalizeBangladeshMobile(input));
}

function findDistrict(divisionName, districtName) {
  const data = loadData();
  const div = data.divisions.find((d) => d.name === divisionName);
  if (!div) return null;
  return div.districts.find((d) => d.name === districtName) || null;
}

export function validateAddressHierarchy({ country, division, district, upazila }) {
  if (String(country || "") !== "Bangladesh") return { ok: true };
  const dist = findDistrict(String(division || ""), String(district || ""));
  if (!dist) {
    return { ok: false, error: "District does not belong to selected division" };
  }
  const up = dist.upazilas.find((u) => u.name === String(upazila || ""));
  if (!up) {
    return { ok: false, error: "Upazila/Thana does not belong to selected district" };
  }
  return { ok: true };
}

const ADDRESS_TYPES = new Set(["home", "office", "other"]);

export function validateAddressPayload(body, { partial = false } = {}) {
  const b = body || {};
  const errors = [];

  const req = (field, label) => {
    const val = b[field];
    if (val === undefined || val === null || String(val).trim() === "") {
      if (!partial) errors.push(`${label} is required`);
      return null;
    }
    return typeof val === "string" ? val.trim() : val;
  };

  const fullName = req("full_name", "Full name");
  const phone = req("phone", "Mobile number");
  const country = req("country", "Country") || b.country;
  const division = req("division", "Division");
  const district = req("district", "District");
  const upazila = req("upazila", "Upazila/Thana");
  const fullAddress = req("full_address", "Full address");

  if (phone && !isValidBangladeshMobile(phone)) {
    errors.push("Mobile number must be 11 digits starting with 01");
  }
  if (b.alt_phone && String(b.alt_phone).trim() && !isValidBangladeshMobile(b.alt_phone)) {
    errors.push("Alternative mobile must be 11 digits starting with 01");
  }
  if (b.address_type && !ADDRESS_TYPES.has(String(b.address_type))) {
    errors.push("Address type must be home, office, or other");
  }

  if (!partial || (division && district && upazila && country)) {
    const hierarchy = validateAddressHierarchy({
      country: country || b.country,
      division: division || b.division,
      district: district || b.district,
      upazila: upazila || b.upazila,
    });
    if (!hierarchy.ok) errors.push(hierarchy.error);
  }

  if (errors.length) return { ok: false, errors };

  const payload = {};
  if (fullName !== null) payload.full_name = fullName;
  if (phone !== null) payload.phone = normalizeBangladeshMobile(phone);
  if (b.alt_phone !== undefined) {
    payload.alt_phone = b.alt_phone ? normalizeBangladeshMobile(String(b.alt_phone)) : null;
  }
  if (country !== null) payload.country = country;
  if (division !== null) payload.division = division;
  if (district !== null) payload.district = district;
  if (upazila !== null) payload.upazila = upazila;
  if (b.area !== undefined) payload.area = b.area ? String(b.area).trim() : null;
  if (fullAddress !== null) payload.full_address = fullAddress;
  if (b.landmark !== undefined) payload.landmark = b.landmark ? String(b.landmark).trim() : null;
  if (b.post_code !== undefined) payload.post_code = b.post_code ? String(b.post_code).trim() : null;
  if (b.address_type !== undefined) payload.address_type = b.address_type || "home";
  if (b.is_default !== undefined) payload.is_default = Boolean(b.is_default);

  return { ok: true, payload };
}

export async function syncProfileFromDefaultAddress(sql, userId) {
  const [addr] = await sql`
    select phone, district, division
    from user_addresses
    where user_id = ${userId} and is_default = true
    limit 1
  `;
  if (!addr) return;
  const [profile] = await sql`select phone, location from profiles where id = ${userId} limit 1`;
  if (!profile) return;
  const patch = { updated_at: new Date().toISOString() };
  if (!profile.phone && addr.phone) patch.phone = addr.phone;
  patch.location = `${addr.district}, ${addr.division}`;
  await sql`update profiles set ${sql(patch)} where id = ${userId}`;
}
