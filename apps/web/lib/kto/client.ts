import "server-only";
import { prisma } from "@/lib/db";
import { areaCodeCandidatesForStd, normalizeAdminCodes } from "@/lib/kto/areacode";
import { maskServiceKeyUrl, scrubSecret } from "@/lib/kto/security";
import { isKtoSuccessCode, parseKtoWire } from "@/lib/kto/wire";

const TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2";
const DATALAB_BASE = "https://apis.data.go.kr/B551011/DataLabService";
const CONCENTRATION_BASE = "https://apis.data.go.kr/B551011/TatsCnctrRateService";
const DEMAND_BASE = "https://apis.data.go.kr/B551011/AreaTarDemDsService";
const RELATED_BASE = "https://apis.data.go.kr/B551011/TarRlteTarService1";

const VISITOR_PAGE_SIZE = 1000;
const VISITOR_MAX_PAGES = 20;
const COMPLETE_PAGE_SIZE = 1000;
const COMPLETE_MAX_PAGES = 20;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const MIN_FETCH_TIMEOUT_MS = 1_000;
const MAX_FETCH_TIMEOUT_MS = 30_000;

const FESTIVAL_LIST_FIELDS = ["contentid", "title"] as const;
const FESTIVAL_COMMON_FIELDS = ["contentid", "title"] as const;
const FESTIVAL_INTRO_FIELDS = ["eventstartdate", "eventenddate"] as const;
const VISITOR_FIELDS = ["baseYmd", "areaCode", "areaNm", "touDivNm", "touNum"] as const;
const DEMAND_FIELDS = [
  "baseYm", "areaCd", "areaNm", "tarExpDsIxCd", "tarExpDsIxNm", "tarExpDsIxVal",
] as const;
const CONCENTRATION_FIELDS = ["tAtsNm", "baseYmd", "areaCd", "signguCd", "cnctrRate"] as const;
const RELATED_FIELDS = [
  "baseYm", "tAtsCd", "tAtsNm", "areaCd", "areaNm", "signguCd", "signguNm",
  "rlteTatsCd", "rlteTatsNm", "rlteRegnCd", "rlteRegnNm", "rlteSignguCd",
  "rlteSignguNm", "rlteCtgryLclsNm", "rlteCtgryMclsNm", "rlteCtgrySclsNm", "rlteRank",
] as const;

export type KtoKind = "success" | "empty" | "error";

export type KtoResult<T> = {
  ok: boolean;
  kind: KtoKind;
  status: number | null;
  data: T | null;
  summary: string;
  fetchedAt: string;
  urlMasked: string;
  totalCount: number | null;
};

export type FestivalHit = {
  contentId: string;
  title: string;
  addr1: string;
  eventstartdate: string;
  eventenddate: string;
  mapx: string;
  mapy: string;
  areacode: string;
  sigungucode: string;
  ldongRegnCd: string;
  ldongSignguCd: string;
  tel: string;
};

export type VisitorPoint = {
  baseYmd: string;
  areaCode: string;
  areaNm: string;
  signguCode: string;
  signguNm: string;
  daywkDivCd: string;
  daywkDivNm: string;
  touDivCd: string;
  touDivNm: string;
  touNum: number | null;
};

export type DemandIntensityPoint = {
  baseYm: string;
  areaCd: string;
  areaNm: string;
  signguCd: string;
  signguNm: string;
  tarExpDsIxCd: string;
  tarExpDsIxNm: string;
  tarExpDsIxVal: number | null;
  tarSjrnDsIxCd: string;
  tarSjrnDsIxNm: string;
  tarSjrnDsIxVal: number | null;
};

export type DemandIntensityData = {
  baseYm: string;
  areaNm: string;
  /** Only the documented aggregate metric (tarExpDsIxCd=22). */
  score: number | null;
  scoreCode: string;
  scoreName: string;
  items: DemandIntensityPoint[];
};

export type ConcentrationPoint = {
  tAtsNm: string;
  baseYmd: string;
  areaCd: string;
  areaNm: string;
  signguCd: string;
  signguNm: string;
  cnctrRate: number | null;
};

export type RelatedTourismPoint = {
  baseYm: string;
  tAtsCd: string;
  tAtsNm: string;
  areaCd: string;
  areaNm: string;
  signguCd: string;
  signguNm: string;
  rlteTatsCd: string;
  rlteTatsNm: string;
  rlteRegnCd: string;
  rlteRegnNm: string;
  rlteSignguCd: string;
  rlteSignguNm: string;
  rlteCtgryLclsNm: string;
  rlteCtgryMclsNm: string;
  rlteCtgrySclsNm: string;
  rlteRank: number | null;
};

export type FestivalDetailData = Record<string, string> & {
  contentId: string;
  title: string;
  eventstartdate: string;
  eventenddate: string;
};

function serviceKey(): string | null {
  const key = process.env.TOUR_API_KEY?.trim();
  return key || null;
}

export function hasTourKey(): boolean {
  return Boolean(serviceKey());
}

export function resolveKtoFetchTimeout(value = process.env.KTO_FETCH_TIMEOUT_MS): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_FETCH_TIMEOUT_MS || parsed > MAX_FETCH_TIMEOUT_MS) {
    return DEFAULT_FETCH_TIMEOUT_MS;
  }
  return parsed;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (name in row) return row[name];
  const lower = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = lower.get(name.toLowerCase());
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Validate schema keys without logging or interpolating any response values. */
export function requiredRawFieldError(
  items: Record<string, unknown>[],
  requiredFields: readonly string[],
): string | null {
  if (!items.length || !requiredFields.length) return null;
  for (let index = 0; index < items.length; index += 1) {
    const keys = new Set(Object.keys(items[index]).map((key) => key.toLowerCase()));
    const missing = requiredFields.filter((field) => !keys.has(field.toLowerCase()));
    if (missing.length) return `${index + 1}번째 item 필수 필드 누락: ${missing.join(",")}`;
  }
  return null;
}

function missingKeyResult<T>(): KtoResult<T> {
  return {
    ok: false, kind: "error", status: null, data: null, summary: "TOUR_API_KEY 없음",
    fetchedAt: new Date().toISOString(), urlMasked: "", totalCount: null,
  };
}

function validationError<T>(summary: string): KtoResult<T> {
  return {
    ok: false, kind: "error", status: null, data: null, summary,
    fetchedAt: new Date().toISOString(), urlMasked: "", totalCount: null,
  };
}

async function loggedGet<T>(
  operation: string,
  url: string,
  parse: (items: Record<string, unknown>[]) => T | null,
  requiredFields: readonly string[] = [],
): Promise<KtoResult<T>> {
  const key = serviceKey();
  const fetchedAt = new Date().toISOString();
  const urlMasked = maskServiceKeyUrl(url);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(resolveKtoFetchTimeout()),
    });
    const durationMs = Date.now() - started;
    const status = response.status;
    const wire = parseKtoWire(await response.text());

    let failure = "";
    if (wire.gatewayCode) failure = `게이트웨이 오류 ${wire.gatewayCode}: ${wire.gatewayMessage}`;
    else if (wire.contractError) failure = wire.contractError;
    else if (!response.ok) failure = `HTTP ${status}: ${wire.resultMsg || "요청 실패"}`;
    else if (!isKtoSuccessCode(wire.resultCode)) {
      failure = `resultCode=${wire.resultCode ?? "없음"}: ${wire.resultMsg || "API 오류"}`;
    } else {
      const fieldError = requiredRawFieldError(wire.items, requiredFields);
      if (fieldError) failure = `응답 필드 계약 오류: ${fieldError}`;
    }

    if (failure) {
      const result: KtoResult<T> = {
        ok: false, kind: "error", status, data: null,
        summary: scrubSecret(failure, key), fetchedAt, urlMasked, totalCount: wire.totalCount,
      };
      await writeLog(operation, result, durationMs);
      return result;
    }

    const data = parse(wire.items);
    const empty = wire.totalCount === 0;
    const parseFailed = !empty && (data === null || (Array.isArray(data) && data.length === 0));
    if (parseFailed) {
      const result: KtoResult<T> = {
        ok: false, kind: "error", status, data: null,
        summary: "양수 totalCount 응답을 유효 데이터로 변환하지 못했습니다.",
        fetchedAt, urlMasked, totalCount: wire.totalCount,
      };
      await writeLog(operation, result, durationMs);
      return result;
    }
    const result: KtoResult<T> = {
      ok: !empty,
      kind: empty ? "empty" : "success",
      status,
      data: empty ? null : data,
      summary: empty
        ? "인가된 빈 결과"
        : Array.isArray(data)
          ? `${data.length}건(전체 ${wire.totalCount ?? "미확인"}건)`
          : `${wire.items.length || 1}건(전체 ${wire.totalCount ?? "미확인"}건)`,
      fetchedAt,
      urlMasked,
      totalCount: wire.totalCount,
    };
    await writeLog(operation, result, durationMs);
    return result;
  } catch (error) {
    const result: KtoResult<T> = {
      ok: false, kind: "error", status: null, data: null,
      summary: scrubSecret(error instanceof Error ? error.message : "네트워크 오류", key),
      fetchedAt, urlMasked, totalCount: null,
    };
    await writeLog(operation, result, Date.now() - started);
    return result;
  }
}

async function writeLog(operation: string, result: KtoResult<unknown>, durationMs: number) {
  await prisma.apiCallLog.create({
    data: {
      operation, urlMasked: result.urlMasked, status: result.status, ok: result.ok,
      durationMs, resultKind: result.kind, summary: result.summary,
    },
  });
}

function withKey(base: string, path: string, params: Record<string, string | number | undefined>) {
  const key = serviceKey();
  if (!key) return null;
  const search = new URLSearchParams({
    serviceKey: key, MobileOS: "ETC", MobileApp: "FESTCompass", _type: "json",
  });
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(name, String(value));
  }
  return `${base}${path}?${search.toString()}`;
}

function mapFestival(item: Record<string, unknown>): FestivalHit {
  const rawAdminArea = text(pick(item, "lDongRegnCd", "ldongRegnCd", "ldongregncd"));
  const rawAdminSigngu = text(pick(item, "lDongSignguCd", "ldongSignguCd", "ldongsigngucd"));
  const adminCodes = normalizeAdminCodes(rawAdminArea, rawAdminSigngu);
  return {
    contentId: text(pick(item, "contentid", "contentId")),
    title: text(pick(item, "title")), addr1: text(pick(item, "addr1")),
    eventstartdate: text(pick(item, "eventstartdate")),
    eventenddate: text(pick(item, "eventenddate")),
    mapx: text(pick(item, "mapx")), mapy: text(pick(item, "mapy")),
    areacode: text(pick(item, "areacode", "areaCode")),
    sigungucode: text(pick(item, "sigungucode", "sigunguCode")),
    ldongRegnCd: adminCodes?.areaCd ?? "",
    ldongSignguCd: adminCodes?.signguCd ?? "",
    tel: text(pick(item, "tel")),
  };
}

export async function searchFestivalsByKeyword(keyword: string): Promise<KtoResult<FestivalHit[]>> {
  const url = withKey(TOUR_BASE, "/searchKeyword2", {
    numOfRows: 8, pageNo: 1, keyword, contentTypeId: 15,
  });
  if (!url) return missingKeyResult();
  return loggedGet("searchKeyword2", url, (items) => items.map(mapFestival), FESTIVAL_LIST_FIELDS);
}

export async function searchFestivalsByDate(input: {
  eventStartDate: string;
  eventEndDate?: string;
  areaCode?: string;
}): Promise<KtoResult<FestivalHit[]>> {
  const url = withKey(TOUR_BASE, "/searchFestival2", {
    numOfRows: 20, pageNo: 1,
    eventStartDate: input.eventStartDate.replaceAll("-", ""),
    eventEndDate: input.eventEndDate?.replaceAll("-", ""),
    areaCode: input.areaCode,
  });
  if (!url) return missingKeyResult();
  return loggedGet("searchFestival2", url, (items) => items.map(mapFestival), FESTIVAL_LIST_FIELDS);
}

function mapFestivalCommon(item: Record<string, unknown>): Record<string, string> {
  const rawAdminArea = text(pick(item, "lDongRegnCd", "ldongRegnCd", "ldongregncd"));
  const rawAdminSigngu = text(pick(item, "lDongSignguCd", "ldongSignguCd", "ldongsigngucd"));
  const adminCodes = normalizeAdminCodes(rawAdminArea, rawAdminSigngu);
  return {
    contentId: text(pick(item, "contentid", "contentId")),
    title: text(pick(item, "title")), overview: text(pick(item, "overview")),
    addr1: text(pick(item, "addr1")), mapx: text(pick(item, "mapx")),
    mapy: text(pick(item, "mapy")), areacode: text(pick(item, "areacode", "areaCode")),
    sigungucode: text(pick(item, "sigungucode", "sigunguCode")),
    ldongRegnCd: adminCodes?.areaCd ?? "",
    ldongSignguCd: adminCodes?.signguCd ?? "",
    tel: text(pick(item, "tel")),
  };
}

export function mergeFestivalDetailParts(
  common: Record<string, string>,
  intro: Record<string, string>,
): FestivalDetailData | null {
  const contentId = common.contentId?.trim() ?? "";
  const title = common.title?.trim() ?? "";
  const eventstartdate = intro.eventstartdate?.trim() ?? "";
  const eventenddate = intro.eventenddate?.trim() ?? "";
  if (!contentId || !title) return null;
  if (!isValidYmd(eventstartdate) || !isValidYmd(eventenddate)) return null;
  if (eventenddate < eventstartdate) return null;
  return { ...common, ...intro, contentId, title, eventstartdate, eventenddate };
}

function isValidYmd(value: string): boolean {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function failedDetailPart<T>(
  part: string,
  result: KtoResult<T>,
  partial: boolean,
): KtoResult<FestivalDetailData> {
  return {
    ...result,
    ok: false,
    kind: partial ? "error" : result.kind,
    data: null,
    summary: `${part} ${result.summary}${partial ? " — 부분 상세는 폐기했습니다." : ""}`,
  };
}

export async function getFestivalDetail(contentId: string): Promise<KtoResult<FestivalDetailData>> {
  const commonUrl = withKey(TOUR_BASE, "/detailCommon2", { contentId, numOfRows: 1, pageNo: 1 });
  if (!commonUrl) return missingKeyResult();
  const common = await loggedGet(
    "detailCommon2",
    commonUrl,
    (items) => items[0] ? mapFestivalCommon(items[0]) : null,
    FESTIVAL_COMMON_FIELDS,
  );
  if (!common.ok || !common.data) return failedDetailPart("detailCommon2", common, false);

  const introUrl = withKey(TOUR_BASE, "/detailIntro2", {
    contentId, contentTypeId: 15, numOfRows: 1, pageNo: 1,
  });
  if (!introUrl) return missingKeyResult();
  const intro = await loggedGet(
    "detailIntro2",
    introUrl,
    (items) => items[0] ? {
      eventstartdate: text(pick(items[0], "eventstartdate")),
      eventenddate: text(pick(items[0], "eventenddate")),
    } : null,
    FESTIVAL_INTRO_FIELDS,
  );
  if (!intro.ok || !intro.data) return failedDetailPart("detailIntro2", intro, true);

  const merged = mergeFestivalDetailParts(common.data, intro.data);
  if (!merged) {
    return {
      ok: false, kind: "error", status: intro.status, data: null,
      summary: "detailCommon2/detailIntro2 필수 식별자·일정 결합에 실패해 부분 상세를 폐기했습니다.",
      fetchedAt: intro.fetchedAt, urlMasked: intro.urlMasked, totalCount: intro.totalCount,
    };
  }
  return {
    ok: true, kind: "success", status: intro.status, data: merged,
    summary: "detailCommon2 + detailIntro2 검증 결합 1건",
    fetchedAt: intro.fetchedAt, urlMasked: intro.urlMasked, totalCount: 1,
  };
}

function mapVisitor(item: Record<string, unknown>): VisitorPoint {
  return {
    baseYmd: text(pick(item, "baseYmd")), areaCode: text(pick(item, "areaCode")),
    areaNm: text(pick(item, "areaNm")), signguCode: text(pick(item, "signguCode")),
    signguNm: text(pick(item, "signguNm")), daywkDivCd: text(pick(item, "daywkDivCd")),
    daywkDivNm: text(pick(item, "daywkDivNm")), touDivCd: text(pick(item, "touDivCd")),
    touDivNm: text(pick(item, "touDivNm")), touNum: num(pick(item, "touNum")),
  };
}

/**
 * metcoRegnVisitrDDList has no area request parameter. Page nationwide province rows,
 * then filter the response areaCode locally. locgo is reserved until a verified
 * legal-district mapping exists.
 */
export async function getRegionalVisitors(input: {
  stdAreaCd: string;
  startYmd: string;
  endYmd: string;
}): Promise<KtoResult<VisitorPoint[]>> {
  if (!serviceKey()) return missingKeyResult();
  const candidates = new Set(areaCodeCandidatesForStd(input.stdAreaCd));
  const allRows: VisitorPoint[] = [];
  let fetchedAt = new Date().toISOString();
  let lastUrlMasked = "";
  let totalCount: number | null = null;

  for (let pageNo = 1; pageNo <= VISITOR_MAX_PAGES; pageNo += 1) {
    const url = withKey(DATALAB_BASE, "/metcoRegnVisitrDDList", {
      numOfRows: VISITOR_PAGE_SIZE, pageNo,
      startYmd: input.startYmd.replaceAll("-", ""),
      endYmd: input.endYmd.replaceAll("-", ""),
    });
    if (!url) return missingKeyResult();
    const page = await loggedGet(
      "metcoRegnVisitrDDList",
      url,
      (items) => items.map(mapVisitor),
      VISITOR_FIELDS,
    );
    fetchedAt = page.fetchedAt;
    lastUrlMasked = page.urlMasked;
    totalCount = page.totalCount;
    if (page.kind === "error") return page;
    const rows = page.data ?? [];
    allRows.push(...rows);
    if (page.kind === "empty" || rows.length === 0) break;
    if (totalCount !== null && allRows.length >= totalCount) break;
    if (totalCount === null && rows.length < VISITOR_PAGE_SIZE) break;
    if (pageNo === VISITOR_MAX_PAGES) {
      return validationError(
        `지역별 방문자 전국 결과가 ${VISITOR_MAX_PAGES} 페이지를 넘어 부분 데이터를 폐기했습니다.`,
      );
    }
  }

  const selected = allRows.filter((row) => candidates.has(String(Number(row.areaCode))));
  if (!selected.length) {
    return {
      ok: false, kind: "empty", status: 200, data: null,
      summary: `인가된 빈 결과(전국 ${allRows.length}건 중 대상 시도 없음)`,
      fetchedAt, urlMasked: lastUrlMasked, totalCount,
    };
  }
  return {
    ok: true, kind: "success", status: 200, data: selected,
    summary: `${selected.length}건(전국 ${allRows.length}건 필터)`,
    fetchedAt, urlMasked: lastUrlMasked, totalCount,
  };
}

function mapDemand(item: Record<string, unknown>): DemandIntensityPoint {
  return {
    baseYm: text(pick(item, "baseYm")), areaCd: text(pick(item, "areaCd")),
    areaNm: text(pick(item, "areaNm")), signguCd: text(pick(item, "signguCd")),
    signguNm: text(pick(item, "signguNm")), tarExpDsIxCd: text(pick(item, "tarExpDsIxCd")),
    tarExpDsIxNm: text(pick(item, "tarExpDsIxNm")), tarExpDsIxVal: num(pick(item, "tarExpDsIxVal")),
    tarSjrnDsIxCd: text(pick(item, "tarSjrnDsIxCd")),
    tarSjrnDsIxNm: text(pick(item, "tarSjrnDsIxNm")),
    tarSjrnDsIxVal: num(pick(item, "tarSjrnDsIxVal")),
  };
}

export async function getDemandIntensity(input: {
  stdAreaCd: string;
  baseYm: string;
}): Promise<KtoResult<DemandIntensityData>> {
  const url = withKey(DEMAND_BASE, "/areaTarExpDsList", {
    numOfRows: 100, pageNo: 1, areaCd: input.stdAreaCd,
    baseYm: input.baseYm.replaceAll("-", "").slice(0, 6),
  });
  if (!url) return missingKeyResult();
  return loggedGet("areaTarExpDsList", url, (items) => {
    const points = items.map(mapDemand);
    if (!points.length) return null;
    const aggregate = points.find((point) => point.tarExpDsIxCd === "22");
    return {
      baseYm: aggregate?.baseYm || points[0].baseYm,
      areaNm: aggregate?.areaNm || points[0].areaNm,
      score: aggregate?.tarExpDsIxVal ?? null,
      scoreCode: aggregate?.tarExpDsIxCd ?? "",
      scoreName: aggregate?.tarExpDsIxNm ?? "",
      items: points,
    };
  }, DEMAND_FIELDS);
}

function validAdminCodes(areaCd: string, signguCd: string): boolean {
  return /^\d{2}$/.test(areaCd) && /^\d{5}$/.test(signguCd) && signguCd.startsWith(areaCd);
}

type CompletePageOptions = {
  pageSize?: number;
  maxPages?: number;
};

function paginationFailure<T>(
  summary: string,
  last: KtoResult<T[]> | null,
  totalCount: number | null,
): KtoResult<T[]> {
  return {
    ok: false,
    kind: "error",
    status: last?.status ?? null,
    data: null,
    summary: `${summary} 부분 데이터는 폐기했습니다.`,
    fetchedAt: last?.fetchedAt ?? new Date().toISOString(),
    urlMasked: last?.urlMasked ?? "",
    totalCount,
  };
}

/**
 * Collect a changing KTO dataset only when every page is present. Exact repeated
 * pages, totalCount drift, page errors, and safety-cap exhaustion discard all
 * previously received rows instead of exposing a partial observation.
 */
export async function collectCompletePages<T>(
  fetchPage: (pageNo: number, pageSize: number) => Promise<KtoResult<T[]>>,
  options: CompletePageOptions = {},
): Promise<KtoResult<T[]>> {
  const pageSize = options.pageSize ?? COMPLETE_PAGE_SIZE;
  const maxPages = options.maxPages ?? COMPLETE_MAX_PAGES;
  if (!Number.isInteger(pageSize) || pageSize <= 0 || !Number.isInteger(maxPages) || maxPages <= 0) {
    return paginationFailure("페이지네이션 안전 한도가 올바르지 않습니다.", null, null);
  }

  const rows: T[] = [];
  const pageSignatures = new Set<string>();
  let expectedTotal: number | null = null;
  let last: KtoResult<T[]> | null = null;

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const page = await fetchPage(pageNo, pageSize);
    last = page;
    if (page.kind === "error") {
      return paginationFailure(`${pageNo}페이지 호출 실패: ${page.summary}`, page, expectedTotal);
    }
    if (page.kind === "empty") {
      if (pageNo === 1 && page.totalCount === 0) return page;
      return paginationFailure(`${pageNo}페이지가 전체 건수 완주 전에 비었습니다.`, page, expectedTotal);
    }
    if (!page.data?.length || page.totalCount === null || page.totalCount <= 0) {
      return paginationFailure(`${pageNo}페이지의 성공 건수 계약이 불완전합니다.`, page, expectedTotal);
    }
    if (expectedTotal === null) expectedTotal = page.totalCount;
    else if (page.totalCount !== expectedTotal) {
      return paginationFailure(
        `${pageNo}페이지에서 totalCount가 ${expectedTotal}→${page.totalCount}로 변경되었습니다.`,
        page,
        expectedTotal,
      );
    }

    const signature = JSON.stringify(page.data);
    if (pageSignatures.has(signature)) {
      return paginationFailure(`${pageNo}페이지가 앞선 페이지와 동일하게 반복되었습니다.`, page, expectedTotal);
    }
    pageSignatures.add(signature);
    rows.push(...page.data);

    if (rows.length > expectedTotal) {
      return paginationFailure(`수집 행 ${rows.length}건이 totalCount ${expectedTotal}건을 초과했습니다.`, page, expectedTotal);
    }
    if (rows.length === expectedTotal) {
      return {
        ok: true,
        kind: "success",
        status: page.status,
        data: rows,
        summary: `${rows.length}건 전체 페이지 완주`,
        fetchedAt: page.fetchedAt,
        urlMasked: page.urlMasked,
        totalCount: expectedTotal,
      };
    }
  }

  return paginationFailure(
    `${maxPages}페이지 안전 상한에서 ${rows.length}/${expectedTotal ?? "?"}건만 수집했습니다.`,
    last,
    expectedTotal,
  );
}

export async function getConcentration(input: {
  areaCd: string;
  signguCd: string;
  tAtsNm?: string;
}): Promise<KtoResult<ConcentrationPoint[]>> {
  if (!validAdminCodes(input.areaCd, input.signguCd)) {
    return validationError("검증된 법정동 시도(2자리)·시군구(5자리) 코드가 없어 집중률 호출을 건너뜁니다.");
  }
  if (!serviceKey()) return missingKeyResult();
  return collectCompletePages((pageNo, pageSize) => {
    const url = withKey(CONCENTRATION_BASE, "/tatsCnctrRatedList", {
      numOfRows: pageSize, pageNo, areaCd: input.areaCd, signguCd: input.signguCd,
      tAtsNm: input.tAtsNm,
    });
    if (!url) return Promise.resolve(missingKeyResult<ConcentrationPoint[]>());
    return loggedGet("tatsCnctrRatedList", url, (items) => items.map((row) => ({
      tAtsNm: text(pick(row, "tAtsNm")), baseYmd: text(pick(row, "baseYmd")),
      areaCd: text(pick(row, "areaCd")), areaNm: text(pick(row, "areaNm")),
      signguCd: text(pick(row, "signguCd")), signguNm: text(pick(row, "signguNm")),
      cnctrRate: num(pick(row, "cnctrRate")),
    })), CONCENTRATION_FIELDS);
  });
}

export async function getRelatedTourism(input: {
  baseYm: string;
  areaCd: string;
  signguCd: string;
}): Promise<KtoResult<RelatedTourismPoint[]>> {
  if (!validAdminCodes(input.areaCd, input.signguCd)) {
    return validationError("검증된 법정동 시도(2자리)·시군구(5자리) 코드가 없어 연관 관광지 호출을 건너뜁니다.");
  }
  if (!serviceKey()) return missingKeyResult();
  const result = await collectCompletePages((pageNo, pageSize) => {
    const url = withKey(RELATED_BASE, "/areaBasedList1", {
      numOfRows: pageSize, pageNo,
      baseYm: input.baseYm.replaceAll("-", "").slice(0, 6),
      areaCd: input.areaCd, signguCd: input.signguCd,
    });
    if (!url) return Promise.resolve(missingKeyResult<RelatedTourismPoint[]>());
    return loggedGet("tarRlteTarAreaBasedList1", url, (items) => items.map((row) => ({
      baseYm: text(pick(row, "baseYm")), tAtsCd: text(pick(row, "tAtsCd")),
      tAtsNm: text(pick(row, "tAtsNm")), areaCd: text(pick(row, "areaCd")),
      areaNm: text(pick(row, "areaNm")), signguCd: text(pick(row, "signguCd")),
      signguNm: text(pick(row, "signguNm")), rlteTatsCd: text(pick(row, "rlteTatsCd")),
      rlteTatsNm: text(pick(row, "rlteTatsNm")), rlteRegnCd: text(pick(row, "rlteRegnCd")),
      rlteRegnNm: text(pick(row, "rlteRegnNm")), rlteSignguCd: text(pick(row, "rlteSignguCd")),
      rlteSignguNm: text(pick(row, "rlteSignguNm")),
      rlteCtgryLclsNm: text(pick(row, "rlteCtgryLclsNm")),
      rlteCtgryMclsNm: text(pick(row, "rlteCtgryMclsNm")),
      rlteCtgrySclsNm: text(pick(row, "rlteCtgrySclsNm")),
      rlteRank: num(pick(row, "rlteRank")),
    })), RELATED_FIELDS);
  });
  if (!result.data) return result;
  return {
    ...result,
    data: [...result.data].sort((left, right) =>
      (left.rlteRank ?? Number.POSITIVE_INFINITY) - (right.rlteRank ?? Number.POSITIVE_INFINITY)),
  };
}
