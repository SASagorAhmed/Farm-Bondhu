import { useLocation } from "react-router-dom";

export const COW_WEIGHT_BASE_PATHS = [
  "/dashboard/cow-weight",
  "/marketplace/cow-weight",
  "/vetbondhu/cow-weight",
  "/vet/cow-weight",
] as const;

export type CowWeightBasePath = (typeof COW_WEIGHT_BASE_PATHS)[number];

export function resolveCowWeightBasePath(pathname: string): CowWeightBasePath {
  if (pathname.startsWith("/marketplace/cow-weight")) return "/marketplace/cow-weight";
  if (pathname.startsWith("/vetbondhu/cow-weight")) return "/vetbondhu/cow-weight";
  if (pathname.startsWith("/vet/cow-weight")) return "/vet/cow-weight";
  return "/dashboard/cow-weight";
}

export interface CowWeightPaths {
  base: CowWeightBasePath;
  hub: CowWeightBasePath;
  upload: string;
  manual: string;
  analyze: string;
  scan: string;
  confirm: string;
  result: string;
}

export function cowWeightPathsFromBase(base: CowWeightBasePath): CowWeightPaths {
  return {
    base,
    hub: base,
    upload: `${base}/upload`,
    manual: `${base}/manual`,
    analyze: `${base}/analyze`,
    scan: `${base}/scan`,
    confirm: `${base}/confirm`,
    result: `${base}/result`,
  };
}

export function useCowWeightPaths(): CowWeightPaths {
  const { pathname } = useLocation();
  return cowWeightPathsFromBase(resolveCowWeightBasePath(pathname));
}
