export type PhotoEditorFont = {
  id: string;
  label: string;
  family: string;
};

export const PHOTO_EDITOR_FONTS: PhotoEditorFont[] = [
  { id: "system", label: "Sans", family: "system-ui, sans-serif" },
  { id: "serif", label: "Serif", family: 'Georgia, "Times New Roman", serif' },
  { id: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { id: "impact", label: "Impact", family: "Impact, Haettenschweiler, sans-serif" },
  { id: "mono", label: "Mono", family: '"Courier New", Courier, monospace' },
  { id: "comic", label: "Comic", family: '"Comic Sans MS", cursive' },
  { id: "palatino", label: "Palatino", family: '"Palatino Linotype", Palatino, serif' },
  { id: "trebuchet", label: "Trebuchet", family: '"Trebuchet MS", sans-serif' },
];

export const DEFAULT_PHOTO_EDITOR_FONT = PHOTO_EDITOR_FONTS[0].family;

export function matchFontFamily(value: string | undefined): string {
  if (!value) return DEFAULT_PHOTO_EDITOR_FONT;
  const hit = PHOTO_EDITOR_FONTS.find((f) => f.family === value || value.includes(f.label));
  return hit?.family ?? value;
}
