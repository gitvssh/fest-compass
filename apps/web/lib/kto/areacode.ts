/**
 * KTO 관광정보 API(KorService2)의 areaCode와
 * 데이터랩 계열 API(DataLabService·TatsCnctrRateService·AreaTarDemDsService 등)의
 * areaCd(행정표준 시도코드)는 서로 다른 코드 체계다.
 *
 * 예: 전북 — KorService2에서는 37, 행정표준코드는 52(전북특별자치도).
 * 이 모듈이 두 체계 사이의 유일한 변환 지점이다. 데이터랩 계열 호출에
 * KorService2 코드를 그대로 넘기면 다른 지역을 조회하거나 빈 결과가 된다.
 *
 * legacy 코드(강원 42, 전북 45)는 특별자치도 승격 이전 코드다. 데이터랩 계열이
 * 신·구 어느 쪽을 받는지는 활용신청 승인 후 실호출로 확정한다(API명세서 §부록 A).
 */

export type SidoMapping = {
  korAreaCode: string; // KorService2 areaCode
  stdAreaCd: string; // 행정표준 시도코드 (법정동코드 상위 2자리)
  legacyAreaCd?: string; // 특별자치도 승격 이전 코드
  name: string;
};

export const SIDO_MAPPINGS: SidoMapping[] = [
  { korAreaCode: "1", stdAreaCd: "11", name: "서울" },
  { korAreaCode: "2", stdAreaCd: "28", name: "인천" },
  { korAreaCode: "3", stdAreaCd: "30", name: "대전" },
  { korAreaCode: "4", stdAreaCd: "27", name: "대구" },
  { korAreaCode: "5", stdAreaCd: "29", name: "광주" },
  { korAreaCode: "6", stdAreaCd: "26", name: "부산" },
  { korAreaCode: "7", stdAreaCd: "31", name: "울산" },
  { korAreaCode: "8", stdAreaCd: "36", name: "세종" },
  { korAreaCode: "31", stdAreaCd: "41", name: "경기" },
  { korAreaCode: "32", stdAreaCd: "51", legacyAreaCd: "42", name: "강원" },
  { korAreaCode: "33", stdAreaCd: "43", name: "충북" },
  { korAreaCode: "34", stdAreaCd: "44", name: "충남" },
  { korAreaCode: "35", stdAreaCd: "47", name: "경북" },
  { korAreaCode: "36", stdAreaCd: "48", name: "경남" },
  { korAreaCode: "37", stdAreaCd: "52", legacyAreaCd: "45", name: "전북" },
  { korAreaCode: "38", stdAreaCd: "46", name: "전남" },
  { korAreaCode: "39", stdAreaCd: "50", name: "제주" },
];

/** KorService2 areaCode → 행정표준 시도코드. 매핑이 없으면 null(호출을 건너뛰고 결측으로 기록). */
export function toStdAreaCd(korAreaCode: string | null | undefined): string | null {
  if (!korAreaCode) return null;
  const hit = SIDO_MAPPINGS.find((row) => row.korAreaCode === String(Number(korAreaCode)));
  return hit ? hit.stdAreaCd : null;
}

export function sidoNameOf(korAreaCode: string | null | undefined): string | null {
  if (!korAreaCode) return null;
  const hit = SIDO_MAPPINGS.find((row) => row.korAreaCode === String(Number(korAreaCode)));
  return hit ? hit.name : null;
}

/**
 * 지역별 방문자 응답은 조회 파라미터로 areaCd를 받지 않고
 * 응답 행의 areaCode로 지역을 구분한다. 역사 데이터에는 특별자치도
 * 승격 전 코드가 남을 수 있어, 동일 시도의 현행·구 코드를 모두 필터로 허용한다.
 */
export function areaCodeCandidatesForStd(stdAreaCd: string): string[] {
  const normalized = String(Number(stdAreaCd));
  const hit = SIDO_MAPPINGS.find(
    (row) => row.stdAreaCd === normalized || row.legacyAreaCd === normalized,
  );
  if (!hit) return [normalized];
  return [hit.stdAreaCd, hit.legacyAreaCd].filter((value): value is string => Boolean(value));
}

/** KorService2 areaCode와 KTO가 제공한 법정동 시도코드가 같은 지역인지 확인. */
export function isCompatibleAdminAreaCode(
  korAreaCode: string | null | undefined,
  adminAreaCd: string | null | undefined,
): boolean {
  if (!korAreaCode || !adminAreaCd) return false;
  const std = toStdAreaCd(korAreaCode);
  if (!std) return false;
  return areaCodeCandidatesForStd(std).includes(String(Number(adminAreaCd)));
}

/**
 * KorService2의 신형 법정동 필드는 시도 2자리와 시군구 하위 3자리를
 * 분리해서 주기도 하고, 시군구 전체 5자리를 주기도 한다. 내부에서는
 * 집중률·연관 관광지 API가 요구하는 2자리/5자리 쌍으로만 보관한다.
 */
export function normalizeAdminCodes(
  areaCd: string | null | undefined,
  signguCd: string | null | undefined,
): { areaCd: string; signguCd: string } | null {
  const area = String(areaCd ?? "").trim();
  const signgu = String(signguCd ?? "").trim();
  if (!/^\d{2}$/.test(area)) return null;
  const fullSigngu = /^\d{3}$/.test(signgu) ? `${area}${signgu}` : signgu;
  if (!/^\d{5}$/.test(fullSigngu) || !fullSigngu.startsWith(area)) return null;
  return { areaCd: area, signguCd: fullSigngu };
}
