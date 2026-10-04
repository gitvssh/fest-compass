import test from "node:test";
import assert from "node:assert/strict";
import { festivalMarks, hasMarks, INTRO_FIELD_MAX, introText, parseMarkKinds, type IntroText } from "./festival-marks";

const intro = (fields: Partial<IntroText>): IntroText => ({ program: "", subevent: "", agelimit: "", fee: "", ...fields });
const summary = (fields: Partial<IntroText>) => festivalMarks(intro(fields)).map(m => `${m.label}:${m.evidence}`);

test("intro text: provider HTML becomes plain lines, entities decode, length is capped", () => {
  assert.equal(introText("1. 공식행사<br>2. 체험&middot;전시 &amp; <b>공연</b>&#33;", 200), "1. 공식행사\n2. 체험·전시 & 공연!");
  assert.equal(introText("  가\t\t나 \u0007 다  <br/>  <br />라  ", 200), "가 나 다\n라");
  assert.equal(introText(null, 10), "");
  assert.equal(introText("가".repeat(20), 10), `${"가".repeat(9)}…`);
  assert.equal(introText("&#0;&#x110000;&unknown;", 50), "&unknown;");
  assert.deepEqual(INTRO_FIELD_MAX, { program: 1200, subevent: 600, agelimit: 120, fee: 300 });
});

test("experience and family marks quote the programme piece they were read from", () => {
  // Shapes of real 2026 registrations (programme lists with numbered items, dashes and middle dots).
  assert.deepEqual(summary({ program: "1. 공식행사 - 개ㆍ폐막식, 주제공연\n2. 체험ㆍ전시 - 선사바비큐 체험, 타임슬립 마켓" }), ["체험:선사바비큐 체험"]);
  assert.deepEqual(summary({ program: "1. 커피거리 핵심 프로그램 - 커피체험존 - 키즈놀이터" }), ["체험:커피체험존", "어린이·가족:키즈놀이터"]);
  assert.deepEqual(summary({ program: "1. 그랜드 퍼레이드 2. 패밀리 콘서트 3. DJ 파티" }), ["어린이·가족:패밀리 콘서트"]);
  assert.deepEqual(summary({ subevent: "가족 전통놀이 체험 등" }), ["체험:가족 전통놀이 체험 등", "어린이·가족:가족 전통놀이 체험 등"]);
  assert.deepEqual(summary({ agelimit: "어린이 동반 가능" }), ["어린이·가족:어린이 동반 가능"]);
  // Numbers keep their commas: the piece is not cut inside "10,000원".
  assert.deepEqual(summary({ program: "연꽃 체험교실(참가비 10,000원, 만 6세 이상 어린이)" }), ["체험:연꽃 체험교실(참가비 10,000원", "어린이·가족:만 6세 이상 어린이)"]);
  // A bare heading is kept only when nothing says more.
  assert.deepEqual(summary({ program: "3. 체험\n4. 공연" }), ["체험:체험"]);
  // A long piece is cut around the mention.
  const long = summary({ program: `가상현실로 구현된 인물과 대화하며 지역의 옛이야기를 듣는 체험 프로그램과 야간 미디어 산책을 함께 운영합니다` })[0];
  assert.ok(long.startsWith("체험:…") && long.includes("체험 프로그램") && long.length < 60, long);
  // No mention, no mark: words that only look alike do not count.
  assert.deepEqual(summary({ program: "아이스크림 판매, 아이디어 공모전, 청년 버스킹" }), []);
});

test("free reads only the fee text and says when something is paid", () => {
  assert.deepEqual(summary({ fee: "무료" }), ["무료:무료"]);
  assert.deepEqual(summary({ fee: "입장료 무료" }), ["무료:입장료 무료"]);
  for (const fee of ["무료 (일부 체험비 별도)", "입장료 무료 (일부 체험, 홍보판매 푸드트럭 등 유료)", "무료(김치체험학교 유료)", "입장료 무료 (일부유료 2,000원 ~ 5,000원)", "무료(광명동굴 입장료 및 시설 이용료는 홈페이지 참고)", "무료 (일부 유료)"]) {
    assert.deepEqual(festivalMarks(intro({ fee })).map(m => m.label), ["무료·일부 유료"], fee);
  }
  for (const fee of ["유료 (대인 19,000원, 소인 13,000원)", "일부 유료", "유료(셔틀버스 이용료 3,000원)", ""]) assert.deepEqual(summary({ fee }), [], fee);
  assert.deepEqual(summary({ program: "무료 시식 행사" }), [], "free food in the programme is not free entry");
  assert.equal(festivalMarks(intro({ fee: `입장료 무료 ${"(안내) ".repeat(20)}` }))[0].evidence.length, 60);
});

test("mark filters: address words and matching", () => {
  assert.deepEqual(parseMarkKinds("free,experience,bogus,experience"), ["experience", "free"]);
  assert.deepEqual(parseMarkKinds(null), []);
  const marks = { checkedAt: "2026-10-04T00:00:00.000Z", items: festivalMarks(intro({ program: "딸기 체험, 키즈존", fee: "무료" })) };
  assert.ok(hasMarks(marks, ["experience", "family", "free"]));
  assert.ok(hasMarks(marks, []));
  assert.equal(hasMarks({ ...marks, items: [] }, ["free"]), false);
  assert.equal(hasMarks(null, []), false, "an introduction not read yet never passes a filter");
});
