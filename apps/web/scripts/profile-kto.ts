import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { normalizeAdminCodes } from "../lib/kto/areacode";
import { runKtoProbe, validDate, type ProbeSpec, type ProbeSummary } from "../lib/kto/probe";
import { scrubSecret } from "../lib/kto/security";

const source = (id: string) => `https://www.data.go.kr/data/${id}/openapi.do`;
const string = (value: unknown) => String(value ?? "").trim();

async function main() {
  const { values } = parseArgs({ options: {
    keyword: { type: "string", multiple: true }, month: { type: "string", default: "202604" },
    start: { type: "string", default: "20260401" }, end: { type: "string", default: "20260403" },
    output: { type: "string", default: "output/research/kto-profile.json" },
  } });
  const key = process.env.TOUR_API_KEY?.trim();
  if (!key) throw new Error("TOUR_API_KEY가 필요합니다. 기존 로컬 .env 또는 환경변수로 설정하세요.");
  const keywords = [...new Set(values.keyword ?? ["치즈", "백제문화제", "논산딸기"])];
  if (!keywords.length || keywords.length > 3 || keywords.some((word) => !word.trim() || word.length > 50)) throw new Error("축제 검색어는 1~3개, 각 1~50자로 지정하세요.");
  const start = validDate(values.start), end = validDate(values.end);
  if (!start || !end || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 6) throw new Error("방문자 표본 조회기간은 유효한 1~7일이어야 합니다.");
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(values.month)) throw new Error("month는 YYYYMM 형식이어야 합니다.");
  const output = resolve(values.output);
  const exists = await access(output).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  if (exists) throw new Error("출력 파일이 이미 존재합니다. 이전 증거를 보존하도록 다른 경로를 지정하세요.");
  const probes: ProbeSummary[] = [];
  const candidates: Record<string, unknown>[] = [];
  let unavailable = false;
  async function probe(spec: ProbeSpec) {
    if (probes.length >= 32) throw new Error("한 번의 조사 호출 상한(32회)에 도달했습니다.");
    const result = await runKtoProbe(spec, key!);
    probes.push(result.summary);
    if (["20", "22", "23", "29", "30", "31"].includes(result.summary.resultCode ?? "") || [401, 403, 429].includes(result.summary.httpStatus ?? 0)) unavailable = true;
    console.log(scrubSecret(`${spec.label}: ${result.summary.status}, 표본 ${result.summary.sampledRows}/${result.summary.totalCount ?? "?"}, ${result.summary.collection}`, key));
    return result;
  }

  for (const keyword of keywords) {
    if (unavailable) break;
    const list = await probe({ label: `축제 검색 ${keyword}`, service: "KorService2", operation: "searchKeyword2",
      params: { keyword, contentTypeId: 15, numOfRows: 5 }, requiredFields: ["contentid", "title"],
      sourceUrl: source("15101578"), meaning: "metadata" });
    const selected = list.items[0];
    if (!selected || unavailable) continue;
    const contentId = string(selected.contentid);
    if (!/^\d+$/.test(contentId)) continue;
    const common = await probe({ label: `${keyword} 공통 상세`, service: "KorService2", operation: "detailCommon2",
      params: { contentId, numOfRows: 1 }, requiredFields: ["contentid", "title"], sourceUrl: source("15101578"), meaning: "metadata" });
    if (unavailable) break;
    const intro = await probe({ label: `${keyword} 축제 일정`, service: "KorService2", operation: "detailIntro2",
      params: { contentId, contentTypeId: 15, numOfRows: 1 }, requiredFields: ["contentid", "eventstartdate", "eventenddate"], sourceUrl: source("15101578"), meaning: "metadata" });
    const row = common.items[0], dates = intro.items[0];
    const starts = validDate(dates?.eventstartdate), ends = validDate(dates?.eventenddate);
    const joined = Boolean(row && dates && common.summary.totalCount === 1 && intro.summary.totalCount === 1
      && string(row.contentid) === contentId && string(dates.contentid) === contentId && starts && ends && starts <= ends);
    const codes = joined ? normalizeAdminCodes(string(row.lDongRegnCd ?? row.ldongRegnCd), string(row.lDongSignguCd ?? row.ldongSignguCd)) : null;
    candidates.push({ keyword, contentId, title: string(row?.title ?? selected.title),
      startDate: starts, endDate: ends, address: string(row?.addr1), adminCodes: codes,
      metadataVerified: joined, selection: "candidate-only", searchTotalCount: list.summary.totalCount,
      note: "검색 첫 결과를 후보로 조사. 최종 선정·과거 회차 확보·현장 검증은 별도 필요." });
    if (!codes || unavailable) continue;
    for (const service of ["AreaTarDemDsService", "AreaTarResDemService"] as const) {
      for (const includeSigngu of [false, true]) {
        if (unavailable) break;
        const demand = service === "AreaTarDemDsService";
        const prefix = demand ? "tarExpDsIx" : "tarSvcDemIx";
        await probe({ label: `${keyword} ${demand ? "소비 강도" : "자원 수요"} ${includeSigngu ? "시군구 지정" : "시도 지정"}`,
          service, operation: demand ? "areaTarExpDsList" : "areaTarSvcDemList",
          params: { baseYm: values.month, areaCd: codes.areaCd, ...(includeSigngu ? { signguCd: codes.signguCd } : {}) },
          requiredFields: ["baseYm", "areaCd", `${prefix}Cd`, `${prefix}Nm`, `${prefix}Val`], numericFields: [`${prefix}Val`],
          sourceUrl: source(demand ? "15151868" : "15152138"), meaning: "regional-statistic" });
      }
    }
    if (unavailable) break;
    await probe({ label: `${keyword} 주변 관광지 집중률`, service: "TatsCnctrRateService", operation: "tatsCnctrRatedList",
      params: codes, requiredFields: ["tAtsNm", "baseYmd", "areaCd", "signguCd", "cnctrRate"], numericFields: ["cnctrRate"], dateField: "baseYmd",
      sourceUrl: source("15128555"), meaning: "provider-forecast" });
    if (unavailable) break;
    await probe({ label: `${keyword} 연관 관광지`, service: "TarRlteTarService1", operation: "areaBasedList1",
      params: { ...codes, baseYm: values.month }, requiredFields: ["baseYm", "tAtsCd", "tAtsNm", "rlteTatsCd", "rlteTatsNm", "rlteRank"], numericFields: ["rlteRank"],
      sourceUrl: source("15128560"), meaning: "related-ranking" });
  }
  if (!unavailable) await probe({ label: "광역 방문자 전국 표본", service: "DataLabService", operation: "metcoRegnVisitrDDList",
    params: { startYmd: values.start, endYmd: values.end, numOfRows: 1000 }, requiredFields: ["baseYmd", "areaCode", "areaNm", "touDivNm", "touNum"],
    numericFields: ["touNum"], dateField: "baseYmd", sourceUrl: source("15101972"), meaning: "regional-statistic" });
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), purpose: "candidate-and-data-sampling",
    scope: { keywords, month: values.month, visitorStart: values.start, visitorEnd: values.end, maximumCalls: 32 },
    stoppedForAccessOrQuota: unavailable,
    limitations: ["페이지 표본의 결측률·기간은 전체 데이터 범위를 보증하지 않는다.", "현재 축제 상세로 과거 개최회차를 확보했다고 판단하지 않는다.",
      "관광지 집중률은 공급자의 향후 30일 예측이며 축제 입장객 실측이 아니다.", "API 기술 응답 성공은 고객 가치·예측 성능·현장 검증 완료가 아니다."],
    candidates, probes };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, scrubSecret(JSON.stringify(report, null, 2), key) + "\n", { mode: 0o600, flag: "wx" });
  console.log(`조사 보고서 저장: ${output} (${probes.length}회 호출)`);
  if (unavailable || probes.some((entry) => entry.status === "error")) process.exitCode = 1;
}

main().catch(() => {
  // Never print uncontrolled filesystem/network exceptions that could embed credentials.
  console.error("조사를 완료하지 못했습니다. 키 설정·인수 형식·출력 파일 중복 여부를 확인하세요.");
  process.exitCode = 1;
});
