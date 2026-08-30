import { prisma } from "@/lib/db";
import {
  isCompatibleAdminAreaCode,
  normalizeAdminCodes,
  toStdAreaCd,
} from "@/lib/kto/areacode";
import {
  getConcentration,
  getDemandIntensity,
  getFestivalDetail,
  getRegionalVisitors,
  getRelatedTourism,
  hasTourKey,
  searchFestivalsByDate,
  type KtoKind,
} from "@/lib/kto/client";
import { buildVisitorWindows, previousYearMonth, type VisitorWindow } from "@/lib/kto/windows";

type FestivalRegion = {
  areaCode: string | null;
  ldongRegnCd: string | null;
  ldongSignguCd: string | null;
};

type FestivalIdentity = FestivalRegion & {
  contentId: string | null;
  provenance: string;
};

type RefreshedFestivalDetail = {
  contentId: string;
  areacode?: string;
  ldongRegnCd?: string;
  ldongSignguCd?: string;
};

async function saveSnapshot(input: {
  festivalId: string;
  apiName: string;
  sourceUrl?: string;
  baseDate?: string;
  aggregation: string;
  kind: "observation";
  value: unknown;
  status: KtoKind;
  interpretation: string;
  prohibition: string;
  rawSummary: string;
}) {
  await prisma.evidenceSnapshot.create({
    data: {
      festivalId: input.festivalId,
      apiName: input.apiName,
      sourceUrl: input.sourceUrl,
      baseDate: input.baseDate,
      fetchedAt: new Date(),
      aggregation: input.aggregation,
      kind: input.kind,
      valueJson: JSON.stringify(input.value),
      rawSummary: input.rawSummary,
      status: input.status,
      stale: false,
      interpretation: input.interpretation,
      prohibition: input.prohibition,
    },
  });
}

async function recordQuality(festivalId: string, note: string) {
  await prisma.dataQuality.create({
    data: { festivalId, issue: "definition_mismatch", status: "open", note },
  });
}

/**
 * Only KTO-provided legal-district fields are eligible for APIs that require a
 * five-digit signgu code. KorService2 sigungucode is deliberately never used.
 */
function verifiedAdminCodes(festival: FestivalRegion): { areaCd: string; signguCd: string } | null {
  const normalized = normalizeAdminCodes(festival.ldongRegnCd, festival.ldongSignguCd);
  if (!normalized) return null;
  const { areaCd, signguCd } = normalized;
  if (festival.areaCode && !isCompatibleAdminAreaCode(festival.areaCode, areaCd)) return null;
  return { areaCd, signguCd };
}

export function verifiedAdminCodesFromCurrentDetail(
  festival: FestivalIdentity,
  detail: RefreshedFestivalDetail | null,
): { areaCd: string; signguCd: string } | null {
  if (festival.provenance !== "kto" || !festival.contentId || detail?.contentId !== festival.contentId) {
    return null;
  }
  return verifiedAdminCodes({
    areaCode: detail.areacode || festival.areaCode,
    ldongRegnCd: detail.ldongRegnCd ?? null,
    ldongSignguCd: detail.ldongSignguCd ?? null,
  });
}

export function canonicalProvinceAreaCd(
  storedKorAreaCode: string | null,
  refreshedKorAreaCode: string | null,
): string | null {
  return toStdAreaCd(refreshedKorAreaCode || storedKorAreaCode);
}

export async function refreshFestivalEvidence(festivalId: string) {
  const festival = await prisma.festival.findUniqueOrThrow({ where: { id: festivalId } });
  let refreshedAdminCodes: { areaCd: string; signguCd: string } | null = null;
  let refreshedKorAreaCode: string | null = null;

  // A refresh attempt supersedes the freshness claim even when no key is
  // available. Previous observations remain visible only as stale evidence.
  await prisma.evidenceSnapshot.updateMany({
    where: { festivalId, kind: "observation" },
    data: { stale: true },
  });

  if (!hasTourKey()) {
    await prisma.dataQuality.create({
      data: {
        festivalId,
        issue: "missing",
        status: "key_absent",
        note: "TOUR_API_KEY가 없어 실호출을 건너뛰고 수동 입력은 유지하며 기존 스냅샷은 stale로 표시합니다.",
      },
    });
    return { refreshed: false, reason: "no_key" as const };
  }

  // E/F legal-district codes require both KTO provenance and a successful,
  // content-id-matching detail refresh in this attempt. Stored/manual fields
  // alone never authorize those calls.
  if (festival.provenance === "kto" && festival.contentId) {
    const detail = await getFestivalDetail(festival.contentId);
    const detailContentMatches = detail.data?.contentId === festival.contentId;
    if (detail.data && detailContentMatches) {
      refreshedKorAreaCode = detail.data.areacode || festival.areaCode;
      refreshedAdminCodes = verifiedAdminCodesFromCurrentDetail(festival, detail.data);
      if (
        refreshedAdminCodes &&
        (festival.ldongRegnCd !== refreshedAdminCodes.areaCd ||
          festival.ldongSignguCd !== refreshedAdminCodes.signguCd)
      ) {
        await prisma.festival.update({
          where: { id: festivalId },
          data: {
            ldongRegnCd: refreshedAdminCodes.areaCd,
            ldongSignguCd: refreshedAdminCodes.signguCd,
          },
        });
      }
    } else if (detail.data) {
      await recordQuality(
        festivalId,
        "KTO 상세 응답의 contentId가 등록 원본과 달라 법정동 코드를 신뢰하지 않고 시군구 필수 API를 건너뜁니다.",
      );
    }
    await saveSnapshot({
      festivalId,
      apiName: "detailCommon2",
      sourceUrl: "https://www.data.go.kr/data/15101578/openapi.do",
      baseDate: festival.startDate ?? undefined,
      aggregation: "축제 메타데이터(일정·장소·개요). 입장객·예산 아님",
      kind: "observation",
      value: detailContentMatches ? detail.data : null,
      status: detailContentMatches ? detail.kind : "error",
      rawSummary: detailContentMatches
        ? detail.summary
        : detail.data
          ? "KTO 상세 contentId 불일치 — 응답 폐기"
          : `${detail.summary} — 부분 상세 없음`,
      interpretation: "공식 일정·장소·주제를 사전채움하는 근거",
      prohibition: "입장객·예산·만족도 정답으로 사용 금지",
    });
  } else if (festival.contentId || festival.provenance === "kto") {
    await recordQuality(
      festivalId,
      "KTO provenance와 contentId가 함께 확인되지 않아 상세 재검증 및 시군구 필수 API를 건너뜁니다.",
    );
  }

  if (festival.startDate) {
    const overlaps = await searchFestivalsByDate({
      eventStartDate: festival.startDate,
      eventEndDate: festival.endDate ?? festival.startDate,
      areaCode: festival.areaCode ?? undefined,
    });
    const others = (overlaps.data ?? []).filter((item) => item.contentId !== festival.contentId);
    await saveSnapshot({
      festivalId,
      apiName: "searchFestival2",
      sourceUrl: "https://www.data.go.kr/data/15101578/openapi.do",
      baseDate: festival.startDate,
      aggregation: "동일 기간·같은 시도 축제 목록. 경쟁 강도가 아님",
      kind: "observation",
      value: others.slice(0, 5),
      status: overlaps.kind,
      rawSummary: overlaps.summary,
      interpretation: "일정·회차 판단용 겹침 탐색",
      prohibition: "타 행사 흥행·경쟁 강도 단정 금지",
    });
  }

  const adminCodes = refreshedAdminCodes;
  const effectiveKorAreaCode = refreshedKorAreaCode ?? festival.areaCode;
  const mappedStdAreaCd = canonicalProvinceAreaCd(festival.areaCode, refreshedKorAreaCode);
  // B/C always use the canonical KorService2→administrative mapping. lDong
  // codes are intentionally reserved for E/F only.
  const provinceAreaCd = mappedStdAreaCd;
  if (effectiveKorAreaCode && !mappedStdAreaCd) {
    await recordQuality(
      festivalId,
      `지역코드 ${effectiveKorAreaCode}의 행정표준 시도코드 매핑이 없어 지역 배경선 호출을 건너뜁니다.`,
    );
  }
  if ((festival.ldongRegnCd || festival.ldongSignguCd) && !adminCodes) {
    await recordQuality(
      festivalId,
      "저장된 법정동 코드는 이번 KTO 상세 재검증으로 provenance·형식·지역 일치를 확인하지 못해 시군구 필수 API에 사용하지 않습니다.",
    );
  }

  if (provinceAreaCd && festival.startDate) {
    let windows: VisitorWindow[];
    let baseYm: string;
    try {
      windows = buildVisitorWindows(festival.startDate, festival.endDate);
      baseYm = previousYearMonth(festival.startDate);
    } catch (error) {
      await recordQuality(
        festivalId,
        error instanceof Error ? `조회 기간 생성 실패: ${error.message}` : "조회 기간 생성 실패",
      );
      return { refreshed: true, reason: "invalid_date" as const };
    }

    for (const window of windows) {
      try {
        const visitors = await getRegionalVisitors({
          stdAreaCd: provinceAreaCd,
          startYmd: window.startYmd,
          endYmd: window.endYmd,
        });
        await saveSnapshot({
          festivalId,
          apiName: "metcoRegnVisitrDDList",
          sourceUrl: "https://www.data.go.kr/data/15101972/openapi.do",
          baseDate: window.startYmd,
          aggregation: `광역지자체 일별 지역방문자·${window.window}. 축제 입장객 아님`,
          kind: "observation",
          value: { window: window.window, items: visitors.data ?? [] },
          status: visitors.kind,
          rawSummary: visitors.summary,
          interpretation: `${window.window} 지역 유입 배경선`,
          prohibition: "축제 입장객·관광객 수로 치환 금지. 광역·기초 합산 금지",
        });
      } catch (error) {
        await recordQuality(
          festivalId,
          error instanceof Error
            ? `${window.window} 방문자 스냅샷 저장 실패: ${error.message}`
            : `${window.window} 방문자 스냅샷 저장 실패`,
        );
      }
    }

    const demand = await getDemandIntensity({ stdAreaCd: provinceAreaCd, baseYm });
    await saveSnapshot({
      festivalId,
      apiName: "areaTarExpDsList",
      sourceUrl: "https://www.data.go.kr/data/15151868/openapi.do",
      baseDate: baseYm,
      aggregation: "전년 동월 관광 소비 강도 지표. 개별 축제 참석자 아님",
      kind: "observation",
      value: demand.data,
      status: demand.kind,
      rawSummary: demand.summary,
      interpretation: "D-90 시기 비교의 보조 근거",
      prohibition: "프로그램 인과효과·실시간 수요·축제 참석자 주장 금지",
    });

    if (adminCodes) {
      const concentration = await getConcentration(adminCodes);
      await saveSnapshot({
        festivalId,
        apiName: "tatsCnctrRatedList",
        sourceUrl: "https://www.data.go.kr/data/15128555/openapi.do",
        baseDate: festival.startDate,
        aggregation: "동일 관광지 날짜별 상대 집중률(피크=100). 실인원 아님",
        kind: "observation",
        value: concentration.data,
        status: concentration.kind,
        rawSummary: concentration.summary,
        interpretation: "인근 지원 관광지의 상대 피크 보조신호",
        prohibition: "행사장 실인원·장소 간 절대 혼잡 비교 금지",
      });

      const related = await getRelatedTourism({ ...adminCodes, baseYm });
      await saveSnapshot({
        festivalId,
        apiName: "tarRlteTarAreaBasedList1",
        sourceUrl: "https://www.data.go.kr/data/15128560/openapi.do",
        baseDate: baseYm,
        aggregation: "전년 동월 시군구 기반 관광지별 연관 관광지 순위",
        kind: "observation",
        value: related.data,
        status: related.kind,
        rawSummary: related.summary,
        interpretation: "분산 유도 동선 설계의 보조신호",
        prohibition: "행사장 유입 경로·이동 인과관계 단정 금지",
      });
    } else {
      await recordQuality(
        festivalId,
        "KTO가 제공한 법정동 2자리 시도·5자리 시군구 코드가 없어 집중률·연관 관광지 호출을 건너뜁니다. KorService2 sigungucode는 대체하지 않습니다.",
      );
    }
  }

  return { refreshed: true, reason: "ok" as const };
}
