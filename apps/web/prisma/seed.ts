import { PrismaClient } from "@prisma/client";
import { computeCapacity } from "../lib/calc/capacity";

const prisma = new PrismaClient();

const SEED_ID = "seed-spring-flower";

async function main() {
  const existingSeed = await prisma.festival.findUnique({
    where: { id: SEED_ID },
    select: { id: true },
  });
  if (existingSeed) return;

  const existingFestivalCount = await prisma.festival.count();
  if (existingFestivalCount !== 0) {
    throw new Error("Refusing to insert demo data into a non-empty database");
  }

  const peakRatio = 0.35;
  const dwellHours = 2.5;
  const operatingHours = 8;
  const approvedCapacity = 2500;

  const inflowByBand = { min: 12000, base: 18000, max: 26000 };
  const sharedInputs = {
    peakRatio,
    dwellHours,
    operatingHours,
    approvedCapacity,
    hasApprovalBasis: true,
  };
  const byInflow = {
    min: computeCapacity({ ...sharedInputs, inflow: inflowByBand.min }),
    base: computeCapacity({ ...sharedInputs, inflow: inflowByBand.base }),
    max: computeCapacity({ ...sharedInputs, inflow: inflowByBand.max }),
  };
  const makeResult = () => {
    return {
      resultJson: JSON.stringify({ byInflow }),
      formulaJson: JSON.stringify({
        formula: byInflow.base.formula,
        sharedInputs,
        byInflow: inflowByBand,
      }),
    };
  };

  await prisma.festival.create({
    data: {
      id: SEED_ID,
      name: "○○군 봄꽃축제",
      organization: "○○군 문화관광재단",
      place: "○○군 호수공원 일원",
      program: "봄꽃 산책, 호수 무대, 지역 장터",
      startDate: "2026-04-10",
      endDate: "2026-04-12",
      areaCode: "34",
      sigunguCode: "1",
      mapX: "127.289",
      mapY: "36.480",
      provenance: "manual",
      labelLevel: "L1",
      isDemo: true,
      isExample: true,
      assumptions: {
        create: [
          {
            item: "inflow",
            minValue: 12000,
            baseValue: 18000,
            maxValue: 26000,
            unit: "명",
            rationale: "전년도 일별 방문 추정 총계. 예측값이 아닌 사용자 가정",
            author: "총괄기획",
            version: 1,
          },
          {
            item: "peakRatio",
            minValue: 0.3,
            baseValue: 0.35,
            maxValue: 0.4,
            unit: "비율",
            rationale: "3일 운영 중 토요일 오후 피크 가정",
            author: "총괄기획",
            version: 1,
          },
          {
            item: "dwellHours",
            minValue: 2,
            baseValue: 2.5,
            maxValue: 3,
            unit: "시간",
            rationale: "개방형 축제 평균 체류 가정",
            author: "총괄기획",
            version: 1,
          },
          {
            item: "operatingHours",
            minValue: 8,
            baseValue: 8,
            maxValue: 8,
            unit: "시간",
            rationale: "10:00–18:00 운영",
            author: "총괄기획",
            version: 1,
          },
        ],
      },
      capacityRules: {
        create: {
          zone: "호수 무대 앞",
          approvedCapacity: 2500,
          dwellHours: 2.5,
          documentRef: "2026 지역축제 안전관리계획 초안 §4",
          approver: "안전담당",
        },
      },
      snapshots: {
        create: [
          {
            apiName: "searchFestival2",
            sourceUrl: "https://www.data.go.kr/data/15101578/openapi.do",
            baseDate: "2026-04-10",
            fetchedAt: new Date("2026-01-10T09:00:00+09:00"),
            aggregation: "동일 기간·인접 시군 축제 목록. 경쟁 강도가 아님",
            kind: "observation",
            valueJson: JSON.stringify([
              { title: "이웃면 봄나물잔치", eventstartdate: "20260411", eventenddate: "20260412", addr1: "인접 읍면" },
              { title: "호수둘레 걷기한마당", eventstartdate: "20260410", eventenddate: "20260410", addr1: "같은 권역" },
            ]),
            rawSummary: "시드 예시 · 실호출 전 겹침 2건",
            status: "success",
            interpretation: "일정·회차 판단용 겹침 탐색",
            prohibition: "타 행사 흥행·경쟁 강도 단정 금지",
          },
          {
            apiName: "metcoRegnVisitrDDList",
            sourceUrl: "https://www.data.go.kr/data/15101972/openapi.do",
            baseDate: "2026-03-13",
            fetchedAt: new Date("2026-03-20T09:02:00+09:00"),
            aggregation: "광역지자체 일별 지역방문자·평시. 축제 입장객 아님",
            kind: "observation",
            valueJson: JSON.stringify({
              window: "평시",
              items: [
                { baseYmd: "20260313", areaCode: "44", areaNm: "충청남도", touDivNm: "현지인", touNum: 18420 },
                { baseYmd: "20260313", areaCode: "44", areaNm: "충청남도", touDivNm: "외지인", touNum: 12110 },
              ],
            }),
            rawSummary: "시드 예시 · 평시 광역 배경선 2건",
            status: "success",
            interpretation: "평시 지역 유입 배경선",
            prohibition: "축제 입장객·관광객 수로 치환 금지. 광역·기초 합산 금지",
          },
          {
            apiName: "metcoRegnVisitrDDList",
            sourceUrl: "https://www.data.go.kr/data/15101972/openapi.do",
            baseDate: "2025-04-07",
            fetchedAt: new Date("2026-01-10T09:02:00+09:00"),
            aggregation: "광역지자체 일별 지역방문자·전년 동기간. 축제 입장객 아님",
            kind: "observation",
            valueJson: JSON.stringify({
              window: "전년 동기간",
              items: [
                { baseYmd: "20250410", areaCode: "44", areaNm: "충청남도", touDivNm: "현지인", touNum: 20110 },
                { baseYmd: "20250410", areaCode: "44", areaNm: "충청남도", touDivNm: "외지인", touNum: 15340 },
              ],
            }),
            rawSummary: "시드 예시 · 전년 동기간 광역 배경선 2건",
            status: "success",
            interpretation: "전년 동기간 지역 유입 배경선",
            prohibition: "축제 입장객·관광객 수로 치환 금지. 광역·기초 합산 금지",
          },
          {
            apiName: "metcoRegnVisitrDDList",
            sourceUrl: "https://www.data.go.kr/data/15101972/openapi.do",
            baseDate: "2026-04-10",
            fetchedAt: new Date("2026-05-01T09:02:00+09:00"),
            aggregation: "광역지자체 일별 지역방문자·당해. 축제 입장객 아님",
            kind: "observation",
            valueJson: JSON.stringify({
              window: "당해",
              items: [
                { baseYmd: "20260410", areaCode: "44", areaNm: "충청남도", touDivNm: "현지인", touNum: 23110 },
                { baseYmd: "20260410", areaCode: "44", areaNm: "충청남도", touDivNm: "외지인", touNum: 19480 },
              ],
            }),
            rawSummary: "시드 예시 · 당해 광역 배경선 2건",
            status: "success",
            interpretation: "당해 지역 유입 배경선",
            prohibition: "축제 입장객·관광객 수로 치환 금지. 광역·기초 합산 금지",
          },
          {
            apiName: "areaTarExpDsList",
            sourceUrl: "https://www.data.go.kr/data/15151868/openapi.do",
            baseDate: "202504",
            fetchedAt: new Date("2026-01-10T09:03:00+09:00"),
            aggregation: "월별 지역 체류 잠재력 지수",
            kind: "observation",
            valueJson: JSON.stringify({ baseYm: "202504", areaNm: "충청남도", score: 62 }),
            rawSummary: "시드 예시 · 전년 동월 체류 잠재력 참고",
            status: "success",
            interpretation: "D-90 시기 비교 참고",
            prohibition: "프로그램 인과효과 주장 금지",
          },
          {
            apiName: "tatsCnctrRatedList",
            sourceUrl: "https://www.data.go.kr/data/15128555/openapi.do",
            baseDate: "2026-04-10",
            fetchedAt: new Date("2026-01-10T09:04:00+09:00"),
            aggregation: "인근 지원 관광지 상대 집중률",
            kind: "observation",
            valueJson: JSON.stringify(null),
            rawSummary: "시드 · 대상 관광지 미지원",
            status: "empty",
            interpretation: "분산 동선 보조신호",
            prohibition: "행사장 절대 혼잡으로 해석 금지",
          },
        ],
      },
      quality: {
        create: [
          {
            issue: "definition_mismatch",
            status: "open",
            note: "전년도 방문 추정 총계는 일별 합이며 입장 계수와 정의가 다릅니다.",
          },
          {
            issue: "missing",
            status: "open",
            note: "시간·구역 단위 실측이 없어 라벨 상태는 L1입니다. 예측 기능은 비활성입니다.",
          },
        ],
      },
      scenarios: {
        create: [
          {
            kind: "conservative",
            name: "보수안",
            sessions: 3,
            staffParking: 4,
            shuttles: 2,
            zone: "호수 무대 앞",
            routeNote: "기존 동선 유지",
            ...makeResult(),
          },
          {
            kind: "base",
            name: "기본안",
            sessions: 3,
            staffParking: 4,
            shuttles: 2,
            zone: "호수 무대 앞",
            routeNote: "기존 동선 유지",
            ...makeResult(),
          },
          {
            kind: "expanded",
            name: "확대안",
            sessions: 3,
            staffParking: 6,
            shuttles: 3,
            zone: "호수 무대 앞",
            routeNote: "셔틀 대기열 분산, 우회 동선 예비",
            ...makeResult(),
          },
        ],
      },
      outcomes: {
        create: [
          {
            metric: "일별 방문 추정 총계",
            plannedValue: 18000,
            actualValue: 19200,
            unit: "명",
            source: "주최 측 일별 추정 총계 수기 입력",
            measureMethod: "게이트 없는 개방형 · 일별 추정",
            missingRate: 0.2,
            confirmed: true,
            kind: "measured",
            granularity: "total",
            bucketLabel: null,
          },
          {
            metric: "셔틀 대수",
            plannedValue: 3,
            actualValue: 3,
            unit: "대",
            source: "운영일지",
            measureMethod: "운행 대수 기록",
            confirmed: true,
            kind: "measured",
            granularity: "total",
            bucketLabel: null,
          },
        ],
      },
    },
  });

  const operationTrigger = await prisma.operationTrigger.create({
    data: {
      festivalId: SEED_ID,
      condition: "A구역 혼잡 임계 초과",
      plannedAction: "우회 동선 개방",
      owner: "현장총괄",
    },
  });

  await prisma.fieldAction.create({
    data: {
      festivalId: SEED_ID,
      triggerId: operationTrigger.id,
      trigger: operationTrigger.condition,
      occurredAt: "2026-04-11 13:40",
      action: "우회 동선 개방",
      actor: "현장총괄",
    },
  });

  const expanded = await prisma.scenario.findFirstOrThrow({
    where: { festivalId: SEED_ID, kind: "expanded" },
  });

  await prisma.decision.create({
    data: {
      festivalId: SEED_ID,
      scenarioId: expanded.id,
      changeSummary:
        "확대안: 셔틀 3대, 주차 안내 6명, 회차 3회, 구역: 호수 무대 앞, 동선: 셔틀 대기열 분산, 우회 동선 예비",
      reason: "기준 유입 가정에서 피크 수용여유를 확보하기 위함",
      approver: "축제 총괄",
      decidedAt: new Date("2026-03-12T14:00:00+09:00"),
    },
  });

  const seedLog = await prisma.apiCallLog.findFirst({ where: { operation: "seed-placeholder" } });
  if (!seedLog) {
    await prisma.apiCallLog.create({
      data: {
        operation: "seed-placeholder",
        urlMasked: "(시드) 실호출 전 예시 스냅샷",
        status: 200,
        ok: true,
        durationMs: 0,
        resultKind: "success",
        summary: "데모 축제 시드가 로드되었습니다. 근거 화면에서 KTO를 다시 불러오면 실호출 로그가 추가됩니다.",
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
