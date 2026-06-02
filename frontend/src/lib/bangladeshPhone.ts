export function normalizeBangladeshMobile(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

export function isValidBangladeshMobile(input: string): boolean {
  const digits = normalizeBangladeshMobile(input);
  return /^01\d{9}$/.test(digits);
}

export function formatBangladeshMobileHint(): string {
  return "01XXXXXXXXX (11 digits)";
}
