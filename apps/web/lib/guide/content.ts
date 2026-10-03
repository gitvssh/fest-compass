// Guide wording for the two journeys, kept as data so the tests can hold it short and neutral.
// Questions open a judgment; nothing here grades, recommends or completes anything for the reader.

export type JourneyId = "existing" | "new";
export type TaskView = "visits" | "resources" | "timing" | "summary";
export type CheckKind = "law" | "dept" | "plan";
export type JudgmentIcon = "keep" | "people" | "limits" | "difference";

export type GuideTask = {
  view: TaskView;
  /** What the reader does here (tab name). */
  title: string;
  /** Name of the data shown here (small tab label). */
  data: string;
  /** One-line goal of this screen. */
  goal: string;
  /** What this data cannot tell (short noun phrases). Empty on the summary. */
  unknown: string[];
  /** At most two plain questions. Empty on the summary. */
  questions: string[];
  /** Short hint shown with the task on the flow map and the continue row. */
  hint: string;
};
export type NextCheck = { action: string; consult: string; kind: CheckKind };
export type JourneyGuide = {
  id: JourneyId;
  name: string;
  goal: string;
  outcome: string;
  judgments: { icon: JudgmentIcon; text: string }[];
  /** Recommended order; every task stays reachable in any order. */
  tasks: GuideTask[];
  checks: NextCheck[];
};

export const CHECK_KINDS: Readonly<Record<CheckKind, string>> = { law: "법령 근거", dept: "담당 부서 확인", plan: "기획 참고" };

const SUMMARY: GuideTask = {
  view: "summary", title: "모아 보기", data: "한 장 요약", goal: "고른 내용과 다음에 확인할 일을 한 장으로 모아요",
  unknown: [], questions: [], hint: "한 장으로 모아 인쇄",
};

export const EXISTING_GUIDE: JourneyGuide = {
  id: "existing",
  name: "기존 축제 개선",
  goal: "지난 회차를 돌아보고 다음 회차에 유지·변경할 점을 정리해요",
  outcome: "방문 흐름·연계 후보·후보 기간을 한 장으로",
  judgments: [
    { icon: "keep", text: "유지할 점과 바꿀 문제" },
    { icon: "people", text: "늘리거나 바꾸려는 방문" },
    { icon: "limits", text: "예산·인력·장소·준비 기간" },
  ],
  tasks: [
    {
      view: "visits", title: "방문 흐름 돌아보기", data: "과거 방문 흐름", goal: "개최 기간과 앞뒤 방문을 견줘 기준을 잡아요",
      unknown: ["축제장 입장객 수", "축제의 효과"],
      questions: ["개최 기간은 앞뒤보다 얼마나 높았나요?", "회차마다 요일·일수가 같았나요?"],
      hint: "개최 기간과 앞뒤 방문 견주기",
    },
    {
      view: "resources", title: "연계 관광 찾기", data: "주변 관광자원", goal: "축제 방문을 이어 줄 관광지·음식점·숙박을 찾아요",
      unknown: ["영업·예약 가능 여부", "실제 이동 시간"],
      questions: ["축제장 가까이 함께 들를 곳은?", "축제 기간에도 이용할 수 있나요?"],
      hint: "함께 들를 곳 찾기",
    },
    {
      view: "timing", title: "개최 시기 검토하기", data: "개최 시기", goal: "월별 방문·공휴일·등록 행사로 후보 기간을 좁혀요",
      unknown: ["등록 행사의 개최 확정"],
      questions: ["지금 시기를 유지할 이유와 옮길 이유는?", "겹치는 행사·연휴는 피할까요, 연계할까요?"],
      hint: "후보 기간 좁히기",
    },
    SUMMARY,
  ],
  checks: [
    { action: "지난 결과보고서·정산서와 평가 의견 함께 보기", consult: "담당 부서", kind: "dept" },
    { action: "후보 기간에 장소를 쓸 수 있는지 묻기", consult: "시설 관리 부서", kind: "dept" },
    { action: "예산이 바뀌면 거칠 심사·편성 일정 묻기", consult: "예산부서", kind: "law" },
    { action: "예상 인원·장소로 안전관리계획 대상인지 확인하기", consult: "안전 담당 부서", kind: "law" },
    { action: "다음 회차에 무엇을 어떻게 셀지 정하기", consult: "담당 부서", kind: "plan" },
  ],
};

export const NEW_GUIDE: JourneyGuide = {
  id: "new",
  name: "새 축제 기획",
  goal: "지역의 자원과 방문 흐름으로 소재·장소·시기 후보를 좁혀요",
  outcome: "소재·장소·시기 후보를 한 장으로",
  judgments: [
    { icon: "people", text: "누구의 방문을 만들지, 와야 할 이유" },
    { icon: "difference", text: "기존 행사와의 차이" },
    { icon: "limits", text: "예산·인력·장소·준비 기간" },
  ],
  tasks: [
    {
      view: "resources", title: "지역 자원 살펴보기", data: "지역 관광자원", goal: "방문 이유가 될 소재와 행사 장소 후보를 찾아요",
      unknown: ["장소 사용 허가", "수용 조건"],
      questions: ["이 지역에서만 볼 수 있는 자원·이야기는?", "장소 후보마다 접근·규모가 어떻게 다른가요?"],
      hint: "소재·장소 후보 찾기",
    },
    {
      view: "visits", title: "방문 흐름 읽기", data: "지역 방문 흐름", goal: "외지인 방문이 많고 적은 때를 살펴봐요",
      unknown: ["축제·장소별 방문자 수", "방문 목적"],
      questions: ["방문이 적은 달을 채울까요, 많은 달에 얹을까요?", "주말에 얼마나 몰리나요?"],
      hint: "방문이 많고 적은 때 보기",
    },
    {
      view: "timing", title: "개최 시기 검토하기", data: "개최 시기", goal: "공휴일·등록 행사와 겹침을 보고 후보 기간을 좁혀요",
      unknown: ["등록 행사의 개최 확정"],
      questions: ["겹치는 행사는 피할까요, 연계할까요?", "소재의 계절(꽃·수확·기온)과 맞나요?"],
      hint: "후보 기간 좁히기",
    },
    SUMMARY,
  ],
  checks: [
    { action: "신설이 필요한 이유와 비슷한 행사와의 차이 검토하기", consult: "예산부서", kind: "dept" },
    { action: "신규 행사 사전심사·투자심사 대상인지 묻기", consult: "예산부서", kind: "law" },
    { action: "추진 방식(직접·보조·위탁)에 맞는 편성 방법 확인하기", consult: "예산부서", kind: "law" },
    { action: "장소 사용·수용 조건과 안전 협의 일정 묻기", consult: "시설·안전 부서", kind: "dept" },
    { action: "개최 후 무엇을 어떻게 셀지 미리 정하기", consult: "담당 부서", kind: "plan" },
  ],
};

export const JOURNEYS: Readonly<Record<JourneyId, JourneyGuide>> = { existing: EXISTING_GUIDE, new: NEW_GUIDE };

export function guideTask(journey: JourneyId, view: TaskView): GuideTask {
  return JOURNEYS[journey].tasks.find(t => t.view === view)!;
}
/** The task after `view` in the recommended order, or null after the last one. */
export function nextTask(journey: JourneyId, view: TaskView): GuideTask | null {
  const tasks = JOURNEYS[journey].tasks, index = tasks.findIndex(t => t.view === view);
  return index >= 0 && index < tasks.length - 1 ? tasks[index + 1] : null;
}

/** Data-scope note of the existing visits screen; only the limited cases get a line. */
export type VisitsScope = "editions" | "single" | "none";
export const VISITS_SCOPE_NOTE: Readonly<Record<VisitsScope, string | null>> = {
  editions: null,
  single: "확인된 회차가 하나예요. 그 회차의 개최 기간과 앞뒤를 견줘 보세요.",
  none: "지난 개최 기록이 연결되지 않았어요. 지역의 월별 흐름과 기관의 결과보고서로 시작해요.",
};
export function visitsScope(editions: { start: string | null }[] | null): VisitsScope {
  if (!editions) return "none";
  return editions.filter(e => e.start).length > 1 ? "editions" : editions.some(e => e.start) ? "single" : "none";
}
