export function formatNumber(value: number | null | undefined, digits = 0): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return `${(value * 100).toFixed(1)}%`;
}

export function labelLevelName(level: string): string {
  switch (level) {
    case "L0":
      return "L0 · 라벨 없음";
    case "L1":
      return "L1 · 부분 라벨";
    case "L2":
      return "L2 · 운영 라벨";
    case "L3":
      return "L3 · 반복 라벨";
    default:
      return level;
  }
}

export function parseOptionalNumber(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function isoNow(): string {
  return new Date().toISOString();
}
