import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../../data/festival-editions.json";
import { makeComparison } from "../comparison/evidence";
import { makeEvidence } from "../region/evidence";
import { HISTORY_SOURCE, SOURCE } from "../region/model";
import type { Edition } from "../comparison/types";
import { archive, connectEvidence, copy, currentCheck, duplicateOption, encodePlanning, importPlanning, newOption, newPlanning, newTask, parsePlanning, PLANNING_KEY, taskBasis, taskStatus, uid, validatePlanning, venueBasis, writePlanning } from "./model";
import type { Planning, SourceCopy } from "./types";
import { applyVenueEvidence, venueResource } from "./venue-evidence";

async function venueSource(address = "검증용 주소"): Promise<SourceCopy> {
  const value = await makeEvidence({ query: { province: "44", district: "230", start: "2026-01-01", end: "2026-12-31", kind: "12" }, region: { provinceCode: "44", provinceName: "충청남도", districtCode: "230", districtName: "논산시" }, resources: { status: "complete", message: "검증용 가상 자료", items: [{ id: "9001", title: "검증용 관광지", address, longitude: null, latitude: null, start: null, end: null, modifiedAt: null }], total: 1, pages: 1, collectedAt: "2026-09-10T00:00:00Z", source: SOURCE }, history: { status: "unavailable", message: "검증용 결측", source: HISTORY_SOURCE, unit: "명", metric: "시군구 일별 외지인 방문", points: [] } }, { resourceId: "9001" }, "장소 조사");
  return { key: `region:${value.id}`, kind: "region", value };
}

test("관광자료 장소 적용은 사본·판단을 함께 연결하고 기존 확인·보관본·담당 지역을 보존한다", async () => {
  let p = fixture(); const before = p.draft.options[0];
  before.venueChecks.push({ id: uid(), stage: "event", kind: "use", status: "available", owner: "검증 담당", date: "2026-09-10", reference: "기존 장소 회신", note: "", basis: venueBasis(before, "event") });
  before.tasks.push(newTask(before)); p = archive(p, "변경 전");
  const old = JSON.stringify(p.revisions), source = await venueSource();
  p.draft = applyVenueEvidence(p.draft, before.id, source, "지역 자원 활용");
  const o = p.draft.options[0]; assert.equal(o.venue, "검증용 관광지 · 검증용 주소");
  assert.equal(currentCheck(o, "event", "use"), undefined); assert.equal(taskStatus(o, o.tasks[0]).stale, true);
  assert.deepEqual(o.venueChecks, before.venueChecks); assert.equal(p.draft.regionKey, "44/230");
  source.value.note = "보관함 변경"; assert.equal(p.draft.evidence[0].value.note, "장소 조사");
  assert.equal(o.links[0].reason, "지역 자원 활용"); assert.equal(JSON.stringify(parsePlanning(encodePlanning(p)).revisions), old);
});
test("이미 연결한 관광자료의 장소 적용은 원래 이유를 유지하고 같은 장소·다른 내용은 거부한다", async () => {
  const p = fixture(), s = await venueSource(), id = p.draft.options[0].id;
  p.draft = connectEvidence(p.draft, id, s, "venue", "원래 판단");
  p.draft = applyVenueEvidence(p.draft, id, s, "새 판단");
  assert.equal(p.draft.options[0].links.length, 1); assert.equal(p.draft.options[0].links[0].reason, "원래 판단");
  assert.throws(() => applyVenueEvidence(p.draft, id, s, ""), /같은 장소/);
  p.draft.options[0].venue = "다른 입력"; const old = JSON.stringify(p.draft); s.value.note = "변조";
  assert.throws(() => applyVenueEvidence(p.draft, id, s, ""), /식별자의 내용/); assert.equal(JSON.stringify(p.draft), old);
});
test("주소 결측은 이름만 쓰고 행사·비교·선택 누락·초과 길이는 장소 입력에 쓰지 않는다", async () => {
  const s = await venueSource(""); assert.equal(venueResource(s)?.venue, "검증용 관광지");
  if (s.kind !== "region") throw Error("fixture");
  s.value.result.query.kind = "14"; assert.ok(venueResource(s));
  s.value.result.query.kind = "15"; assert.equal(venueResource(s), null);
  s.value.result.query.kind = "12"; s.value.selection = { resourceId: "missing" }; assert.equal(venueResource(s), null);
  s.value.selection = { resourceId: "9001" }; s.value.result.resources.items[0].address = "가".repeat(2000); assert.equal(venueResource(s), null);
  assert.equal(venueResource(await source()), null);
});

function fixture() {
  const p = newPlanning(2027), o = p.draft.options[0];
  p.draft.regionKey = "44/230"; p.draft.department = "관광부서"; p.draft.continuity = "continuing";
  Object.assign(o, { name: "봄꽃 산책", theme: "지역 자연", item: "산책", audience: "가족", venue: "검증 장소 A" });
  o.periods = { setup: { start: "2027-04-09", end: "2027-04-09" }, event: { start: "2027-04-10", end: "2027-04-11" }, teardown: { start: "2027-04-12", end: "2027-04-12" } };
  return p;
}
async function source(): Promise<SourceCopy> {
  const value = await makeComparison(catalogue.editions.filter(e => e.id.startsWith("nonsan")) as Edition[], { mode: "archive", regions: ["44/230"], start: "2023-01-01", end: "2025-12-31", keyword: "논산", theme: "", dateRule: "overlap", queriedAt: null }, { kind: "visits", from: 0, to: 0 }, "실제 보관 자료를 사용한 계산 검증");
  return { kind: "comparison", key: `comparison:${value.id}`, value };
}
function memory() { const values = new Map<string, string>(); return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } }; }

test("후보 연결은 실제 D0 값·출처 사본과 판단 이유를 분리하고 다른 지역을 담당 지역으로 바꾸지 않는다", async () => {
  const p = fixture(), s = await source();
  p.draft.regionKey = "44/150";
  p.draft = connectEvidence(p.draft, p.draft.options[0].id, s, "timing", "가족 대상의 행사 시기 검토");
  assert.equal(p.draft.regionKey, "44/150");
  const saved = p.draft.evidence[0]; assert.equal(saved.kind, "comparison");
  if (saved.kind === "comparison") assert.deepEqual(saved.value.editions.map(e => e.visits!.points[0].value), [48296.5, 56252, 52671.5]);
  s.value.note = "나중에 바뀐 보관함 메모";
  assert.notEqual(saved.value.note, s.value.note);
  assert.equal(p.draft.options[0].links[0].reason, "가족 대상의 행사 시기 검토");
  assert.throws(() => connectEvidence(p.draft, p.draft.options[0].id, saved, "timing", "중복"), /이미 연결/);
  validatePlanning(p);
});
test("설치·행사·철거의 확인은 독립이며 날짜 변경 후 과거 확인과 준비 기록을 보존한다", () => {
  const p = fixture(), o = p.draft.options[0];
  o.venueChecks.push({ id: uid(), stage: "event", kind: "use", status: "available", owner: "시설 관리 담당", date: "2026-09-08", reference: "대관 회신 검증 메모", note: "행사 기간만 확인", basis: venueBasis(o, "event") });
  const t = newTask(o); t.title = "장소 임차"; t.progress = "done"; t.reviews.push({ id: uid(), status: "confirmed", owner: "대관 담당", date: "2026-09-08", reference: "회신 식별 메모", basis: taskBasis(o) }); o.tasks.push(t);
  assert.equal(currentCheck(o, "event", "use")?.status, "available"); assert.equal(currentCheck(o, "setup", "use"), undefined);
  const before = copy(o.venueChecks[0]), oldReview = copy(t.reviews[0]);
  o.periods.event.end = "2027-04-12";
  assert.equal(currentCheck(o, "event", "use"), undefined); assert.equal(taskStatus(o, t).stale, true); assert.equal(taskStatus(o, t).review, "unknown");
  assert.deepEqual(o.venueChecks[0], before); assert.deepEqual(t.reviews[0], oldReview); validatePlanning(p);
});
test("관광정보만으로 장소 가능 확인을 만들 수 없고 역전 날짜를 거부하며 구간 중첩은 허용한다", () => {
  const p = fixture(), o = p.draft.options[0]; o.periods.setup.end = "2027-04-10"; validatePlanning(p);
  o.periods.event.end = "2027-04-08"; assert.throws(() => validatePlanning(p), /종료일/); o.periods.event.end = "2027-04-11";
  o.venueChecks.push({ id: uid(), stage: "event", kind: "use", status: "available", owner: "", date: "", reference: "", note: "관광지 등록됨", basis: venueBasis(o, "event") });
  assert.throws(() => validatePlanning(p), /확인에는/);
});
test("복수 수행 관계와 미정 사업 정보는 보존되며 재단이 보조사업으로 변환되지 않는다", () => {
  const p = fixture(); p.draft.relations = [ { id: uid(), organization: "검증 문화재단", relation: "foundation", scope: "사업 수행", reference: "", checkedAt: "" }, { id: uid(), organization: "검증 무대업체", relation: "service", scope: "무대", reference: "", checkedAt: "" } ];
  const result = parsePlanning(encodePlanning(p)); assert.deepEqual(result.draft.relations.map(r => r.relation), ["foundation", "service"]); assert.equal(result.draft.purpose, "");
});
test("참조 추가는 완료/외부 확인이 아니며 해당 없음에는 이유와 판단일이 필요하다", () => {
  const p = fixture(), o = p.draft.options[0], t = newTask(o); o.tasks.push(t); t.reference = "견적서 식별 메모";
  assert.equal(taskStatus(o, t).review, "unknown"); assert.equal(t.progress, "todo");
  t.applies = "no"; assert.throws(() => validatePlanning(p), /사유와 판단일/); t.naReason = "실내 장소라 별도 천막 불필요"; t.decidedAt = "2026-09-08"; validatePlanning(p);
});
test("자기 참조·순환·다른 후보의 과제 참조를 거부하고 선행 미완료 시 예외 이유를 요구한다", () => {
  const p = fixture(), o = p.draft.options[0], a = newTask(o), b = newTask(o); o.tasks = [a, b];
  a.dependsOn = [a.id]; assert.throws(() => validatePlanning(p), /다른 과제/);
  a.dependsOn = [b.id]; b.dependsOn = [a.id]; assert.throws(() => validatePlanning(p), /순환/);
  b.dependsOn = []; a.progress = "doing"; assert.throws(() => validatePlanning(p), /예외 진행/); a.exceptionReason = "동시 준비가 가능하다고 담당자가 판단"; validatePlanning(p);
  a.dependsOn = [uid()]; assert.throws(() => validatePlanning(p), /다른 과제/);
});
test("후보 복사는 근거를 유지하고 선택·확인·기한·진행을 새 초안 상태로 초기화한다", async () => {
  const p = fixture(); p.draft = connectEvidence(p.draft, p.draft.options[0].id, await source(), "timing", "참고"); const o = p.draft.options[0]; o.decision = "selected"; o.reason = "선호";
  const a = newTask(o), b = newTask(o); a.progress = "done"; a.due = "2027-03-01"; b.dependsOn = [a.id]; o.tasks = [a, b];
  const next = duplicateOption(o); assert.notEqual(next.id, o.id); assert.deepEqual(next.links, o.links); assert.equal(next.decision, "undecided"); assert.equal(next.tasks[0].progress, "todo"); assert.equal(next.tasks[0].due, ""); assert.equal(next.tasks[1].dependsOn[0], next.tasks[0].id); assert.notEqual(next.tasks[0].id, a.id);
  p.draft.options.push(next); validatePlanning(p);
});
test("초안 수정·연결 제외·파일 가져오기는 보관 당시 값과 기획 담당 지역을 보존한다", async () => {
  let p = fixture(); p.draft = connectEvidence(p.draft, p.draft.options[0].id, await source(), "timing", "과거 추세"); p = archive(p, "첫 비교"); const old = JSON.stringify(p.revisions[0]);
  p.draft.options[0].links = []; p.draft.evidence = []; p.draft.regionKey = "44/150";
  const incoming = newPlanning(2028); const next = importPlanning(p, incoming);
  assert.equal(JSON.stringify(next.revisions[0]), old); assert.equal(next.revisions[0].draft.regionKey, "44/230"); assert.equal(next.revisions[1].draft.regionKey, "44/150"); assert.equal(next.draft.year, 2028);
  const tampered = copy(next); tampered.revisions[0].note = "덮어쓰기"; assert.throws(() => importPlanning(p, tampered), /식별자의 내용/);
});
test("불변 보관본 변조·다른 창의 최신 입력·저장 실패에서 이전 값을 덮어쓰지 않는다", () => {
  const storage = memory(); const p = archive(fixture(), "고정"), raw = writePlanning(p, null, storage);
  const altered = copy(p); altered.revisions[0].draft.title = "변조"; assert.throws(() => writePlanning(altered, raw, storage), /수정하거나 제거/);
  assert.throws(() => writePlanning(p, null, storage), /다른 창/); assert.equal(storage.getItem(PLANNING_KEY), raw);
  const failed = { ...storage, setItem: () => { throw new Error("QuotaExceededError"); } }; assert.throws(() => writePlanning(p, raw, failed), /QuotaExceeded/); assert.equal(storage.getItem(PLANNING_KEY), raw);
});
test("손상·새 형식·초과 크기·깨진 근거 연결을 거부하고 불완전한 후보는 초안으로 남긴다", () => {
  const p = fixture(); p.draft.options.push(newOption("후보 B")); validatePlanning(p);
  for (const raw of ["{}", '{"__proto__":{}}', JSON.stringify({ ...p, version: 99 }), " ".repeat(5_000_001)]) assert.throws(() => parsePlanning(raw));
  p.draft.options[0].links.push({ sourceKey: "comparison:missing", field: "item", reason: "잘못된 연결" }); assert.throws(() => validatePlanning(p));
  assert.equal(newPlanning(2027).draft.regionKey, "");
});
test("지역 자원과 비용 근거를 함께 연결해도 좌표 결측·기간·부분 사업 범위·세금 미확인을 보존한다", async () => {
  const p = fixture();
  const resource = await makeEvidence({ query: { province: "44", district: "230", start: "2026-01-01", end: "2026-12-31", kind: "12" }, region: { provinceCode: "44", provinceName: "충청남도", districtCode: "230", districtName: "논산시" }, resources: { status: "complete", message: "검증용 가상 자원", items: [{ id: "9001", title: "검증용 관광지", address: "검증용 주소", longitude: null, latitude: null, start: null, end: null, modifiedAt: null }], total: 1, pages: 1, collectedAt: "2026-09-08T00:00:00Z", source: SOURCE }, history: { status: "unavailable", message: "검증용 결측", source: HISTORY_SOURCE, unit: "명", metric: "시군구 일별 외지인 방문", points: [] } }, { resourceId: "9001" }, "장소 후보 조사");
  p.draft = connectEvidence(p.draft, p.draft.options[0].id, { key: `region:${resource.id}`, kind: "region", value: resource }, "venue", "관광시설 정보이며 대관 미확인");
  const wonju = catalogue.editions.find(e => e.id === "wonju-peach-2022-21");
  const cost = await makeComparison([wonju] as Edition[], { mode: "archive", regions: [], start: "2022-01-01", end: "2025-12-31", keyword: "", theme: "", dateRule: "overlap", queriedAt: null }, { kind: "cost", editionId: "wonju-peach-2022-21", costId: "wonju-2022-actual" }, "지원사업 실제 집행 자료");
  p.draft = connectEvidence(p.draft, p.draft.options[0].id, { key: `comparison:${cost.id}`, kind: "comparison", value: cost }, "decision", "전체 축제 비용으로 확대하지 않음");
  const restored = parsePlanning(encodePlanning(archive(p, "두 종류 근거"))), copies = restored.revisions[0].draft.evidence;
  assert.equal(copies[0].kind, "region"); if (copies[0].kind === "region") assert.equal(copies[0].value.result.resources.items[0].longitude, null);
  assert.equal(copies[1].kind, "comparison"); if (copies[1].kind === "comparison") { const c = copies[1].value.editions[0].costs.find(c => c.id === "wonju-2022-actual")!; assert.equal(c.amount, 35118200); assert.equal(c.vat, "미확인"); assert.equal(c.parts!.reduce((sum, p) => sum + p.amount, 0), 35118200); assert.deepEqual(c, cost.editions[0].costs.find(c => c.id === "wonju-2022-actual")); }
  assert.equal(restored.draft.options[0].venueChecks.length, 0);
});
