/**
 * Builds frontend/src/data/bangladeshLocations.json from places-in-bangladesh source files.
 * Run: node scripts/buildBangladeshLocations.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function slug(name) {
  return String(name)
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const DIVISION_NAME_MAP = {
  Chattagram: "Chattogram",
  Barisal: "Barishal",
};

const DISTRICT_NAME_MAP = {
  Comilla: "Cumilla",
  Bagerhat: "Bagerhat",
  Coxsbazar: "Cox's Bazar",
  "Cox's Bazar": "Cox's Bazar",
  Chapainawabganj: "Chapainawabganj",
  Jashore: "Jashore",
  Bogra: "Bogura",
};

function normalizeDistrictName(name) {
  return DISTRICT_NAME_MAP[name] || name;
}

function normalizeDivisionName(name) {
  return DIVISION_NAME_MAP[name] || name;
}

async function main() {
  const srcDir = path.join(root, "scripts");
  const divisions = JSON.parse(fs.readFileSync(path.join(srcDir, "bd-divisions.json"), "utf8"));
  const districts = JSON.parse(fs.readFileSync(path.join(srcDir, "bd-districts.json"), "utf8"));
  const upazilas = JSON.parse(fs.readFileSync(path.join(srcDir, "bd-upazilas.json"), "utf8"));

  const upazilasByDistrict = new Map();
  for (const u of upazilas) {
    const list = upazilasByDistrict.get(u.district_id) || [];
    list.push(u);
    upazilasByDistrict.set(u.district_id, list);
  }

  const districtsByDivision = new Map();
  for (const d of districts) {
    const list = districtsByDivision.get(d.division_id) || [];
    list.push(d);
    districtsByDivision.set(d.division_id, list);
  }

  const output = {
    country: "Bangladesh",
    divisions: divisions.map((div) => {
      const divName = normalizeDivisionName(div.name);
      const divId = slug(divName);
      const divDistricts = districtsByDivision.get(div.id) || [];
      return {
        id: divId,
        name: divName,
        districts: divDistricts.map((dist) => {
          const distName = normalizeDistrictName(dist.name);
          const distId = slug(distName);
          const distUpazilas = upazilasByDistrict.get(dist.id) || [];
          return {
            id: distId,
            name: distName,
            upazilas: distUpazilas.map((up) => ({
              id: `${slug(up.name)}-${distId}`,
              name: up.name,
              areas: [],
            })),
          };
        }),
      };
    }),
  };

  const outPath = path.join(root, "frontend/src/data/bangladeshLocations.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  const divCount = output.divisions.length;
  const distCount = output.divisions.reduce((n, d) => n + d.districts.length, 0);
  const upCount = output.divisions.reduce(
    (n, d) => n + d.districts.reduce((m, x) => m + x.upazilas.length, 0),
    0
  );
  console.log(`Wrote ${outPath}: ${divCount} divisions, ${distCount} districts, ${upCount} upazilas`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
