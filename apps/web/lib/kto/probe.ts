import { parseKtoWire, isKtoSuccessCode } from "./wire";
import { scrubSecret } from "./security";

const OPERATIONS = {
  KorService2: ["searchKeyword2", "detailCommon2", "detailIntro2"],
  DataLabService: ["metcoRegnVisitrDDList"],
  AreaTarDemDsService: ["areaTarExpDsList"],
  AreaTarResDemService: ["areaTarSvcDemList"],
  TatsCnctrRateService: ["tatsCnctrRatedList"],
  TarRlteTarService1: ["areaBasedList1"],
} as const;

export type ProbeSpec = {
  label: string;
  service: keyof typeof OPERATIONS;
  operation: string;
  params: Record<string, string | number>;
  requiredFields: string[];
  numericFields?: string[];
  dateField?: string;
  sourceUrl: string;
  meaning: "metadata" | "regional-statistic" | "provider-forecast" | "related-ranking";
};

export type ProbeSummary = {
  label: string;
  service: string;
  operation: string;
  params: Record<string, string | number>;
  sourceUrl: string;
  meaning: ProbeSpec["meaning"];
  fetchedAt: string;
  durationMs: number;
  status: "success" | "empty" | "error";
  httpStatus: number | null;
  resultCode: string | null;
  reason: string | null;
  totalCount: number | null;
  sampledRows: number;
  collection: "complete-response" | "sample-only" | "none";
  fields: Record<string, { missing: number; invalidNumeric: number | null }>;
  sampleDateRange: { min: string; max: string } | null;
};

const present = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== "";

export function validDate(value: unknown): string | null {
  const input = String(value ?? "");
  if (!/^(\d{8}|\d{4}-\d{2}-\d{2})$/.test(input)) return null;
  const compact = input.replaceAll("-", "");
  const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

export function summarizeSample(rows: Record<string, unknown>[], spec: ProbeSpec) {
  const names = [...new Set([...spec.requiredFields, ...(spec.numericFields ?? []), ...rows.flatMap(Object.keys)])].sort();
  const numeric = new Set(spec.numericFields ?? []);
  const fields = Object.fromEntries(names.map((name) => [name, {
    missing: rows.filter((row) => !present(row[name])).length,
    invalidNumeric: numeric.has(name) ? rows.filter((row) => {
      const value = row[name];
      return present(value) && (typeof value !== "number" && typeof value !== "string"
        || !Number.isFinite(Number(String(value).replaceAll(",", ""))));
    }).length : null,
  }]));
  const dates = spec.dateField ? rows.map((row) => validDate(row[spec.dateField!])).filter((date): date is string => date !== null).sort() : [];
  return { fields, sampleDateRange: dates.length ? { min: dates[0], max: dates[dates.length - 1] } : null };
}

/** Bounded, read-only sampling. Never writes the application database or treats a page as full coverage. */
export async function runKtoProbe(
  spec: ProbeSpec,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<{ summary: ProbeSummary; items: Record<string, unknown>[] }> {
  if (!key.trim()) throw new Error("TOUR_API_KEY가 필요합니다.");
  if (!(OPERATIONS[spec.service] as readonly string[] | undefined)?.includes(spec.operation)) {
    throw new Error("허용되지 않은 KTO 조사 경로입니다.");
  }
  if (Object.keys(spec.params).some((name) => ["servicekey", "mobileos", "mobileapp", "_type"].includes(name.toLowerCase()))) {
    throw new Error("공통 인증·응답 파라미터를 덮어쓸 수 없습니다.");
  }
  const params = { numOfRows: 50, pageNo: 1, ...spec.params };
  if (Number(params.pageNo) !== 1 || !Number.isInteger(Number(params.numOfRows)) || Number(params.numOfRows) < 1 || Number(params.numOfRows) > 1000) {
    throw new Error("조사는 첫 페이지의 1~1000행으로 제한됩니다.");
  }
  const search = new URLSearchParams({ serviceKey: key, MobileOS: "ETC", MobileApp: "FESTCompass", _type: "json" });
  for (const [name, value] of Object.entries(params)) search.set(name, String(value));
  const url = `https://apis.data.go.kr/B551011/${spec.service}/${spec.operation}?${search}`;
  const started = Date.now();
  const summary: ProbeSummary = {
    label: spec.label, service: spec.service, operation: spec.operation, params,
    sourceUrl: spec.sourceUrl, meaning: spec.meaning, fetchedAt: new Date().toISOString(),
    durationMs: 0, status: "error", httpStatus: null, resultCode: null, reason: null,
    totalCount: null, sampledRows: 0, collection: "none", fields: {}, sampleDateRange: null,
  };
  let items: Record<string, unknown>[] = [];
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(10_000), redirect: "error", cache: "no-store" });
    summary.httpStatus = response.status;
    const wire = parseKtoWire(await response.text());
    summary.resultCode = wire.gatewayCode ?? wire.resultCode;
    summary.totalCount = wire.totalCount;
    if (!response.ok || wire.gatewayCode || wire.contractError || !isKtoSuccessCode(wire.resultCode)) {
      summary.reason = wire.contractError ?? (wire.gatewayCode ? "gateway-error" : !response.ok ? "http-error" : "provider-error");
    } else if (!Number.isSafeInteger(wire.totalCount) || (wire.pageNo !== null && wire.pageNo !== 1) || wire.items.length > Number(params.numOfRows)) {
      summary.reason = "invalid-pagination";
    } else {
      summary.sampledRows = wire.items.length;
      Object.assign(summary, summarizeSample(wire.items, spec));
      const invalid = spec.requiredFields.some((name) => summary.fields[name].missing > 0)
        || (spec.numericFields ?? []).some((name) => (summary.fields[name].invalidNumeric ?? 0) > 0)
        || (spec.dateField !== undefined && wire.items.some((row) => validDate(row[spec.dateField!]) === null));
      if (invalid) {
        summary.reason = "invalid-sample-fields";
      } else {
        summary.status = wire.totalCount === 0 ? "empty" : "success";
        summary.collection = wire.totalCount === wire.items.length ? "complete-response" : "sample-only";
        items = wire.items;
      }
    }
  } catch (error) {
    summary.reason = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "fetch-error";
  }
  summary.durationMs = Date.now() - started;
  // Final serialization also removes secrets echoed in provider-controlled field names or codes.
  return { summary: JSON.parse(scrubSecret(JSON.stringify(summary), key)) as ProbeSummary, items };
}
