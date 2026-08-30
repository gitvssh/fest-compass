export type VisitorWindowName = "평시" | "전년 동기간" | "당해";

export type VisitorWindow = {
  window: VisitorWindowName;
  startYmd: string;
  endYmd: string;
};

function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`잘못된 날짜 형식: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError(`존재하지 않는 날짜: ${value}`);
  }
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function previousYear(date: Date): Date {
  const year = date.getUTCFullYear() - 1;
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export function serverTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildVisitorWindows(
  startDate: string,
  endDate: string | null | undefined,
  todayIso = serverTodayIso(),
): VisitorWindow[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate || startDate);
  parseDateOnly(todayIso);
  if (end < start) throw new RangeError("종료일은 시작일보다 빠를 수 없습니다.");

  const previousStart = previousYear(start);
  const previousEnd = previousYear(end);
  const windows: VisitorWindow[] = [
    {
      window: "평시",
      startYmd: isoDate(addDays(start, -28)),
      endYmd: isoDate(addDays(start, -22)),
    },
    {
      window: "전년 동기간",
      startYmd: isoDate(addDays(previousStart, -3)),
      endYmd: isoDate(addDays(previousEnd, 3)),
    },
  ];

  if (isoDate(end) < todayIso) {
    windows.push({ window: "당해", startYmd: isoDate(start), endYmd: isoDate(end) });
  }
  return windows;
}

export function previousYearMonth(startDate: string): string {
  const shifted = previousYear(parseDateOnly(startDate));
  return isoDate(shifted).replaceAll("-", "").slice(0, 6);
}
