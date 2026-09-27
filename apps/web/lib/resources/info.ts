import type { ResourceKind } from "../existing/types";
import { decodeEntities, overviewText } from "../new-festival/overview";
import type { ResourceFact } from "./types";

const FIELDS: Record<ResourceKind, readonly [string, string][]> = {
  "12": [["usetime", "이용시간"], ["restdate", "휴무일"], ["parking", "주차"], ["useseason", "이용 시기"], ["expguide", "체험 안내"], ["expagerange", "체험 연령"], ["chkbabycarriage", "유모차 대여"], ["chkpet", "반려동물 동반"]],
  "14": [["usetimeculture", "이용시간"], ["restdateculture", "휴무일"], ["usefee", "이용요금"], ["spendtime", "관람 소요시간"], ["parkingculture", "주차"], ["parkingfee", "주차요금"], ["discountinfo", "할인 안내"]],
  "39": [["firstmenu", "대표 메뉴"], ["treatmenu", "판매 메뉴"], ["opentimefood", "영업시간"], ["restdatefood", "휴무일"], ["reservationfood", "예약 안내"], ["parkingfood", "주차"]],
  "32": [["checkintime", "체크인"], ["checkouttime", "체크아웃"], ["roomtype", "객실 유형"], ["roomcount", "객실 수"], ["reservationlodging", "예약 안내"], ["refundregulation", "환불 규정"], ["parkinglodging", "주차"], ["pickup", "픽업"], ["subfacility", "부대시설"], ["chkcooking", "취사"]],
};
const PHONE: Record<ResourceKind, string> = { "12": "infocenter", "14": "infocenterculture", "39": "infocenterfood", "32": "infocenterlodging" };
/** Descriptive values stay plain text. Missing/unknown stays absent rather than becoming a yes/no claim. */
export function resourceInfoText(raw: unknown, limit = 1000): string | null {
  const value = Array.from(overviewText(raw).text).slice(0, limit).join("");
  return value || null;
}
export function resourceIntro(row: Record<string, unknown>, kind: ResourceKind): { facts: ResourceFact[]; phone: string | null } {
  const facts = FIELDS[kind].flatMap(([field, label]) => {
    const value = resourceInfoText(row[field]);
    return value ? [{ label, value }] : [];
  });
  return { facts, phone: resourceInfoText(row[PHONE[kind]], 400) };
}

/** A public homepage may be a URL or TourAPI's HTML anchor; return a link target, never provider markup. */
export function resourceWebsite(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 10_000) return null;
  const input = raw.trim().replace(/<!--[\s\S]*?(-->|$)/g, "").replace(/<(script|style|iframe|template|noscript)\b[^>]*>[\s\S]*?(<\/\1\s*>|$)/gi, "");
  const href = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(input);
  const value = decodeEntities(href ? href[1] ?? href[2] ?? href[3] : input).trim();
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f\\<>]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".") || /(?:^|\.)localhost$/.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
