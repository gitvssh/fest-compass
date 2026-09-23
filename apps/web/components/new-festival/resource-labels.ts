import type { ResourceKind } from "@/lib/existing/types";

export const KIND_LABEL: Record<ResourceKind, string> = { "12": "관광지", "14": "문화시설" };
export const RADII = [1, 3, 5, 10, 20];
export const MAX_COMPARED = 2;
export const km = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)}km`;
export const distanceText = (value: number | null) => value === null ? "거리 미확인" : `기준점에서 직선거리 약 ${km(value)}`;
export const sourceDate = (value: string | null) => value && /^\d{8}/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null;
