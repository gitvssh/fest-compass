// Festival types of the Korea Tourism Organization classification (lclsSystm3 of TourAPI rows, contentTypeId 15).
// One registration carries one type; a festival is never given a second type here and nothing is inferred from names.
export const FESTIVAL_TYPES = [
  { code: "EV010100", label: "문화관광축제", short: "문화관광", hint: "문체부 지정", icon: "award" },
  { code: "EV010200", label: "문화예술축제", short: "문화예술", hint: null, icon: "palette" },
  { code: "EV010300", label: "지역특산물축제", short: "지역특산물", hint: "먹거리", icon: "wheat" },
  { code: "EV010400", label: "전통역사축제", short: "전통역사", hint: null, icon: "landmark" },
  { code: "EV010500", label: "생태자연축제", short: "생태자연", hint: null, icon: "leaf" },
  { code: "EV010600", label: "기타축제", short: "기타 축제", hint: null, icon: "sparkles" },
] as const;
export type FestivalTypeCode = (typeof FESTIVAL_TYPES)[number]["code"];
export type FestivalTypeIcon = (typeof FESTIVAL_TYPES)[number]["icon"];

/** Performances and events share the festival list (contentTypeId 15); they keep their own names, never a festival type. */
const OTHER_TYPES: Readonly<Record<string, string>> = {
  EV020100: "전통공연", EV020200: "연극", EV020300: "뮤지컬", EV020400: "오페라", EV020500: "무용", EV020600: "클래식음악회",
  EV020700: "대중콘서트", EV020800: "영화", EV020900: "기타공연", EV021000: "넌버벌",
  EV030100: "전시회", EV030200: "박람회", EV030300: "스포츠경기", EV030400: "기타행사",
};

export const isFestivalTypeCode = (value: unknown): value is FestivalTypeCode => typeof value === "string" && FESTIVAL_TYPES.some(t => t.code === value);
/** A provider classification code as stored (EV + six digits), else null. */
export const classificationCode = (value: unknown): string | null => typeof value === "string" && /^EV\d{6}$/.test(value) ? value : null;
export const festivalType = (code: string | null | undefined) => FESTIVAL_TYPES.find(t => t.code === code) ?? null;
/** Short name of any registered classification: a festival type, a performance or an event kind. */
export function classificationLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return festivalType(code)?.short ?? OTHER_TYPES[code] ?? null;
}
