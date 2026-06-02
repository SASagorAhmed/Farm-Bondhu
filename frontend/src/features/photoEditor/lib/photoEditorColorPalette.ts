export const VIBRANT_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#84CC16",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
] as const;

export const EXTENDED_COLORS = [
  "#FFFFFF",
  "#F3F4F6",
  "#D1D5DB",
  "#6B7280",
  "#111827",
  "#000000",
  "#FCE7F3",
  "#E91E8C",
  "#FEF3C7",
  "#F59E0B",
  "#D1FAE5",
  "#10B981",
  "#DBEAFE",
  "#2563EB",
  "#EDE9FE",
  "#7C3AED",
] as const;

export type GradientPreset = {
  id: string;
  label: string;
  colorStops: { offset: number; color: string }[];
  angle: number;
};

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: "sunset",
    label: "Sunset",
    colorStops: [
      { offset: 0, color: "#F97316" },
      { offset: 1, color: "#EC4899" },
    ],
    angle: 90,
  },
  {
    id: "ocean",
    label: "Ocean",
    colorStops: [
      { offset: 0, color: "#06B6D4" },
      { offset: 1, color: "#3B82F6" },
    ],
    angle: 90,
  },
  {
    id: "forest",
    label: "Forest",
    colorStops: [
      { offset: 0, color: "#84CC16" },
      { offset: 1, color: "#059669" },
    ],
    angle: 135,
  },
  {
    id: "purple-haze",
    label: "Purple",
    colorStops: [
      { offset: 0, color: "#8B5CF6" },
      { offset: 1, color: "#EC4899" },
    ],
    angle: 45,
  },
  {
    id: "gold",
    label: "Gold",
    colorStops: [
      { offset: 0, color: "#FDE047" },
      { offset: 1, color: "#F97316" },
    ],
    angle: 180,
  },
  {
    id: "night",
    label: "Night",
    colorStops: [
      { offset: 0, color: "#1E3A8A" },
      { offset: 1, color: "#111827" },
    ],
    angle: 90,
  },
];

export const DEFAULT_SOLID_COLOR = "#111827";

export function gradientCss(preset: GradientPreset): string {
  const stops = preset.colorStops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  return `linear-gradient(${preset.angle}deg, ${stops})`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function normalizeHex(color: string): string {
  if (!color.startsWith("#")) return color;
  const raw = color.slice(1);
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  return `#${raw.slice(0, 6)}`.toLowerCase();
}
