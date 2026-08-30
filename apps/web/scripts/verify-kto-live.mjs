// data.go.kr 활용신청 승인 후 실행:
//   node scripts/verify-kto-live.mjs
//
// 출력 계약:
// - 키·URL·원문 샘플을 출력하지 않는다.
// - 응답 형식, resultCode, 건수, 필드명, 숫자로 검증된 행정코드만 출력한다.
// - 원문·URL 인코딩 키를 모든 진단 문자열에서 제거한다.
// - 인가된 totalCount=0은 정상 empty이며 실패가 아니다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env"), "utf8");
const key = env.match(/^\s*TOUR_API_KEY\s*=\s*"?([^"\r\n]+)"?\s*$/m)?.[1]?.trim();
if (!key) {
  console.error("TOUR_API_KEY가 .env에 없습니다.");
  process.exit(1);
}

function secretVariants(secret) {
  const variants = new Set([secret, encodeURIComponent(secret)]);
  variants.add(new URLSearchParams({ serviceKey: secret }).toString().slice("serviceKey=".length));
  try { variants.add(decodeURIComponent(secret)); } catch {}
  return [...variants].filter(Boolean).sort((a, b) => b.length - a.length);
}

function scrub(value) {
  let safe = value === null || value === undefined ? "" : String(value);
  for (const variant of secretVariants(key)) safe = safe.replaceAll(variant, "***");
  return safe;
}

function out(...values) {
  console.log(values.map(scrub).join(" "));
}

function err(...values) {
  console.error(values.map(scrub).join(" "));
}

const common = { MobileOS: "ETC", MobileApp: "FESTCompass", _type: "json" };
const failures = [];

function buildUrl(base, path, params) {
  const search = new URLSearchParams({ serviceKey: key, ...common });
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(name, String(value));
  }
  return `${base}${path}?${search}`;
}

function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asArray(value) {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

function xmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function xmlItems(xml) {
  const items = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const row = {};
    for (const field of match[1].matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
      row[field[1]] = decodeXml(field[2]);
    }
    if (Object.keys(row).length) items.push(row);
  }
  return items;
}

function parseWire(text) {
  const trimmed = text.trim();
  if (!trimmed) return { format: "unknown", contractError: "빈 응답", structure: [], items: [] };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let json;
    try { json = JSON.parse(trimmed); }
    catch { return { format: "unknown", contractError: "JSON 파싱 실패", structure: [], items: [] }; }
    const rootRecord = asRecord(json);
    if (!rootRecord) return { format: "json", contractError: "JSON 최상위가 객체가 아님", structure: [], items: [] };
    const gateway = asRecord(asRecord(rootRecord.OpenAPI_ServiceResponse)?.cmmMsgHeader);
    if (gateway) {
      return {
        format: "json", gatewayCode: String(gateway.returnReasonCode ?? ""),
        gatewayMessage: String(gateway.returnAuthMsg ?? gateway.errMsg ?? "게이트웨이 오류"),
        structure: ["OpenAPI_ServiceResponse", ...Object.keys(gateway)], items: [],
      };
    }
    const response = asRecord(rootRecord.response) ?? rootRecord;
    const header = asRecord(response.header);
    const body = asRecord(response.body);
    if (!header && !body && rootRecord.resultCode !== undefined) {
      const resultCode = String(rootRecord.resultCode);
      return {
        format: "json",
        resultCode,
        resultMsg: String(rootRecord.resultMsg ?? ""),
        totalCount: null,
        items: [],
        structure: Object.keys(rootRecord),
        contractError: isSuccess(resultCode) ? "성공 resultCode에 header/body 봉투가 없음" : null,
      };
    }
    const itemRoot = asRecord(body?.items);
    const rawItemsContainer = body?.items;
    const itemValues = asArray(itemRoot?.item);
    const parsedItems = itemValues.map(asRecord);
    const items = parsedItems.filter(Boolean);
    const totalCount = numberValue(body?.totalCount);
    const resultCode = header?.resultCode === undefined ? null : String(header.resultCode);
    let contractError = !header || !body || header.resultCode === undefined
      ? "header/body/resultCode 봉투 미확인" : null;
    if (!contractError && rawItemsContainer !== null && rawItemsContainer !== undefined && rawItemsContainer !== "" && !itemRoot) {
      contractError = "body.items가 객체 또는 빈 값이 아님";
    }
    if (!contractError && itemValues.length && parsedItems.some((item) => item === null)) {
      contractError = "items.item에 객체가 아닌 값이 포함됨";
    }
    if (!contractError && isSuccess(resultCode)) {
      if (totalCount === null || totalCount < 0) contractError = "성공 응답 totalCount 미확인";
      else if (totalCount === 0 && items.length > 0) contractError = "totalCount=0인데 item 존재";
      else if (totalCount > 0 && items.length === 0) contractError = "양수 totalCount인데 유효 item 없음";
      else if (items.length > totalCount) contractError = "item 수가 totalCount 초과";
    }
    return {
      format: "json", resultCode,
      resultMsg: String(header?.resultMsg ?? ""), totalCount, items,
      structure: [...new Set([
        ...Object.keys(rootRecord), ...Object.keys(response),
        ...Object.keys(header ?? {}), ...Object.keys(body ?? {}),
      ])],
      contractError,
    };
  }
  if (trimmed.startsWith("<")) {
    const structure = [...new Set([...trimmed.matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>/g)].map((m) => m[1]))];
    const gatewayCode = xmlTag(trimmed, "returnReasonCode") || null;
    if (gatewayCode || /<OpenAPI_ServiceResponse\b/i.test(trimmed)) {
      return {
        format: "xml", gatewayCode,
        gatewayMessage: xmlTag(trimmed, "returnAuthMsg") || xmlTag(trimmed, "errMsg") || "게이트웨이 오류",
        structure, items: [], contractError: gatewayCode ? null : "게이트웨이 코드 미확인",
      };
    }
    const resultCode = xmlTag(trimmed, "resultCode") || null;
    const totalCount = numberValue(xmlTag(trimmed, "totalCount"));
    const items = xmlItems(trimmed);
    let contractError = resultCode ? null : "XML resultCode 봉투 미확인";
    if (!contractError && isSuccess(resultCode)) {
      if (!/<header(?:\s|>)/i.test(trimmed) || !/<body(?:\s|>)/i.test(trimmed)) {
        contractError = "성공 XML header/body 봉투 미확인";
      } else if (totalCount === null || totalCount < 0) contractError = "성공 XML totalCount 미확인";
      else if (totalCount === 0 && items.length > 0) contractError = "XML totalCount=0인데 item 존재";
      else if (totalCount > 0 && items.length === 0) contractError = "XML 양수 totalCount인데 유효 item 없음";
      else if (items.length > totalCount) contractError = "XML item 수가 totalCount 초과";
    }
    return {
      format: "xml", resultCode, resultMsg: xmlTag(trimmed, "resultMsg"),
      totalCount, items, structure,
      contractError,
    };
  }
  return { format: "unknown", contractError: "알 수 없는 응답 형식", structure: [], items: [] };
}

function isSuccess(code) {
  return code === "0000" || code === "00";
}

function exactFields(items) {
  return items.length ? Object.keys(items[0]) : [];
}

function safeAdminCode(value, digits) {
  const candidate = String(value ?? "");
  return new RegExp(`^\\d{${digits}}$`).test(candidate) ? candidate : candidate ? "(invalid)" : "(missing)";
}

async function call(name, base, path, params, options = {}) {
  const { requiredFields = [], mode = "required", codeFields = false, requireItems = false } = options;
  try {
    const response = await fetch(buildUrl(base, path, params), { cache: "no-store" });
    const contentType = response.headers.get("content-type") ?? "(none)";
    const text = await response.text();
    const wire = parseWire(text);
    const digest = createHash("sha256").update(text).digest("hex").slice(0, 12);
    out(`[${name}] HTTP ${response.status} format=${wire.format} content-type=${contentType}`);

    if (wire.gatewayCode) {
      const message = `gateway=${wire.gatewayCode} ${wire.gatewayMessage}`;
      out(`  ${message}`);
      failures.push(`${name}: ${message}`);
      return { contractOk: false, authorized: false, success: false, items: [] };
    }
    if (wire.contractError) {
      const message = `${wire.contractError}; structure=${wire.structure.join(",") || "none"}; bodyHash=${digest}; bytes=${text.length}`;
      out(`  ${message}`);
      failures.push(`${name}: ${message}`);
      return { contractOk: false, authorized: false, success: false, items: [] };
    }

    const success = isSuccess(wire.resultCode);
    const count = wire.totalCount ?? wire.items.length;
    out(`  resultCode=${wire.resultCode} totalCount=${count} items=${wire.items.length}`);
    const fields = exactFields(wire.items);
    if (fields.length) out(`  응답 필드: ${fields.join(", ")}`);
    else out("  인가된 빈 결과: 필드 샘플 미확정");

    if (codeFields && wire.items[0]) {
      const area = safeAdminCode(wire.items[0].lDongRegnCd ?? wire.items[0].ldongRegnCd, 2);
      const rawSigngu = String(wire.items[0].lDongSignguCd ?? wire.items[0].ldongSignguCd ?? "");
      const signgu = /^\d{3}$/.test(rawSigngu) && /^\d{2}$/.test(area)
        ? `${area}${rawSigngu}`
        : safeAdminCode(rawSigngu, 5);
      const pairValid = /^\d{2}$/.test(area) && /^\d{5}$/.test(signgu) && signgu.startsWith(area);
      out(`  lDongRegnCd=${area} lDongSignguCd=${signgu} pair=${pairValid ? "valid" : "invalid"} sourceWidth=${rawSigngu.length}`);
      if (!pairValid) failures.push(`${name}: KTO 법정동 코드 쌍 미확정`);
    }

    if (wire.items.length && requiredFields.length) {
      for (let index = 0; index < wire.items.length; index += 1) {
        const itemFields = new Set(Object.keys(wire.items[index]).map((field) => field.toLowerCase()));
        const missing = requiredFields.filter((field) => !itemFields.has(field.toLowerCase()));
        if (missing.length) {
          failures.push(`${name}: ${index + 1}번째 item 필수 필드 누락 ${missing.join(",")}`);
          out(`  ${index + 1}번째 item 필수 필드 누락: ${missing.join(", ")}`);
          break;
        }
      }
    }

    if (requireItems && success && wire.items.length === 0) {
      failures.push(`${name}: 상세 계약 검증에 필요한 item 없음`);
      out("  상세 계약 검증에 필요한 item이 없습니다.");
    }

    if (mode === "required" && (!response.ok || !success)) {
      const message = `HTTP/resultCode 실패: ${wire.resultCode} ${wire.resultMsg ?? ""}`;
      failures.push(`${name}: ${message}`);
      out(`  ${message}`);
    }
    return {
      contractOk: true,
      authorized: true,
      success,
      items: wire.items,
      totalCount: count,
      resultCode: wire.resultCode,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch 실패";
    out(`[${name}] FETCH ERROR: ${message}`);
    failures.push(`${name}: ${message}`);
    return { contractOk: false, authorized: false, success: false, items: [] };
  }
}

function shiftedMonth(monthsBack) {
  const now = new Date();
  const shifted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return `${shifted.getUTCFullYear()}${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function probeMonths(name, base, path, extraParams, requiredFields) {
  const candidates = [...new Set(["202604", ...[8, 14, 20, 26, 32, 38].map(shiftedMonth)])];
  for (const baseYm of candidates) {
    const result = await call(`${name} baseYm=${baseYm}`, base, path, {
      numOfRows: 5, pageNo: 1, baseYm, ...extraParams,
    }, { requiredFields });
    if (!result.contractOk || !result.success) return result;
    if (result.items.length) return result;
  }
  out(`[${name}] 탐색 월 ${candidates.join(",")} 모두 인가된 빈 결과`);
  return { contractOk: true, authorized: true, success: true, items: [] };
}

const TOUR = "https://apis.data.go.kr/B551011/KorService2";
const DATALAB = "https://apis.data.go.kr/B551011/DataLabService";
const CNCTR = "https://apis.data.go.kr/B551011/TatsCnctrRateService";
const DEMAND = "https://apis.data.go.kr/B551011/AreaTarDemDsService";
const RESDEM = "https://apis.data.go.kr/B551011/AreaTarResDemService";
const RLTD = "https://apis.data.go.kr/B551011/TarRlteTarService1";

out("=== 1. 국문 관광정보 (15101578) ===");
const tourFields = ["contentid", "title", "lDongRegnCd", "lDongSignguCd"];
await call("searchFestival2 전북 가을", TOUR, "/searchFestival2", {
  numOfRows: 3, pageNo: 1, eventStartDate: "20260901", eventEndDate: "20261031", areaCode: 37,
}, { requiredFields: tourFields, codeFields: true });
const keywordResult = await call("searchKeyword2 치즈", TOUR, "/searchKeyword2", {
  numOfRows: 3, pageNo: 1, keyword: "치즈", contentTypeId: 15,
}, { requiredFields: tourFields, codeFields: true, requireItems: true });
const detailContentId = keywordResult.items[0]?.contentid;
if (detailContentId) {
  await call("detailCommon2 축제 상세", TOUR, "/detailCommon2", {
    numOfRows: 1, pageNo: 1, contentId: detailContentId,
  }, { requiredFields: ["contentid", "title"], requireItems: true });
  await call("detailIntro2 축제 일정", TOUR, "/detailIntro2", {
    numOfRows: 1, pageNo: 1, contentId: detailContentId, contentTypeId: 15,
  }, { requiredFields: ["eventstartdate", "eventenddate"], requireItems: true });
}
await call("searchFestival2 정상 empty", TOUR, "/searchFestival2", {
  numOfRows: 3, pageNo: 1, eventStartDate: "19800101", eventEndDate: "19800102",
});

out("\n=== 2. 광역 지역별 방문자 수 (15101972) ===");
const visitors = await call("metcoRegn 전국 일별", DATALAB, "/metcoRegnVisitrDDList", {
  numOfRows: 1000, pageNo: 1, startYmd: "20260401", endYmd: "20260403",
}, { requiredFields: ["baseYmd", "areaCode", "areaNm", "touDivNm", "touNum"] });
if (visitors.items.length) {
  const pairs = [...new Set(visitors.items
    .map((row) => {
      const code = safeAdminCode(row.areaCode, 2);
      const name = /^[\p{L}\s-]{1,30}$/u.test(String(row.areaNm ?? "")) ? String(row.areaNm) : "(invalid-name)";
      return `${code}:${name}`;
    }))].slice(0, 20);
  out(`  응답 시도코드(최대 20): ${pairs.join(", ")}`);
}

out("\n=== 3. 지역별 관광 소비 강도 (15151868) ===");
await probeMonths("areaTarExpDsList 충남", DEMAND, "/areaTarExpDsList", { areaCd: "44" }, [
  "baseYm", "areaCd", "areaNm", "tarExpDsIxCd", "tarExpDsIxNm", "tarExpDsIxVal",
]);

out("\n=== 4. 지역별 관광 서비스 수요 (15152138) ===");
await probeMonths("areaTarSvcDemList 충남", RESDEM, "/areaTarSvcDemList", { areaCd: "44" }, [
  "baseYm", "areaCd", "areaNm", "tarSvcDemIxCd", "tarSvcDemIxNm", "tarSvcDemIxVal",
]);

out("\n=== 5. 관광지 집중률 (15128555) ===");
await call("tatsCnctrRatedList 충남 논산", CNCTR, "/tatsCnctrRatedList", {
  numOfRows: 5, pageNo: 1, areaCd: "44", signguCd: "44230",
}, { requiredFields: ["tAtsNm", "baseYmd", "areaCd", "signguCd", "cnctrRate"] });

out("\n=== 6. 관광지별 연관 관광지 (15128560) ===");
const relatedFields = [
  "baseYm", "tAtsCd", "tAtsNm", "areaCd", "areaNm", "signguCd", "signguNm",
  "rlteTatsCd", "rlteTatsNm", "rlteRegnCd", "rlteRegnNm", "rlteSignguCd",
  "rlteSignguNm", "rlteCtgryLclsNm", "rlteCtgryMclsNm", "rlteCtgrySclsNm", "rlteRank",
];
await call("TarRlteTar 충남 논산 signgu 있음", RLTD, "/areaBasedList1", {
  numOfRows: 3, pageNo: 1, baseYm: "202604", areaCd: "44", signguCd: "44230",
}, { requiredFields: relatedFields });
const withoutSigngu = await call("TarRlteTar signgu 없음(필수 여부)", RLTD, "/areaBasedList1", {
  numOfRows: 3, pageNo: 1, baseYm: "202604", areaCd: "44",
}, { mode: "diagnostic" });
if (withoutSigngu.contractOk) {
  out(`  signguCd 판정: ${withoutSigngu.success ? "생략 호출 허용" : "필수(생략 시 API 거부)"}`);
}

out("\n=== 검증 요약 ===");
if (failures.length) {
  for (const failure of failures) err(`FAIL: ${failure}`);
  err(`계약 실패 ${failures.length}건 — 키 원문은 출력하지 않았습니다.`);
  process.exitCode = 1;
} else {
  out("전체 필수 계약 통과 — empty는 인가된 빈 결과로 별도 표시했습니다.");
}
