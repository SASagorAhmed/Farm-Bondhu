import rawData from "@/data/bangladeshLocations.json";

export const DEFAULT_COUNTRY = "Bangladesh";

export type AddressType = "home" | "office" | "other";

export interface UserAddressFormValues {
  fullName: string;
  phone: string;
  altPhone: string;
  country: string;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  area: string;
  fullAddress: string;
  landmark: string;
  postCode: string;
  addressType: AddressType;
}

export interface SavedUserAddress extends UserAddressFormValues {
  id: string;
  division: string;
  district: string;
  upazila: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface UpazilaNode {
  id: string;
  name: string;
  areas: string[];
}

interface DistrictNode {
  id: string;
  name: string;
  upazilas: UpazilaNode[];
}

interface DivisionNode {
  id: string;
  name: string;
  districts: DistrictNode[];
}

interface LocationData {
  country: string;
  divisions: DivisionNode[];
}

const data = rawData as LocationData;

const divisionById = new Map(data.divisions.map((d) => [d.id, d]));

function findDistrict(divisionId: string, districtId: string): DistrictNode | undefined {
  return divisionById.get(divisionId)?.districts.find((d) => d.id === districtId);
}

function findUpazila(divisionId: string, districtId: string, upazilaId: string): UpazilaNode | undefined {
  return findDistrict(divisionId, districtId)?.upazilas.find((u) => u.id === upazilaId);
}

export function getCountries(): string[] {
  return [DEFAULT_COUNTRY];
}

export function getDivisions(): { id: string; name: string }[] {
  return data.divisions.map(({ id, name }) => ({ id, name }));
}

export function getDistricts(divisionId: string): { id: string; name: string }[] {
  const div = divisionById.get(divisionId);
  if (!div) return [];
  return div.districts.map(({ id, name }) => ({ id, name }));
}

export function getUpazilas(divisionId: string, districtId: string): { id: string; name: string }[] {
  const dist = findDistrict(divisionId, districtId);
  if (!dist) return [];
  return dist.upazilas.map(({ id, name }) => ({ id, name }));
}

export function getAreas(divisionId: string, districtId: string, upazilaId: string): string[] {
  return findUpazila(divisionId, districtId, upazilaId)?.areas || [];
}

export function getDivisionName(divisionId: string): string {
  return divisionById.get(divisionId)?.name || "";
}

export function getDistrictName(divisionId: string, districtId: string): string {
  return findDistrict(divisionId, districtId)?.name || "";
}

export function getUpazilaName(divisionId: string, districtId: string, upazilaId: string): string {
  return findUpazila(divisionId, districtId, upazilaId)?.name || "";
}

export function createEmptyAddressForm(partial?: Partial<UserAddressFormValues>): UserAddressFormValues {
  return {
    fullName: "",
    phone: "",
    altPhone: "",
    country: DEFAULT_COUNTRY,
    divisionId: "",
    districtId: "",
    upazilaId: "",
    area: "",
    fullAddress: "",
    landmark: "",
    postCode: "",
    addressType: "home",
    ...partial,
  };
}

export function resetAfterCountryChange(form: UserAddressFormValues, country: string): UserAddressFormValues {
  return {
    ...form,
    country,
    divisionId: "",
    districtId: "",
    upazilaId: "",
    area: "",
  };
}

export function resetAfterDivisionChange(form: UserAddressFormValues, divisionId: string): UserAddressFormValues {
  return { ...form, divisionId, districtId: "", upazilaId: "", area: "" };
}

export function resetAfterDistrictChange(form: UserAddressFormValues, districtId: string): UserAddressFormValues {
  return { ...form, districtId, upazilaId: "", area: "" };
}

export function resetAfterUpazilaChange(form: UserAddressFormValues, upazilaId: string): UserAddressFormValues {
  return { ...form, upazilaId, area: "" };
}

export function validateAddressHierarchy(form: Pick<UserAddressFormValues, "country" | "divisionId" | "districtId" | "upazilaId">): boolean {
  if (form.country !== DEFAULT_COUNTRY) return true;
  if (!form.divisionId || !form.districtId || !form.upazilaId) return false;
  return Boolean(findUpazila(form.divisionId, form.districtId, form.upazilaId));
}

export function formatAddressSummary(form: Pick<UserAddressFormValues, "divisionId" | "districtId">): string {
  const division = getDivisionName(form.divisionId);
  const district = getDistrictName(form.divisionId, form.districtId);
  if (district && division) return `${district}, ${division}`;
  return district || division || "";
}

export function rowToAddressForm(row: Record<string, unknown>): UserAddressFormValues {
  const divisionName = String(row.division || "");
  const districtName = String(row.district || "");
  const upazilaName = String(row.upazila || "");
  let divisionId = "";
  let districtId = "";
  let upazilaId = "";

  for (const div of data.divisions) {
    if (div.name === divisionName) {
      divisionId = div.id;
      const dist = div.districts.find((d) => d.name === districtName);
      if (dist) {
        districtId = dist.id;
        const up = dist.upazilas.find((u) => u.name === upazilaName);
        if (up) upazilaId = up.id;
      }
      break;
    }
  }

  return createEmptyAddressForm({
    fullName: String(row.full_name || ""),
    phone: String(row.phone || ""),
    altPhone: String(row.alt_phone || ""),
    country: String(row.country || DEFAULT_COUNTRY),
    divisionId,
    districtId,
    upazilaId,
    area: String(row.area || ""),
    fullAddress: String(row.full_address || ""),
    landmark: String(row.landmark || ""),
    postCode: String(row.post_code || ""),
    addressType: (row.address_type as AddressType) || "home",
  });
}

export function mapSavedAddress(row: Record<string, unknown>): SavedUserAddress {
  const form = rowToAddressForm(row);
  return {
    ...form,
    id: String(row.id),
    division: String(row.division || getDivisionName(form.divisionId)),
    district: String(row.district || getDistrictName(form.divisionId, form.districtId)),
    upazila: String(row.upazila || getUpazilaName(form.divisionId, form.districtId, form.upazilaId)),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function formToPayload(form: UserAddressFormValues, isDefault = false) {
  return {
    full_name: form.fullName.trim(),
    phone: form.phone.trim(),
    alt_phone: form.altPhone.trim() || null,
    country: form.country,
    division: getDivisionName(form.divisionId),
    district: getDistrictName(form.divisionId, form.districtId),
    upazila: getUpazilaName(form.divisionId, form.districtId, form.upazilaId),
    area: form.area.trim() || null,
    full_address: form.fullAddress.trim(),
    landmark: form.landmark.trim() || null,
    post_code: form.postCode.trim() || null,
    address_type: form.addressType,
    is_default: isDefault,
  };
}
