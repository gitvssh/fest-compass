// The one-minute introduction video on the home page.
//
// First-time visitors get a small, non-blocking offer card; everyone keeps a
// permanent entry point next to the home heading. Whether the offer was already
// handled lives only in this browser, under the project's storage-key prefix,
// and records nothing but that the card should stay away.

export const INTRO_STORAGE_KEY = "fest-compass.intro-video.v1";
export const INTRO_QUERY_KEY = "intro";
export const INTRO_QUERY_PLAY = "play";

export const INTRO_MEDIA = {
  video: "/media/intro/pickdday-intro.mp4",
  poster: "/media/intro/pickdday-intro-poster.jpg",
  captions: "/media/intro/pickdday-intro.ko.vtt",
  durationLabel: "1분",
} as const;

/** Narration in reading order. The caption file must say exactly the same thing. */
export const INTRO_TRANSCRIPT: readonly string[] = [
  "인파가 몰려 발 디딜 틈이 없거나, 준비한 부스가 텅 비거나. 축제 기획은 아직도 작년의 기억에 기대고 있습니다.",
  "그래서 만들었습니다. 관광데이터로 축제의 날을 고르는, pickDday.",
  "기존 축제 개선과 새 축제 기획, 목적만 고르면 바로 시작합니다.",
  "지난 회차의 지역 방문 흐름을 나란히 비교하고, 입장객이 아닌 추정치라는 한계도 분명히 밝힙니다.",
  "주변 관광지는 지도와 사진으로, 이용시간과 주차 정보까지 한 번에 확인합니다.",
  "월별 방문 흐름 위에 공휴일과 인근 축제 일정을 겹쳐, 붐비는 시기와 겹치는 일정을 피합니다.",
  "새 축제라면 지역만 고르세요. 후보지 두 곳을 사진과 이용 조건으로 나란히 비교합니다.",
  "전국 문화관광축제 26곳의 연도별 방문 변화로 벤치마킹까지.",
  "한국관광공사 OpenAPI를 연동해, 전국 모든 시군구에 같은 분석을 제공합니다.",
  "감이 아닌 근거로, 축제의 날을 고르다. pickDday.",
];

export type IntroOutcome = "played" | "dismissed";
type IntroStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): IntroStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * True when this browser already played or dismissed the introduction.
 * Unreadable storage counts as "seen": a visitor who blocks site data would
 * otherwise get the offer on every single visit.
 */
export function hasHandledIntro(storage: IntroStorage | null = browserStorage()): boolean {
  if (!storage) return true;
  try {
    const value = storage.getItem(INTRO_STORAGE_KEY);
    return value === "played" || value === "dismissed";
  } catch {
    return true;
  }
}

/** Remember that the offer was handled. Failing to store must never break the page. */
export function markIntroHandled(outcome: IntroOutcome, storage: IntroStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(INTRO_STORAGE_KEY, outcome);
  } catch {
    // Private windows and full storage only lose the reminder.
  }
}

/** A shared link such as `/?intro=play` opens the player directly. */
export function wantsIntroPlayback(search: string): boolean {
  return new URLSearchParams(search).get(INTRO_QUERY_KEY) === INTRO_QUERY_PLAY;
}

/** The same address without the playback request, so a reload does not reopen the player. */
export function withoutIntroQuery(pathname: string, search: string, hash = ""): string {
  const params = new URLSearchParams(search);
  params.delete(INTRO_QUERY_KEY);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

/** Caption cue texts in order, read from a WebVTT document. */
export function captionTexts(vtt: string): string[] {
  return vtt
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.split("\n"))
    .filter((lines) => lines.some((line) => line.includes("-->")))
    .map((lines) => lines.slice(lines.findIndex((line) => line.includes("-->")) + 1).join(" ").trim())
    .filter(Boolean);
}
