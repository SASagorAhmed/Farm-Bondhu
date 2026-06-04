export const VETBONDHU_SPECIALIZATION_DEFINITIONS = [
  {
    label: "Animal & Veterinary Consultation",
    description: "Livestock, poultry, pets, disease, symptoms, prescriptions, and follow-up.",
    iconKey: "vet",
    aliases: [] as string[],
  },
  {
    label: "Farming & Agricultural Consultation",
    description: "Farm setup, feed planning, production, biosecurity, crop/agriculture.",
    iconKey: "farm",
    aliases: [] as string[],
  },
  {
    label: "Poultry",
    description: "Chickens, ducks, turkeys, and pigeons.",
    iconKey: "poultry",
    aliases: ["Poultry & Avian Medicine"],
  },
  {
    label: "Duck",
    description: "Duck health, care, and production support.",
    iconKey: "duck",
    aliases: [] as string[],
  },
  {
    label: "Cattle",
    description: "Cows, bulls, and calves.",
    iconKey: "cattle",
    aliases: ["Cattle & Dairy Health"],
  },
  {
    label: "Dairy",
    description: "Dairy cow health and production.",
    iconKey: "dairy",
    aliases: [] as string[],
  },
  {
    label: "Goat & Sheep",
    description: "Goats and sheep care.",
    iconKey: "goatSheep",
    aliases: ["Goat & Sheep Health"],
  },
  {
    label: "Pet Care",
    description: "Dogs, cats, and pet birds.",
    iconKey: "pet",
    aliases: ["Pet Care: Dog, Cat, Bird"],
  },
  {
    label: "General",
    description: "All animal types.",
    iconKey: "general",
    aliases: ["General Veterinary"],
  },
  {
    label: "Emergency",
    description: "Urgent veterinary care.",
    iconKey: "emergency",
    aliases: ["Emergency Veterinary Care"],
  },
  {
    label: "Instant Consultation",
    description: "Available-now consultation support.",
    iconKey: "instant",
    aliases: [] as string[],
  },
  {
    label: "Farm Biosecurity & Disease Prevention",
    description: "Farm hygiene, disease prevention, and outbreak control.",
    iconKey: "biosecurity",
    aliases: [] as string[],
  },
] as const;

export const VETBONDHU_SPECIALIZATION_OPTIONS = VETBONDHU_SPECIALIZATION_DEFINITIONS.map((option) => option.label);

const KNOWN_OPTIONS = VETBONDHU_SPECIALIZATION_DEFINITIONS.flatMap((option) => [
  { value: option.label, label: option.label },
  ...option.aliases.map((alias) => ({ value: alias, label: option.label })),
]).sort((a, b) => b.value.length - a.value.length);

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseVetBondhuSpecializations(value?: string | null): string[] {
  let remaining = normalizeLabel(String(value || ""));
  if (!remaining) return [];

  const labels: string[] = [];
  for (const option of KNOWN_OPTIONS) {
    if (remaining.toLowerCase().includes(option.value.toLowerCase())) {
      labels.push(option.label);
      remaining = remaining.replace(new RegExp(option.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    }
  }

  remaining
    .split(",")
    .map(normalizeLabel)
    .filter(Boolean)
    .forEach((label) => labels.push(label));

  return Array.from(new Set(labels));
}

export function serializeVetBondhuSpecializations(labels: string[]) {
  return Array.from(new Set(labels.map(normalizeLabel).filter(Boolean))).join(", ");
}
