import { validDate } from "./probe";

// Current codes are verified by the candidate metadata and the municipal API.
// Preserve the returned code; the Jeonbuk alias must never create two observations.
export const CANDIDATE_REGIONS = [
  { id: "imsil", name: "임실군", codes: ["52750", "45750"] },
  { id: "gongju", name: "공주시", codes: ["44150"] },
  { id: "buyeo", name: "부여군", codes: ["44760"] },
  { id: "nonsan", name: "논산시", codes: ["44230"] },
] as const;

const VISITOR_TYPES = { "1": "현지인(a)", "2": "외지인(b)", "3": "외국인(c)" } as const;
const text = (value: unknown) => String(value ?? "").trim();

/** A complete single-day response proves this date only, never a continuous history. */
export function summarizeRegionalDay(rows: Record<string, unknown>[], date: string, complete: boolean) {
  const day = validDate(date);
  if (!day) throw new Error("유효한 조사일이 필요합니다.");
  return CANDIDATE_REGIONS.map((region) => {
    const selected = rows.filter((row) => (region.codes as readonly string[]).includes(text(row.signguCode))
      || text(row.signguNm) === region.name);
    const issues: string[] = [];
    if (!complete) issues.push("incomplete-response");
    const seen = new Set<string>();
    const points = selected.map((row) => {
      const code = text(row.signguCode), visitorTypeCode = text(row.touDivCd);
      const rawValue = row.touNum;
      const value = typeof rawValue === "number" || typeof rawValue === "string"
        ? Number(text(rawValue).replaceAll(",", "")) : NaN;
      if (!(region.codes as readonly string[]).includes(code) || text(row.signguNm) !== region.name) issues.push("region-mismatch");
      if (validDate(row.baseYmd) !== day) issues.push("date-mismatch");
      if (seen.has(visitorTypeCode)) issues.push("duplicate-visitor-type");
      seen.add(visitorTypeCode);
      if (!Object.hasOwn(VISITOR_TYPES, visitorTypeCode)
        || VISITOR_TYPES[visitorTypeCode as keyof typeof VISITOR_TYPES] !== text(row.touDivNm)) issues.push("visitor-type-mismatch");
      const decimal = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
      if (!decimal.test(text(rawValue)) || !Number.isFinite(value) || value < 0) issues.push("invalid-visitor-value");
      return { date: day, sourceRegionCode: code, regionName: text(row.signguNm),
        visitorTypeCode, visitorTypeName: text(row.touDivNm), value: Number.isFinite(value) ? value : null };
    });
    if (Object.keys(VISITOR_TYPES).some((code) => !seen.has(code))) issues.push("missing-visitor-type");
    return { regionId: region.id, status: issues.length ? "unusable" as const : "complete-day" as const,
      issues: [...new Set(issues)], points };
  });
}
