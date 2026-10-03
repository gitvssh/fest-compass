// Festival preparation as a whole, for an officer who takes it on for the first time. Steps, questions and where to
// ask only: amounts and deadlines stay out until each figure has a maintained source (target, article, effective date).
import type { JourneyId, TaskView } from "./content";

export type SourceKind = "매뉴얼" | "편람" | "보고서" | "운영기준" | "행정규칙" | "자료 설명" | "업무 안내";
export type GuideSource = { id: string; title: string; publisher: string; kind: SourceKind; url: string; checkedOn: string };

/** Official pages only (linked, never copied). Ids follow docs/research/2026-10-novice-planner-sources.md. */
export const GUIDE_SOURCES: readonly GuideSource[] = [
  { id: "S01", title: "지역축제장 안전관리 매뉴얼(2024)", publisher: "행정안전부", kind: "매뉴얼", url: "https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000015&nttId=113047", checkedOn: "2026-10-03" },
  { id: "S02", title: "다중운집인파사고 안전관리 가이드라인", publisher: "행정안전부", kind: "매뉴얼", url: "https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000015&nttId=121405", checkedOn: "2026-10-03" },
  { id: "S03", title: "지역축제 안전관리 업무 안내", publisher: "행정안전부", kind: "업무 안내", url: "https://www.mois.go.kr/frt/sub/a06/b13/festivalSafety/screen.do", checkedOn: "2026-10-03" },
  { id: "S05", title: "2026 문화관광축제 평가 및 지정편람", publisher: "문화체육관광부", kind: "편람", url: "https://www.mcst.go.kr/site/s_policy/dept/deptView.jsp?pSeq=2130&pDataCD=0417000000&pType=05", checkedOn: "2026-10-03" },
  { id: "S06", title: "문화관광축제 종합평가보고서", publisher: "문화체육관광부", kind: "보고서", url: "https://www.mcst.go.kr/site/s_policy/dept/deptView.jsp?pSeq=2120&pDataCD=0417000000&pType=05", checkedOn: "2026-10-03" },
  { id: "S08", title: "문화관광축제 빅데이터 분석 보고서", publisher: "한국관광공사", kind: "보고서", url: "https://datalab.visitkorea.or.kr/site/portal/ex/bbs/View.do?cbIdx=1129&bcIdx=309084", checkedOn: "2026-10-03" },
  { id: "S10", title: "지역별 방문자수 자료 설명", publisher: "한국관광공사", kind: "자료 설명", url: "https://www.data.go.kr/data/15101972/openapi.do", checkedOn: "2026-10-03" },
  { id: "S13", title: "지방재정 투자심사 및 타당성조사 운영기준", publisher: "행정안전부", kind: "운영기준", url: "https://limac.krila.re.kr/bbs/board.php?bo_table=limac04_01_01&wr_id=14", checkedOn: "2026-10-03" },
  { id: "S14", title: "지방자치단체 예산편성 운영기준", publisher: "행정안전부", kind: "행정규칙", url: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000281550", checkedOn: "2026-10-03" },
  { id: "S15", title: "지방자치단체 주요재정사업 평가기준", publisher: "행정안전부", kind: "행정규칙", url: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000194595", checkedOn: "2026-10-03" },
  { id: "S16", title: "지방보조금 관리기준", publisher: "행정안전부", kind: "행정규칙", url: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000284062", checkedOn: "2026-10-03" },
  { id: "S21", title: "친환경 지역축제 운영 길라잡이", publisher: "원주지방환경청", kind: "매뉴얼", url: "https://me.go.kr/wonju/web/board/read.do?boardId=1736440&boardMasterId=232&menuId=1033", checkedOn: "2026-10-03" },
];
export function guideSource(id: string): GuideSource {
  const source = GUIDE_SOURCES.find(s => s.id === id);
  if (!source) throw new Error(`unknown guide source ${id}`);
  return source;
}

export type PhaseIcon = "look" | "direction" | "review" | "contract" | "prepare" | "run" | "result";
export type PhaseStage = "before" | "during" | "after";
export const STAGE_LABELS: Readonly<Record<PhaseStage, string>> = { before: "개최 전", during: "개최", after: "개최 후" };

export type Phase = {
  step: number;
  stage: PhaseStage;
  icon: PhaseIcon;
  title: string;
  /** What is done in this phase (short). */
  work: string[];
  /** One question to bring to the people below. */
  ask: string;
  consult: string[];
  read: string[];
  /** Journeys of this site that help in this phase. */
  explore: { journey: JourneyId; view: TaskView }[];
};

export const PHASES: readonly Phase[] = [
  {
    step: 1, stage: "before", icon: "look", title: "돌아보기·살펴보기",
    work: ["기존 축제: 지난 결과·정산·평가 모으기", "새 축제: 지역 자원·비슷한 행사·방문 흐름 보기"],
    ask: "무엇을 유지하고 바꿀까요? 꼭 새 축제여야 할까요?",
    consult: ["담당 부서", "예산부서"], read: ["S05", "S10"],
    explore: [{ journey: "existing", view: "visits" }, { journey: "new", view: "resources" }],
  },
  {
    step: 2, stage: "before", icon: "direction", title: "방향·추진 방식·대략 비용",
    work: ["소재·장소·시기 후보 좁히기", "직접·보조·위탁 중 추진 방식 협의", "대략적인 총사업비"],
    ask: "어떤 추진 방식이 맞을까요? 방식에 따라 예산 편성 방법이 달라요.",
    consult: ["예산부서", "시설·안전 부서"], read: ["S14", "S16"],
    explore: [{ journey: "existing", view: "timing" }, { journey: "new", view: "timing" }],
  },
  {
    step: 3, stage: "before", icon: "review", title: "심사 확인·예산 편성",
    work: ["사전심사·재정영향평가·투자심사 대상 확인", "예산 요구·편성"],
    ask: "우리 사업은 어떤 심사를 거치나요? 내부 예산 요구 마감은 언제인가요?",
    consult: ["예산부서", "투자심사 담당"], read: ["S13", "S15"], explore: [],
  },
  {
    step: 4, stage: "before", icon: "contract", title: "발주·협약·계약",
    work: ["정한 방식에 따라 용역 발주·보조 공모·협약"],
    ask: "공고·심의에 필요한 기간이 충분한가요?",
    consult: ["계약 부서", "보조금 담당"], read: ["S16"], explore: [],
  },
  {
    step: 5, stage: "before", icon: "prepare", title: "개최 준비",
    work: ["안전관리계획·인허가", "가격·환경·홍보 계획", "결과를 무엇으로 셀지 정하기"],
    ask: "예상 인원·장소·위험 요소로 볼 때 안전관리계획 대상인가요?",
    consult: ["안전 담당 부서", "경찰·소방"], read: ["S01", "S21"], explore: [],
  },
  {
    step: 6, stage: "during", icon: "run", title: "개최·운영",
    work: ["상황실·안전·가격 신고센터 운영"],
    ask: "비상 연락과 현장 판단 기준을 모두 알고 있나요?",
    consult: ["안전·민원 부서"], read: ["S02", "S03"], explore: [],
  },
  {
    step: 7, stage: "after", icon: "result", title: "결과·다음 회차",
    work: ["결과·정산", "개선 과제를 다음 회차로"],
    ask: "다음 회차에 무엇을 유지하고 바꿀까요?",
    consult: ["담당 부서", "예산부서"], read: ["S06", "S08"],
    explore: [{ journey: "existing", view: "visits" }],
  },
];
