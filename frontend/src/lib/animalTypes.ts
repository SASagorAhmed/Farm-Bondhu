export const DEFAULT_BOOKABLE_ANIMAL_TYPES = ["chicken", "duck", "cow", "goat", "sheep", "dog", "cat", "bird"] as const;

export const ALL_ANIMAL_TYPES = [
  ...DEFAULT_BOOKABLE_ANIMAL_TYPES,
  "turkey",
  "pigeon",
  "buffalo",
  "horse",
  "other",
] as const;

const EXPANDED_ALIAS_MAP: Record<string, string[]> = {
  poultry: ["chicken", "duck", "turkey", "pigeon"],
  bird: ["bird"],
  birds: ["chicken", "duck", "turkey", "pigeon", "bird"],
  avian: ["chicken", "duck", "turkey", "pigeon", "bird"],
  cattle: ["cow"],
  dairy: ["cow"],
  "goat-sheep": ["goat", "sheep"],
  goatsheep: ["goat", "sheep"],
  smallruminants: ["goat", "sheep"],
  pet: ["dog", "cat", "bird"],
  pets: ["dog", "cat", "bird"],
  "pet-care": ["dog", "cat", "bird"],
  general: [...DEFAULT_BOOKABLE_ANIMAL_TYPES, "turkey", "pigeon"],
  emergency: [...DEFAULT_BOOKABLE_ANIMAL_TYPES, "turkey", "pigeon"],
  all: [...DEFAULT_BOOKABLE_ANIMAL_TYPES, "turkey", "pigeon", "buffalo", "horse"],
};

export const SPECIALITY_ANIMAL_MAP: Record<string, string[]> = {
  poultry: ["chicken", "duck", "turkey", "pigeon"],
  cattle: ["cow"],
  dairy: ["cow"],
  "goat-sheep": ["goat", "sheep"],
  pet: ["dog", "cat", "bird"],
  pets: ["dog", "cat", "bird"],
  "pet-care": ["dog", "cat", "bird"],
  general: [...DEFAULT_BOOKABLE_ANIMAL_TYPES, "turkey", "pigeon"],
  emergency: [...DEFAULT_BOOKABLE_ANIMAL_TYPES, "turkey", "pigeon"],
};

function cleanToken(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function isKnownAnimalType(value: string): value is (typeof ALL_ANIMAL_TYPES)[number] {
  return (ALL_ANIMAL_TYPES as readonly string[]).includes(value);
}

export function expandAnimalType(raw: unknown): string[] {
  const token = cleanToken(raw);
  if (!token) return [];
  if (EXPANDED_ALIAS_MAP[token]) return [...EXPANDED_ALIAS_MAP[token]];
  if (isKnownAnimalType(token)) return [token];
  return [];
}

export function normalizeAnimalType(raw: unknown): string {
  const expanded = expandAnimalType(raw);
  return expanded[0] || "";
}

export function normalizeAnimalTypes(values: unknown): string[] {
  const list = Array.isArray(values) ? values : [values];
  const out = new Set<string>();
  for (const value of list) {
    for (const normalized of expandAnimalType(value)) out.add(normalized);
  }
  return Array.from(out);
}

export function getAnimalTypeLabel(type: string): string {
  const t = cleanToken(type);
  if (!t) return "";
  return t
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

